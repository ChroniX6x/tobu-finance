import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import mongoose, { Types, type ClientSession } from 'mongoose';
import { MongoOperationTimeoutError } from 'mongodb';
import { DateTime } from 'luxon';
import { ActivityWriteEventSchema, clipActivityText, ACTIVITY_TITLE_MAX, ACTIVITY_NAME_MAX, type ActivityCode, type ActivityParams, type ActivitySubjectKind, type ActivityWriteEvent } from '@tobu/contracts/activity';
import { isTrustedAccountContext, type AuthorizedContext } from '../auth/account-context.js';
import { isTrustedSystemActor, type SystemActor } from '../auth/system-actor.js';
import { User } from '../auth/models.js';
import Account from '../models/Account.js';
import Member from '../models/Member.js';
import Event from '../models/Event.js';

// Collection names are the existing domain collections, never provided by a client.
const collections: Record<Exclude<ActivitySubjectKind, 'member'>, string> = {
    account: 'accounts',
    transaction: 'transactions',
    category: 'categories',
    memberIncome: 'member_incomes',
    contributionRule: 'contribution_rules',
    categoryBudget: 'category_budgets',
    carryOver: 'carryovers',
    accountBalance: 'account_balances',
    legacyRecurrence: 'recurrences'
};
export type ActivityAuthority = AuthorizedContext | { readonly accountId: string; readonly system: SystemActor };
export type ActivityIntent = { [C in ActivityCode]: { code: C; subject: { kind: ActivitySubjectKind; id: string }; params: ActivityParams<C> } }[ActivityCode];
const trustedCommands = new WeakSet<object>();

/** Stable *domain* identity (e.g. object id + expected version/action), never an HTTP body/header key.
 * New non-idempotent creates must allocate/recover a stable domain id before entering this layer.
 * A random new key on every HTTP retry does not provide idempotency and is forbidden by the caller contract.
 */
export function activityCommand(domainIdentity: string) {
    if (!domainIdentity.trim()) throw new Error('ACTIVITY_DOMAIN_IDENTITY_REQUIRED');
    const command = Object.freeze({ commandId: createHash('sha256').update(domainIdentity).digest('hex'), correlationId: randomUUID(), date: DateTime.utc().toJSDate() });
    trustedCommands.add(command);
    return command;
}
type Command = ReturnType<typeof activityCommand>;
export type ActivityResult = { outcome: 'applied' | 'replayed' | 'noop'; eventIds: string[] };

export class ActivityWriteError extends Error {}
/** Unknown is deliberately not reported as rollback or success. Caller must retry/read with the SAME domain identity. */
export class ActivityCommitUnknown extends ActivityWriteError {}

function authority(context: ActivityAuthority) {
    if (isTrustedAccountContext(context)) return { accountId: context.account.accountId, actor: context.actor, trigger: { kind: 'user_action' as const } };
    if ('system' in context && isTrustedSystemActor(context.system)) {
        return { accountId: context.accountId, actor: { kind: 'system' as const }, trigger: { kind: context.system.trigger, ...(context.system.initiatedByUserId ? { initiatedByUserId: context.system.initiatedByUserId } : {}) } };
    }
    throw new ActivityWriteError('ACTIVITY_UNTRUSTED_AUTHORITY');
}

async function checkAuthority(context: ActivityAuthority, session?: ClientSession) {
    const auth = authority(context);
    const options = session ? { session } : {};
    const account = await Account.findById(auth.accountId, { members: 1 }, options).lean();
    if (!account) throw new ActivityWriteError('ACTIVITY_ACCOUNT_UNAVAILABLE');
    if (isTrustedAccountContext(context)) {
        const user = await User.exists({ _id: context.actor.userId, isActive: true }).setOptions(options);
        const member = await Member.exists({ _id: context.account.memberId, userId: context.actor.userId }).setOptions(options);
        const entry = account.members.find((item) => String(item.memberId) === context.account.memberId);
        if (!user || !member || !entry || entry.role !== context.account.role) throw new ActivityWriteError('ACTIVITY_AUTHORITY_CHANGED');
    }
    return auth;
}

async function inAccount(kind: ActivitySubjectKind, id: string, accountId: string, session: ClientSession) {
    const db = mongoose.connection.db!;
    if (kind === 'member') return !!(await Account.exists({ _id: accountId, 'members.memberId': id }).session(session));
    const filter = kind === 'account' ? { _id: new Types.ObjectId(id) } : { _id: new Types.ObjectId(id), accountId: new Types.ObjectId(accountId) };
    return (kind !== 'account' || id === accountId) && !!(await db.collection(collections[kind]).findOne(filter, { session, projection: { _id: 1 } }));
}
const removed = (code: string) => /\.(deleted|removed)$|Deleted$/.test(code);
const created = (code: string) => /\.(created|added|set)$|Created$/.test(code);

async function checkScope(events: ActivityWriteEvent[], session: ClientSession, phase: 'before' | 'after') {
    for (const event of events) {
        if ((phase === 'before' && !created(event.code)) || (phase === 'after' && !removed(event.code))) {
            if (!(await inAccount(event.subject.kind, event.subject.id, event.accountId, session))) throw new ActivityWriteError('ACTIVITY_SUBJECT_NOT_IN_ACCOUNT');
        }
        // Check all allowed referenced ids, including both sides of a category delta.
        if ((phase === 'before' && !removed(event.code)) || (phase === 'after' && removed(event.code))) continue;
        for (const [key, value] of Object.entries(event.params)) {
            const kind = key === 'categoryId' ? 'category' : key === 'memberId' ? 'member' : key === 'parentTransactionId' ? 'transaction' : null;
            if (!kind) continue;
            const ids = typeof value === 'object' && value !== null ? Object.values(value) : [value];
            for (const id of ids) {
                if (id && !(await inAccount(kind, String(id), event.accountId, session))) throw new ActivityWriteError('ACTIVITY_REFERENCE_NOT_IN_ACCOUNT');
            }
        }
    }
}

function prepare(context: ActivityAuthority, command: Command, intents: readonly ActivityIntent[]) {
    const auth = authority(context);
    if (!trustedCommands.has(command)) throw new ActivityWriteError('ACTIVITY_UNTRUSTED_COMMAND');
    if (intents.length === 0) throw new ActivityWriteError('ACTIVITY_INTENT_REQUIRED');
    const events = intents.map((intent) => {
        const params: Record<string, unknown> = { ...intent.params };
        if ('title' in params) {
            const title = compatibleText(params.title, ACTIVITY_TITLE_MAX);
            delete params.title;
            if (title) params.title = title;
        }
        if ('name' in params) params.name = compatibleText(params.name, ACTIVITY_NAME_MAX) ?? null;
        return ActivityWriteEventSchema.parse({ ...auth, commandId: command.commandId, correlationId: command.correlationId, date: command.date, schemaVersion: 1, code: intent.code, subject: intent.subject, params });
    });
    const identities = events.map((event) => `${event.code}:${event.subject.kind}:${event.subject.id}`);
    if (new Set(identities).size !== identities.length) throw new ActivityWriteError('ACTIVITY_DUPLICATE_INTENT');
    const ids = events.map((event, index) => new Types.ObjectId(createHash('sha256').update(`${event.accountId}:${command.commandId}:${index}`).digest('hex').slice(0, 24)));
    return { events, ids };
}

/** E01's Zod max uses UTF-16 units, Mongo maxLength uses codepoints. Meet both without splitting a surrogate pair. */
function compatibleText(value: unknown, max: number) {
    const text = clipActivityText(value, max);
    if (!text) return undefined;
    let result = '';
    for (const point of text) {
        if (result.length + point.length > max) break;
        result += point;
    }
    return result;
}

function comparable(event: ActivityWriteEvent) {
    return Object.fromEntries(Object.entries(event).filter(([key]) => !['date', 'correlationId'].includes(key)));
}

async function readback(events: ActivityWriteEvent[], ids: Types.ObjectId[], session?: ClientSession): Promise<ActivityResult | null> {
    const query = Event.find({ _id: { $in: ids } });
    if (session) query.session(session);
    else query.read('primary').readConcern('majority');
    const rows = await query.lean();
    if (rows.length === 0) return null;
    if (rows.length !== events.length) throw new ActivityWriteError('ACTIVITY_INCOMPLETE_READBACK');
    for (let index = 0; index < ids.length; index++) {
        const row = rows.find((item) => String(item._id) === String(ids[index]))!;
        const raw = Object.fromEntries(Object.entries(row).filter(([key]) => !['_id', 'createdAt', 'updatedAt', '__v'].includes(key)));
        const stored = ActivityWriteEventSchema.parse({ ...raw, accountId: String(raw.accountId) });
        // Legacy compatibility column defaults to null on the model; it is not command identity.
        delete stored.createdByMemberId;
        if (!isDeepStrictEqual(comparable(stored), comparable(events[index]!))) throw new ActivityWriteError('ACTIVITY_COMMAND_CONFLICT');
    }
    // Detect changed fanout as well as changed payloads on an existing identity.
    const countQuery = Event.countDocuments({ accountId: events[0]!.accountId, commandId: events[0]!.commandId });
    if (session) countQuery.session(session);
    else countQuery.read('primary').readConcern('majority');
    if ((await countQuery) !== events.length) throw new ActivityWriteError('ACTIVITY_COMMAND_CONFLICT');
    return { outcome: 'replayed', eventIds: ids.map(String) };
}

/** Reuses an existing H02 transaction/session. Never commits, catches errors or starts an event session.
 * mutate must await sequential domain writes with this session and return true only for a real mutation;
 * false means NO writes at all. No network/filesystem side effects in retryable callbacks.
 */
export async function writeActivityInSession(session: ClientSession, context: ActivityAuthority, command: Command, intents: readonly ActivityIntent[], mutate: (session: ClientSession) => Promise<boolean>): Promise<ActivityResult> {
    if (!session.inTransaction()) throw new ActivityWriteError('ACTIVITY_TRANSACTION_REQUIRED');
    const { events, ids } = prepare(context, command, intents);
    await checkAuthority(context, session);
    const prior = await readback(events, ids, session);
    if (prior) return prior;
    await checkScope(events, session, 'before');
    if (!(await mutate(session))) return { outcome: 'noop', eventIds: [] };
    await checkScope(events, session, 'after');
    for (let index = 0; index < events.length; index++) await Event.create([{ ...events[index], _id: ids[index] }], { session });
    return { outcome: 'applied', eventIds: ids.map(String) };
}

/** Same transaction pattern as H02; commit errors are reconciled using durable existing Event _id keys.
 * Duplicate-key after concurrent commands is success ONLY after exact majority readback. No blind replay.
 */
export async function commitActivity(context: ActivityAuthority, command: Command, intents: readonly ActivityIntent[], mutate: (session: ClientSession) => Promise<boolean>): Promise<ActivityResult> {
    const { events, ids } = prepare(context, command, intents);
    try {
        // Driver 6 supports timeoutMS here; Mongoose's narrower TransactionOptions omits that field.
        const options = { readConcern: { level: 'snapshot' as const }, writeConcern: { w: 'majority' as const }, maxCommitTimeMS: 5000, timeoutMS: 15000 };
        return await mongoose.connection.transaction((session) => writeActivityInSession(session, context, command, intents, mutate), options);
    } catch (error) {
        // CSOT expiry can replace the last labelled commit error. Treat it conservatively as unknown,
        // including an expiry before commit: absence of a receipt never authorizes a success response.
        const unknown = error instanceof MongoOperationTimeoutError || (error instanceof Error && 'hasErrorLabel' in error && typeof error.hasErrorLabel === 'function' && error.hasErrorLabel('UnknownTransactionCommitResult'));
        const duplicate = error instanceof Error && 'code' in error && error.code === 11000;
        if (!unknown && !duplicate) throw error;
        await checkAuthority(context);
        const prior = await readback(events, ids);
        if (prior) return prior;
        if (unknown) throw new ActivityCommitUnknown('ACTIVITY_COMMIT_UNKNOWN_READBACK_REQUIRED', { cause: error });
        throw error;
    }
}

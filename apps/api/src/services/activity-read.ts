import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import mongoose, { Types, type ClientSession } from 'mongoose';
import { DateTime } from 'luxon';
import {
    ActivityCursorPayloadSchema,
    ActivityItemSchema,
    ActivityPageSchema,
    ActivityQuerySchema,
    decodeStoredEvent,
    clipActivityText,
    renderActivityActor,
    renderActivityText,
    type ActivityItem,
    type ActivityPage,
    type ActivitySubjectKind
} from '@tobu/contracts/activity';
import { keys } from '../auth/config.js';
import { User } from '../auth/models.js';
import { resolveAccountContext } from '../auth/account-context.js';
import Account from '../models/Account.js';
import Member from '../models/Member.js';
import Event from '../models/Event.js';
import { ACTIVITY_READ_INDEX, activityStorageRanges } from './activity-storage.js';

export class ActivityReadError extends Error {
    constructor(
        readonly status: number,
        readonly code: string
    ) {
        super(code);
    }
}
function fail(status: number, code: string): never {
    throw new ActivityReadError(status, code);
}
/** Mongo keysets require the persisted BSON types, unlike the portable pure contract decoder. */
function hasStorageTypes(value: unknown) {
    if (!value || typeof value !== 'object') return false;
    const row = value as Record<string, unknown>;
    return row._id instanceof Types.ObjectId && row.accountId instanceof Types.ObjectId && row.date instanceof Date && Number.isFinite(row.date.getTime());
}
const CURSOR_PURPOSE = 'tobu-account-activity-cursor-v1:';
const cursorKey = createHash('sha256').update(CURSOR_PURPOSE).update(keys.access.privateKey).digest();
const mac = (data: string) =>
    createHmac('sha256', cursorKey)
        .update(CURSOR_PURPOSE + data)
        .digest();
const cursorOf = (payload: unknown) => {
    const data = Buffer.from(JSON.stringify(ActivityCursorPayloadSchema.parse(payload))).toString('base64url');
    return data + '.' + mac(data).toString('base64url');
};
function readCursor(token: string, accountId: string, filter: string) {
    try {
        const [data, signature, extra] = token.split('.');
        if (!data || !signature || extra || !/^[A-Za-z0-9_-]+$/.test(data + signature)) throw new Error();
        const supplied = Buffer.from(signature, 'base64url'),
            expected = mac(data);
        if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new Error();
        const value = ActivityCursorPayloadSchema.parse(JSON.parse(Buffer.from(data, 'base64url').toString('utf8')));
        if (value.accountId !== accountId || value.filter !== filter) throw new Error();
        return value;
    } catch {
        return fail(422, 'INVALID_ACTIVITY_CURSOR');
    }
}
const collections: Record<ActivitySubjectKind, string> = {
    account: 'accounts',
    member: 'members',
    transaction: 'transactions',
    category: 'categories',
    memberIncome: 'member_incomes',
    contributionRule: 'contribution_rules',
    categoryBudget: 'category_budgets',
    carryOver: 'carryovers',
    accountBalance: 'account_balances',
    legacyRecurrence: 'recurrences'
};
const subjectNames: Record<ActivitySubjectKind, string> = {
    account: 'Konto',
    member: 'Mitglied',
    transaction: 'Buchung',
    category: 'Kategorie',
    memberIncome: 'Einkommen',
    contributionRule: 'Beitragsregel',
    categoryBudget: 'Budget',
    carryOver: 'Übertrag',
    accountBalance: 'Kontostand',
    legacyRecurrence: 'Wiederkehrende Buchung'
};
const referenceKind: Record<string, ActivitySubjectKind> = { transactionId: 'transaction', parentTransactionId: 'transaction', categoryId: 'category', memberId: 'member', ruleId: 'contributionRule' };
const provenanceCodes: Record<ActivitySubjectKind, string[]> = {
    account: ['account.created'],
    member: ['account.member.added'],
    transaction: ['transaction.created', 'transaction.splitChildCreated'],
    category: ['category.created'],
    memberIncome: ['memberIncome.added'],
    contributionRule: ['contributionRule.added'],
    categoryBudget: ['categoryBudget.added'],
    carryOver: ['carryOver.set'],
    accountBalance: ['accountBalance.set'],
    legacyRecurrence: ['legacyRecurrence.created']
};
function displayName(value: unknown) {
    const clipped = clipActivityText(value, 120);
    if (!clipped) return null;
    let label = '';
    for (const point of clipped) {
        if (label.length + point.length > 120) break;
        label += point;
    }
    return label || null;
}
function refsOf(item: ActivityItem): { kind: ActivitySubjectKind; id: string }[] {
    const refs = item.subject ? [{ kind: item.subject.kind, id: item.subject.id.toLowerCase() }] : [];
    if (item.params)
        for (const [key, value] of Object.entries(item.params)) {
            const kind = referenceKind[key];
            if (!kind) continue;
            const ids = typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value) : [];
            for (const id of ids) if (typeof id === 'string') refs.push({ kind, id: id.toLowerCase() });
        }
    return refs;
}

/** One read snapshot; no locks, revision touches, domain mutation, event insertion or ensure. */
export async function readAccountActivity(req: Request, accountIdInput: unknown, input: unknown): Promise<ActivityPage> {
    return mongoose.connection.transaction(
        async (session) => {
            if (!(await User.exists({ _id: req.user!.sub, isActive: true }).session(session))) fail(401, 'UNAUTHORIZED');
            const context = await resolveAccountContext(req, accountIdInput, session);
            if (!context) fail(404, 'NOT_FOUND');
            const accountId = context.account.accountId;
            const parsed = ActivityQuerySchema.safeParse(input);
            if (!parsed.success) fail(422, 'INVALID_ACTIVITY_QUERY');
            const query = parsed.data;
            const from = query.from ? DateTime.fromISO(query.from, { zone: 'utc' }).toUTC().toISO()! : undefined;
            const to = query.to ? DateTime.fromISO(query.to, { zone: 'utc' }).toUTC().toISO()! : undefined;
            if (from && to && from >= to) fail(422, 'INVALID_ACTIVITY_QUERY');
            const filter = createHmac('sha256', cursorKey)
                .update(JSON.stringify([req.user!.sub, query.limit, query.code ?? null, query.subjectKind ?? null, query.subjectId?.toLowerCase() ?? null, query.actorKind ?? null, from ?? null, to ?? null]))
                .digest('hex');
            let after = query.cursor ? readCursor(query.cursor, accountId, filter) : undefined;
            const account = await Account.findById(accountId, { members: 1 }).session(session).lean();
            const members = await Member.find({ _id: { $in: (account?.members ?? []).map((m) => m.memberId) } }, { _id: 1, userId: 1, name: 1 })
                .session(session)
                .lean();
            const memberIds = new Set(members.map((m) => String(m._id)));
            const byUser = new Map(members.filter((m) => m.userId).map((m) => [String(m.userId), { memberId: String(m._id), displayName: displayName(m.name) }]));
            const items: ActivityItem[] = [];
            let scanned = 0;
            // A hostile selective filter cannot force an unbounded scan. Empty pages with a cursor remain resumable.
            const scanBudget = Math.max(100, Math.min(500, query.limit * 5));
            while (items.length < query.limit && scanned < scanBudget) {
                const batchSize = Math.min(100, scanBudget - scanned);
                const rows = [];
                for (const range of activityStorageRanges(accountId, from, to, after)) {
                    const remaining: number = batchSize - rows.length;
                    if (!remaining) break;
                    rows.push(...(await Event.find(range).sort({ date: -1, _id: -1 }).hint(ACTIVITY_READ_INDEX).limit(remaining).session(session).lean()));
                }
                if (!rows.length) break;
                const decoded = rows.map((row) => {
                    if (!hasStorageTypes(row)) fail(503, 'ACTIVITY_DATA_UNREADABLE');
                    const value = decodeStoredEvent(row);
                    if (!value.ok) fail(503, 'ACTIVITY_DATA_UNREADABLE'); // Never silently omit an unrepresentable row.
                    return value;
                });
                const scope = await referenceScope(
                    decoded.map((value) => value.item),
                    accountId,
                    memberIds,
                    session
                );
                for (let i = 0; i < decoded.length; i++) {
                    const value = decoded[i]!;
                    const item = value.item;
                    scanned++;
                    after = { v: 1, accountId, date: item.occurredAt, id: item.id, filter };
                    if (item.actor.kind === 'user') item.actor = { kind: 'user', ...(byUser.get(value.refs.actorUserId ?? '') ?? { memberId: null, displayName: null }) };
                    if (value.refs.initiatedByUserId) item.trigger.initiatedBy = byUser.get(value.refs.initiatedByUserId) ?? { memberId: null, displayName: null };
                    if (refsOf(item).some((ref) => !scope.allowed.has(ref.kind + ':' + ref.id))) {
                        item.subject = null;
                        item.params = null;
                        item.detailsUnavailable = true;
                    } else if (item.subject) {
                        item.subject.id = item.subject.id.toLowerCase();
                        item.subject.deleted = !scope.live.has(item.subject.kind + ':' + item.subject.id);
                        item.subject.label = subjectNames[item.subject.kind];
                    }
                    if (item.schemaVersion === 1 && (item.batchId || item.correlationId)) {
                        const source = item.batchId ? 'batch' : 'command';
                        const key = createHmac('sha256', cursorKey)
                            .update(JSON.stringify([accountId, source, item.batchId ?? item.correlationId, item.actor.kind, value.refs.actorUserId ?? null, item.trigger.kind, value.refs.initiatedByUserId ?? null]))
                            .digest('hex');
                        item.group = { key, source, scope: 'loaded_only' };
                    }
                    if (
                        (!query.code || query.code === item.code) &&
                        (!query.actorKind || query.actorKind === item.actor.kind) &&
                        (!query.subjectKind || item.subject?.kind === query.subjectKind) &&
                        (!query.subjectId || item.subject?.id === query.subjectId.toLowerCase())
                    )
                        items.push(ActivityItemSchema.parse(item));
                    if (items.length === query.limit) break;
                }
                if (rows.length < batchSize) break;
            }
            let more = false;
            if (after)
                for (const range of activityStorageRanges(accountId, from, to, after)) {
                    if (await Event.exists(range).hint(ACTIVITY_READ_INDEX).session(session)) {
                        more = true;
                        break;
                    }
                }
            return ActivityPageSchema.parse({ items, nextCursor: more && after ? cursorOf(after) : null });
        },
        { readConcern: { level: 'snapshot' }, readPreference: 'primary' }
    );
}

async function referenceScope(items: ActivityItem[], accountId: string, memberIds: Set<string>, session: ClientSession) {
    const requested = new Map<ActivitySubjectKind, Set<string>>();
    for (const item of items)
        for (const ref of refsOf(item)) {
            const ids = requested.get(ref.kind) ?? new Set<string>();
            ids.add(ref.id);
            requested.set(ref.kind, ids);
        }
    const allowed = new Set<string>(),
        live = new Set<string>();
    for (const [kind, ids] of requested) {
        let ownIds: Set<string>;
        if (kind === 'member' || kind === 'account') ownIds = new Set([...ids].filter((id) => (kind === 'member' ? memberIds.has(id) : id === accountId)));
        else {
            const own = await mongoose.connection
                .db!.collection(collections[kind])
                .find({ _id: { $in: [...ids].map((id) => new Types.ObjectId(id)) }, accountId: new Types.ObjectId(accountId) }, { projection: { _id: 1 }, session })
                .toArray();
            ownIds = new Set(own.map((row) => String(row._id)));
        }
        for (const id of ownIds) {
            allowed.add(kind + ':' + id);
            live.add(kind + ':' + id);
        }
        const unresolved = [...ids].filter((id) => !ownIds.has(id));
        if (!unresolved.length) continue;
        // Only a validated account-scoped creation receipt can prove a historical own subject.
        // Missing and foreign objects without such a receipt get the IDENTICAL projection. Never query another account.
        const proofs = await Event.aggregate([
            { $match: { accountId: new Types.ObjectId(accountId), schemaVersion: 1, code: { $in: provenanceCodes[kind] }, 'subject.kind': kind, 'subject.id': { $in: unresolved } } },
            { $group: { _id: '$subject.id', proof: { $first: '$$ROOT' } } }
        ]).session(session);
        for (const row of proofs) {
            if (!hasStorageTypes(row.proof)) fail(503, 'ACTIVITY_DATA_UNREADABLE');
            const proof = decodeStoredEvent(row.proof);
            if (proof.ok && proof.item.schemaVersion === 1 && proof.item.accountId === accountId && proof.item.subject?.kind === kind && proof.item.subject.id === row._id) allowed.add(kind + ':' + String(row._id));
        }
    }
    return { allowed, live };
}

export const previewActivity = (page: ActivityPage) => page.items.map((item) => ({ id: item.id, date: item.occurredAt, user: renderActivityActor(item.actor), text: renderActivityText(item) }));

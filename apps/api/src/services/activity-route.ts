import type { Request, Response } from 'express';
import mongoose, { type ClientSession } from 'mongoose';
import { activityCommand, reconcileActivity, writeActivityInSession, ActivityWriteError, type ActivityIntent } from './activity-writer.js';
import type { AuthorizedContext } from '../auth/account-context.js';
import { fingerprint, mutationPermit } from './creation-proof.js';
import { usesMutationProof } from '@tobu/contracts/creation-proof';
import Account from '../models/Account.js';
import Category from '../models/Category.js';
import Recurrence from '../models/Recurrence.js';
import Member from '../models/Member.js';

export class DomainRejection extends Error {
    constructor(
        readonly status: number,
        readonly body: Record<string, unknown>
    ) {
        super(String(body.error ?? body.code));
    }
}
export function reject(status: number, error: string): never {
    throw new DomainRejection(status, { error });
}
export function requireMutationProof(req: Request, identity: string) {
    if (!usesMutationProof(req.method, req.originalUrl.split('?')[0]!)) return;
    const failure = mutationPermit(req, identity);
    if (failure) throw new DomainRejection(failure.status, failure.body);
}
export const sameValue = (a: unknown, b: unknown) => fingerprint(a ?? null) === fingerprint(b ?? null);
export function changedPatch(previous: Record<string, unknown>, patch: Record<string, unknown>) {
    return Object.fromEntries(Object.entries(patch).filter(([key, value]) => !sameValue(previous[key], value)));
}
export function nextRevision(value: unknown, error: string): number {
    if (value !== null && value !== undefined && typeof value !== 'number') reject(409, error);
    const revision = Number(value ?? 0);
    if (!Number.isSafeInteger(revision) || revision < 0 || revision === Number.MAX_SAFE_INTEGER) reject(409, error);
    return revision + 1;
}
export async function lockMemberRevision(memberId: unknown, session: ClientSession) {
    const member = await Member.findById(memberId, { __v: 1 }).session(session);
    if (!member) reject(422, 'MEMBER_NOT_ASSIGNABLE');
    await Member.updateOne({ _id: member._id }, { $set: { __v: nextRevision(member.get('__v'), 'MEMBER_REVISION_INVALID') } }, { session, timestamps: false });
}
export async function validateReferences(accountId: unknown, session: ClientSession, refs: { categoryId?: unknown; memberIds?: unknown[]; recurrenceId?: unknown }) {
    if (refs.categoryId && !(await Category.exists({ _id: refs.categoryId, accountId }).session(session))) reject(422, 'REFERENCE_NOT_IN_ACCOUNT');
    if (refs.recurrenceId && !(await Recurrence.exists({ _id: refs.recurrenceId, accountId }).session(session))) reject(422, 'REFERENCE_NOT_IN_ACCOUNT');
    const account = await Account.findById(accountId, { members: 1 }, { session }).lean();
    const members = new Set((account?.members ?? []).map((m) => String(m.memberId)));
    if ((refs.memberIds ?? []).filter(Boolean).some((id) => !members.has(String(id).toLowerCase()))) reject(422, 'REFERENCE_NOT_IN_ACCOUNT');
}
type Reply = { status: number; body?: unknown };
export const creationReply = (body: unknown): Reply => (body ? { status: 201, body } : { status: 410, body: { error: 'CREATION_SUBJECT_DELETED' } });
type Emit = (context: AuthorizedContext, identity: string, intents: ActivityIntent[], mutate: (session: ClientSession) => Promise<boolean>) => Promise<void>;

/** H02 transaction orchestration only. Domain validation, commands and intents remain in each route. */
export async function activityRoute(req: Request, res: Response, work: (session: ClientSession, emit: Emit) => Promise<Reply>, readCommitted?: (session: ClientSession) => Promise<Reply>) {
    let recoveries: ((session?: ClientSession) => Promise<unknown>)[] = [];
    let reply: Reply | undefined;
    const commands = new Map<string, ReturnType<typeof activityCommand>>();
    try {
        await mongoose.connection.transaction(
            async (session) => {
                recoveries = [];
                let permitted = false;
                const emit: Emit = async (context, identity, intents, mutate) => {
                    if (!permitted) {
                        requireMutationProof(req, identity);
                        permitted = true;
                    }
                    let command = commands.get(identity);
                    if (!command) {
                        command = activityCommand(identity);
                        commands.set(identity, command);
                    }
                    recoveries.push((readSession) => reconcileActivity(context, command, intents, readSession));
                    await writeActivityInSession(session, context, command, intents, mutate);
                };
                reply = await work(session, emit);
            },
            { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, maxCommitTimeMS: 5000, timeoutMS: 15000 } as mongoose.mongo.TransactionOptions
        );
    } catch (error) {
        const unknown = error instanceof Error && (error.name === 'MongoOperationTimeoutError' || ('hasErrorLabel' in error && typeof error.hasErrorLabel === 'function' && error.hasErrorLabel('UnknownTransactionCommitResult')));
        const duplicate = error instanceof Error && 'code' in error && error.code === 11000;
        if ((unknown || duplicate) && recoveries.length) {
            try {
                for (const recovery of recoveries) if (!(await recovery())) return res.status(unknown ? 503 : 409).json({ error: unknown ? 'ACTIVITY_COMMIT_UNKNOWN' : 'ACTIVITY_COMMAND_CONFLICT' });
            } catch {
                return res.status(503).json({ error: 'ACTIVITY_COMMIT_UNKNOWN' });
            }
            // Never re-execute a domain command after a proven commit, even if response construction failed.
            if (!reply) {
                if (!readCommitted) return res.status(503).json({ error: 'ACTIVITY_COMMITTED_RESPONSE_UNAVAILABLE' });
                try {
                    reply = await mongoose.connection.transaction(
                        async (session) => {
                            for (const recovery of recoveries) if (!(await recovery(session))) throw new Error('COMMITTED_RECEIPT_UNAVAILABLE');
                            return readCommitted(session);
                        },
                        { readConcern: { level: 'snapshot' } }
                    );
                } catch {
                    return res.status(503).json({ error: 'ACTIVITY_COMMITTED_RESPONSE_UNAVAILABLE' });
                }
            }
        } else if (unknown) return res.status(503).json({ error: 'DOMAIN_COMMIT_UNKNOWN' });
        else if (error instanceof DomainRejection) return res.status(error.status).json(error.body);
        else if (error instanceof ActivityWriteError) return res.status(409).json({ error: error.message });
        else throw error;
    }
    if (!reply) return res.status(503).json({ error: 'ACTIVITY_COMMIT_UNKNOWN' });
    return reply.body === undefined ? res.sendStatus(reply.status) : res.status(reply.status).json(reply.body);
}

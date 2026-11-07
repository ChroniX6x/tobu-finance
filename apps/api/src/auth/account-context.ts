import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import Account from '../models/Account.js';
import Member from '../models/Member.js';

/**
 * Server-trusted actor and account context (E02).
 *
 * The only source of identity is the verified access token: JWT `sub` -> `Member.userId` -> `Account.members`
 * (never a name, e-mail, list position, header or request body). The global `admin` role grants nothing here.
 * An unregistered member (`userId` null) can never be an actor, only a payer or affected subject.
 *
 * Membership is not a full permission model: `owner` and `member` differ only where a route asks for the owner
 * (`requireOwnerContext`). The remaining member permission set is still undefined (AUTH-001).
 */

export type AccountRole = 'owner' | 'member';

export interface UserActor {
    readonly kind: 'user';
    readonly userId: string;
}

export interface AccountContext {
    readonly accountId: string;
    /** The caller's own linked member in this account (the owner entry wins if the user is linked twice). */
    readonly memberId: string;
    readonly role: AccountRole;
}

export interface AuthorizedContext {
    readonly actor: UserActor;
    readonly account: AccountContext;
}

const OBJECT_ID = /^[a-f\d]{24}$/i;
const trustedContexts = new WeakSet<object>();
/** Runtime capability, not a structurally compatible request body. */
export const isTrustedAccountContext = (value: object): value is AuthorizedContext => trustedContexts.has(value);
const isObjectId = (value: unknown): value is string => typeof value === 'string' && OBJECT_ID.test(value);

function actorOf(req: Request): UserActor | null {
    const sub = req.user?.sub;
    return isObjectId(sub) ? Object.freeze({ kind: 'user' as const, userId: sub }) : null;
}

/** Resolves the caller's membership of an account, or null (not a member, unknown account, legacy account without a linked user). */
export async function resolveAccountContext(req: Request, accountId: unknown): Promise<AuthorizedContext | null> {
    const actor = actorOf(req);
    const id = accountId instanceof Types.ObjectId ? accountId.toHexString() : accountId;
    if (!actor || !isObjectId(id)) return null;
    const linked = await Member.find({ userId: new Types.ObjectId(actor.userId) }, { _id: 1 }).lean();
    if (linked.length === 0) return null;
    const own = new Set(linked.map((member) => String(member._id)));
    const account = await Account.findById(id, { members: 1 }).lean();
    const entries = (account?.members ?? []).filter((entry) => own.has(String(entry.memberId)));
    if (entries.length === 0) return null;
    const chosen = entries.find((entry) => entry.role === 'owner') ?? entries[0]!;
    const role: AccountRole = chosen.role === 'owner' ? 'owner' : 'member';
    const context = Object.freeze({ actor, account: Object.freeze({ accountId: id.toLowerCase(), memberId: String(chosen.memberId), role }) });
    trustedContexts.add(context);
    return context;
}

/** 404 for everything that is not the caller's account (same answer for "unknown" and "foreign"). */
export async function requireAccountContext(req: Request, res: Response, accountId: unknown): Promise<AuthorizedContext | null> {
    const context = await resolveAccountContext(req, accountId);
    if (!context) res.sendStatus(404);
    return context;
}

/** Like requireAccountContext, and 403 OWNER_REQUIRED for members that are not owner. Non-members still get the uniform 404. */
export async function requireOwnerContext(req: Request, res: Response, accountId: unknown): Promise<AuthorizedContext | null> {
    const context = await requireAccountContext(req, res, accountId);
    if (!context) return null;
    if (context.account.role !== 'owner') {
        res.status(403).json({ error: 'OWNER_REQUIRED' });
        return null;
    }
    return context;
}

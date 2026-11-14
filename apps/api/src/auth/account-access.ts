import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import Account from '../models/Account.js';
import Category from '../models/Category.js';
import Member from '../models/Member.js';
import { resolveAccountContext } from './account-context.js';

/**
 * Account access = the authenticated user (JWT sub) is linked through Member.userId to a member listed in
 * Account.members (resolved by account-context.ts, the single path). Owner-only actions use requireOwnerContext.
 * Otherwise there is no role difference and the global admin role grants nothing.
 * Everything else (not a member, unknown account, legacy account without a linked user) is answered identically with
 * 404, so "does not exist" and "belongs to someone else" cannot be told apart. A malformed account id keeps the 400
 * INVALID_ID of routes that always validated it; that reveals nothing about existence.
 */

const OBJECT_ID = /^[a-f\d]{24}$/i;

export const isObjectId = (value: unknown): value is string => typeof value === 'string' && OBJECT_ID.test(value);

export function callerUserId(req: Request): Types.ObjectId | null {
    const sub = req.user?.sub;
    return isObjectId(sub) ? new Types.ObjectId(sub) : null;
}

/** Ids of all members that are linked to the caller. */
export async function callerMemberIds(req: Request): Promise<Types.ObjectId[]> {
    const userId = callerUserId(req);
    if (!userId) return [];
    const members = await Member.find({ userId }, { _id: 1 }).lean();
    return members.map((m) => m._id as Types.ObjectId);
}

/** Ids of all accounts the caller is a member of. */
export async function callerAccountIds(req: Request): Promise<Types.ObjectId[]> {
    const memberIds = await callerMemberIds(req);
    if (memberIds.length === 0) return [];
    const accounts = await Account.find({ 'members.memberId': { $in: memberIds } }, { _id: 1 }).lean();
    return accounts.map((a) => a._id as Types.ObjectId);
}

export async function hasAccountAccess(req: Request, accountId: unknown): Promise<boolean> {
    return (await resolveAccountContext(req, accountId)) !== null;
}

/** Answers 404 and returns false unless the caller is a member of the account. */
export async function requireAccountAccess(req: Request, res: Response, accountId: unknown): Promise<boolean> {
    if (await hasAccountAccess(req, accountId)) return true;
    res.sendStatus(404);
    return false;
}

/** Narrows an optional accountId filter of a list route to the caller's accounts; undefined means "all of them". */
export async function accountScope(req: Request, res: Response, accountId: unknown): Promise<Types.ObjectId | Types.ObjectId[] | null> {
    if (accountId !== undefined && accountId !== null && accountId !== '') {
        if (!(await requireAccountAccess(req, res, accountId))) return null;
        return new Types.ObjectId(String(accountId));
    }
    return callerAccountIds(req);
}

export async function accountMemberIdSet(accountId: unknown): Promise<Set<string>> {
    if (!isObjectId(accountId)) return new Set();
    const account = await Account.findById(accountId, { members: 1 }).lean();
    return new Set((account?.members ?? []).map((m) => String(m.memberId)));
}

/**
 * Checks that referenced members and the category belong to the (already authorized) account. Returns the name of
 * the first offending field, or null. Foreign ids are never stored, so nothing about them can leak into the account.
 */
export async function foreignReference(accountId: unknown, refs: { categoryId?: unknown; memberIds?: Record<string, unknown> }): Promise<string | null> {
    const account = String(accountId);
    if (refs.categoryId) {
        if (!isObjectId(refs.categoryId)) return 'categoryId';
        if (!(await Category.exists({ _id: new Types.ObjectId(refs.categoryId), accountId: new Types.ObjectId(account) }))) return 'categoryId';
    }
    const named = Object.entries(refs.memberIds ?? {}).filter(([, value]) => value);
    if (named.length > 0) {
        const allowed = await accountMemberIdSet(account);
        for (const [field, value] of named) if (!allowed.has(String(value).toLowerCase())) return field;
    }
    return null;
}

/** Members the caller may read or change: those linked to the caller and those listed in the caller's accounts. */
export async function visibleMemberIds(req: Request): Promise<Types.ObjectId[]> {
    const own = await callerMemberIds(req);
    const created = await Member.find({ createdByUserId: callerUserId(req) }, { _id: 1 }).lean();
    const assignedCreated = created.length ? await Account.find({ 'members.memberId': { $in: created.map((m) => m._id) } }, { members: 1 }).lean() : [];
    const assignedIds = new Set(assignedCreated.flatMap((account) => account.members.map((entry) => String(entry.memberId))));
    const accountIds = await callerAccountIds(req);
    const accounts = accountIds.length > 0 ? await Account.find({ _id: { $in: accountIds } }, { members: 1 }).lean() : [];
    const all = new Map<string, Types.ObjectId>();
    for (const id of own) all.set(String(id), id);
    // Provenance permits managing one's own orphans; it does not bypass account scope after assignment elsewhere.
    for (const member of created) if (!assignedIds.has(String(member._id))) all.set(String(member._id), member._id as Types.ObjectId);
    for (const account of accounts) for (const m of account.members ?? []) all.set(String(m.memberId), m.memberId as Types.ObjectId);
    return [...all.values()];
}

import { Router } from 'express';
import { Types, type ClientSession } from 'mongoose';
import { createHash } from 'node:crypto';
import Account from '../models/Account.js';
import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';
import Member from '../models/Member.js';
import MemberIncome from '../models/MemberIncome.js';
import CarryOver from '../models/CarryOver.js';
import AccountBalance from '../models/AccountBalance.js';
import CategoryBudget from '../models/CategoryBudget.js';
import Recurrence from '../models/Recurrence.js';
import { User } from '../auth/models.js';

import { validateBody, validateQuery } from '../middleware/validate.js';
import { QueryAccounts, CreateAccount, UpdateAccount, QueryAccountExpanded, AddMemberToAccount } from '../validation/accounts.js';
import ContributionRule from '../models/ContributionRule.js';

import { monthRangeFromISO } from '../lib/month.js';
import { activityRoute, creationReply, changedPatch, lockMemberRevision, reject } from '../services/activity-route.js';
import { creationId } from '../services/creation-proof.js';
import { lockActivityUser, type ActivityIntent } from '../services/activity-writer.js';
import { callerAccountIds, requireAccountAccess } from '../auth/account-access.js';
import { requireOwnerContext, resolveAccountContext, accountCreateContext } from '../auth/account-context.js';

const r = Router();

const monthToRange = (m: string) => monthRangeFromISO(m);

/** GET /api/accounts?memberId=... (optional) – only accounts the caller is a member of */
r.get('/', validateQuery(QueryAccounts), async (req, res) => {
    const { memberId } = (req as any).q as { memberId?: string };
    const q: any = { _id: { $in: await callerAccountIds(req) } };
    if (memberId) q['members.memberId'] = new Types.ObjectId(memberId);
    const items = await Account.find(q).lean();
    res.json(items);
});

/** GET /api/accounts/:id -> single account by id */
r.get('/:id', async (req, res) => {
    const { id } = req.params;
    if (!/^[a-f\d]{24}$/i.test(id)) return res.status(400).json({ error: 'INVALID_ID' });
    if (!(await requireAccountAccess(req, res, id))) return;
    const acc = await Account.findById(id).lean();
    if (!acc) return res.sendStatus(404);
    res.json(acc);
});

/** GET /api/accounts/:id/expanded?include=...&from=YYYY-MM&to=YYYY-MM&status=booked|pending */
r.get('/:id/expanded', validateQuery(QueryAccountExpanded), async (req, res) => {
    const id = req.params['id'] ?? '';
    if (!/^[a-f\d]{24}$/i.test(id)) return res.status(400).json({ error: 'INVALID_ID' });
    if (!(await requireAccountAccess(req, res, id))) return;
    const inc: string[] = ((req as any).q?.include ?? []) as string[];
    const from: string | undefined = (req as any).q?.from;
    const to: string | undefined = (req as any).q?.to;
    const status: 'booked' | 'pending' | undefined = (req as any).q?.status;

    const acc = await Account.findById(id).lean();
    if (!acc) return res.sendStatus(404);

    // common range filter
    const range =
        from && to
            ? (() => {
                  const a = monthToRange(from);
                  const b = monthToRange(to);
                  return { start: a.start, end: b.end };
              })()
            : undefined;

    const accountId = new Types.ObjectId(id);

    // Build promises per include
    const tasks: Record<string, Promise<any>> = {};

    if (inc.includes('members')) {
        // resolve member documents used in account.members
        const memberIds = (acc.members ?? []).map((m: any) => new Types.ObjectId(m.memberId));
        tasks.members = Member.find({ _id: { $in: memberIds } }).lean();
    }
    if (inc.includes('categories')) {
        tasks.categories = Category.find({ accountId }).lean();
    }
    if (inc.includes('transactions')) {
        const tq: any = { accountId };
        if (status) tq.status = status;
        if (range) {
            // "month" stored as Date (1st of month) – filter by range
            tq.month = { $gte: range.start, $lt: range.end };
        }
        tasks.transactions = Transaction.find(tq).lean();
    }
    if (inc.includes('memberIncomes')) {
        const iq: any = { accountId };
        if (range) {
            // income active on intersection with [from,to)
            // (fromMonth/toMonth may be null -> treat as open range)
            iq.$or = [
                { fromMonth: { $lt: range.end }, toMonth: { $gte: range.start } },
                { fromMonth: { $lt: range.end }, toMonth: null },
                { fromMonth: null, toMonth: { $gte: range.start } },
                { fromMonth: null, toMonth: null }
            ];
        }
        tasks.memberIncomes = MemberIncome.find(iq).lean();
    }
    if (inc.includes('carryovers')) {
        const cq: any = { accountId };
        if (range) cq.month = { $gte: range.start, $lt: range.end };
        tasks.carryovers = CarryOver.find(cq).lean();
    }
    if (inc.includes('accountBalances')) {
        const bq: any = { accountId };
        if (range) bq.month = { $gte: range.start, $lt: range.end };
        tasks.accountBalances = AccountBalance.find(bq).lean();
    }
    if (inc.includes('categoryBudgets')) {
        const bq: any = { accountId };
        if (range) {
            // budgets valid within range
            bq.$or = [
                { fromMonth: { $lt: range.end }, toMonth: { $gte: range.start } },
                { fromMonth: { $lt: range.end }, toMonth: null },
                { fromMonth: null, toMonth: { $gte: range.start } },
                { fromMonth: null, toMonth: null }
            ];
        }
        tasks.categoryBudgets = CategoryBudget.find(bq).lean();
    }
    if (inc.includes('recurrences')) {
        const rq: any = { accountId };
        if (range) {
            // any recurrence with active range overlapping [from,to)
            rq.$or = [
                { activeFrom: { $lt: range.end }, activeUntil: { $gte: range.start } },
                { activeFrom: { $lt: range.end }, activeUntil: null }
            ];
        }
        tasks.recurrences = Recurrence.find(rq).lean();
    }

    const results = await Promise.all(Object.values(tasks));
    const keys = Object.keys(tasks);

    const expanded: any = { account: acc };
    keys.forEach((k, i) => (expanded[k] = results[i]));

    res.json(expanded);
});

/** Fail closed for legacy orphan members: only known provenance or fully accessible account membership permits assignment. */
async function assertAssignable(req: Parameters<typeof resolveAccountContext>[0], ids: string[], session: ClientSession) {
    for (const id of [...new Set(ids)].sort()) {
        const member = await Member.findById(id).select('+createdByUserId').session(session);
        if (!member) reject(422, 'MEMBER_NOT_ASSIGNABLE');
        if (member.userId && String(member.userId) !== req.user!.sub) reject(422, 'MEMBER_NOT_ASSIGNABLE');
        const accounts = await Account.find({ 'members.memberId': member._id }).session(session);
        if (!member.userId && accounts.length === 0 && String(member.createdByUserId ?? '') !== req.user!.sub) reject(422, 'MEMBER_NOT_ASSIGNABLE');
        for (const account of accounts) if (!(await resolveAccountContext(req, account._id, session))) reject(422, 'MEMBER_NOT_ASSIGNABLE');
    }
}
async function blockers(accountId: unknown, memberId: unknown, session: ClientSession) {
    if (await Transaction.exists({ accountId, paidByMemberId: memberId }).session(session)) reject(409, 'MEMBER_REFERENCED');
    if (await Category.exists({ accountId, 'customSplit.memberId': memberId }).session(session)) reject(409, 'MEMBER_REFERENCED');
    if (await ContributionRule.exists({ accountId, $or: [{ 'distribution.memberId': memberId }, { 'distribution.customSplit.memberId': memberId }] }).session(session)) reject(409, 'MEMBER_REFERENCED');
    if (await MemberIncome.exists({ accountId, memberId }).session(session)) reject(409, 'MEMBER_REFERENCED');
    if (await CarryOver.exists({ accountId, memberId }).session(session)) reject(409, 'MEMBER_REFERENCED');
    if (await Recurrence.exists({ accountId, createdByMemberId: memberId }).session(session)) reject(409, 'MEMBER_REFERENCED');
}

r.post('/', validateBody(CreateAccount), async (req, res) => {
    const b = CreateAccount.parse(req.body);
    const id = creationId(req, res, 'account', b);
    if (!id) return;
    return activityRoute(
        req,
        res,
        async (session, emit) => {
            if (await Account.exists({ _id: id }).session(session)) {
                const existingContext = await resolveAccountContext(req, id, session);
                if (!existingContext) reject(404, 'NOT_FOUND');
                await emit(existingContext, `account:create:${id}`, [{ code: 'account.created', subject: { kind: 'account', id: String(id) }, params: { currency: b.currency ?? 'EUR' } }], async () => {
                    reject(409, 'CREATION_ID_CONFLICT');
                });
                return creationReply(await Account.findById(id).session(session));
            }
            const requested = (b.members ?? []).map((m) => ({ ...m, memberId: m.memberId.toLowerCase() }));
            if (new Set(requested.map((m) => m.memberId)).size !== requested.length) reject(422, 'DUPLICATE_MEMBER');
            await assertAssignable(
                req,
                requested.map((m) => m.memberId),
                session
            );
            const linked = await Member.find({ userId: req.user!.sub }).session(session);
            const requestedOwn = requested.filter((m) => linked.some((own) => String(own._id) === m.memberId));
            if (requestedOwn.length > 1) reject(422, 'AMBIGUOUS_SELF_MEMBER');
            const self = requestedOwn.length ? linked.find((m) => String(m._id) === requestedOwn[0]!.memberId) : linked.length === 1 ? linked[0] : undefined;
            if (!self && linked.length > 1) reject(422, 'AMBIGUOUS_SELF_MEMBER');
            const selfId = self?._id ?? new Types.ObjectId(createHash('sha256').update(`self-member:${req.user!.sub}`).digest('hex').slice(0, 24));
            const creator = await User.findById(req.user!.sub, { name: 1, email: 1 }).session(session);
            // Preserve the requested display order; identity, never position, determines the self-owner.
            const members = requested.map((m) => ({ memberId: m.memberId, role: m.memberId === String(selfId) ? 'owner' : (m.role ?? 'member') }));
            if (!members.some((m) => m.memberId === String(selfId))) members.push({ memberId: String(selfId), role: 'owner' });
            const context = accountCreateContext(req, String(id), String(selfId));
            await emit(context, `account:create:${id}`, [{ code: 'account.created', subject: { kind: 'account', id: String(id) }, params: { currency: b.currency ?? 'EUR' } }], async () => {
                if (!self) await Member.create([{ _id: selfId, userId: req.user!.sub, createdByUserId: req.user!.sub, name: creator?.name ?? creator?.email ?? null }], { session });
                for (const memberId of [...new Set(members.map((m) => m.memberId))].sort()) await lockMemberRevision(memberId, session);
                await Account.create([{ ...b, _id: id, members }], { session });
                return true;
            });
            return creationReply(await Account.findById(id).session(session));
        },
        async (readSession) => creationReply(await Account.findById(id).session(readSession))
    );
});

/** Derive membership activity in deterministic member-id order; do not overload added for a role change. */
function membershipIntents(before: { memberId: unknown; role: string }[], after: { memberId: unknown; role: string }[]): ActivityIntent[] {
    const intents: ActivityIntent[] = [];
    const ids = [...new Set([...before, ...after].map((m) => String(m.memberId)))].sort();
    for (const id of ids) {
        const old = before.find((m) => String(m.memberId) === id);
        const next = after.find((m) => String(m.memberId) === id);
        const subject = { kind: 'member' as const, id };
        if (!old && next) intents.push({ code: 'account.member.added', subject, params: { memberId: id, role: next.role as 'owner' | 'member' } });
        else if (old && !next) intents.push({ code: 'account.member.removed', subject, params: { memberId: id } });
        else if (old && next && old.role !== next.role) intents.push({ code: 'account.member.roleChanged', subject, params: { memberId: id, from: old.role as 'owner' | 'member', to: next.role as 'owner' | 'member' } });
    }
    return intents;
}

/** All three owner endpoints share the same guarded domain mutation, not a generic public command API. */
async function changeAccount(req: Parameters<typeof resolveAccountContext>[0], res: Parameters<typeof requireOwnerContext>[1], mode: 'patch' | 'add' | 'remove') {
    const context = await requireOwnerContext(req, res, req.params.id);
    if (!context) return;
    const patchInput = mode === 'patch' ? UpdateAccount.parse(req.body) : {};
    const add = mode === 'add' ? AddMemberToAccount.parse(req.body) : null;
    if (add) add.memberId = add.memberId.toLowerCase();
    if (mode === 'remove' && !/^[a-f\d]{24}$/i.test(req.params.memberId ?? '')) return res.status(400).json({ error: 'INVALID_MEMBER_ID' });
    return activityRoute(req, res, async (session, emit) => {
        const prev = await Account.findById(context.account.accountId).session(session);
        if (!prev) return { status: 404 };
        const before = prev.members.map((m) => ({ memberId: String(m.memberId), role: m.role }));
        let next = before;
        if (patchInput.members) next = patchInput.members.map((m) => ({ memberId: m.memberId.toLowerCase(), role: m.role ?? 'member' }));
        if (add) next = [...before.filter((m) => m.memberId !== add.memberId), { memberId: add.memberId, role: add.role }];
        if (mode === 'remove') {
            if (!before.some((m) => m.memberId === req.params.memberId?.toLowerCase())) reject(404, 'MEMBER_NOT_IN_ACCOUNT');
            next = before.filter((m) => m.memberId !== req.params.memberId?.toLowerCase());
        }
        if (new Set(next.map((m) => m.memberId)).size !== next.length) reject(422, 'DUPLICATE_MEMBER');
        if (!next.some((m) => m.role === 'owner')) reject(409, mode === 'patch' ? 'NO_OWNER' : 'LAST_OWNER');
        const linked = await Member.find({ userId: req.user!.sub }).session(session);
        if (!next.some((m) => linked.some((own) => String(own._id) === m.memberId))) reject(409, 'CALLER_WOULD_LOSE_ACCESS');
        const ownerMembers = await Member.find({ _id: { $in: next.filter((m) => m.role === 'owner').map((m) => m.memberId) }, userId: { $ne: null } }).session(session);
        let verifiedOwner = false;
        const verifiedUsers: string[] = [];
        for (const owner of ownerMembers)
            if (await User.exists({ _id: owner.userId, isActive: true }).session(session)) {
                verifiedOwner = true;
                verifiedUsers.push(String(owner.userId));
            }
        if (!verifiedOwner) reject(409, mode === 'patch' ? 'NO_OWNER' : 'LAST_OWNER');
        await assertAssignable(
            req,
            next.filter((m) => !before.some((old) => old.memberId === m.memberId)).map((m) => m.memberId),
            session
        );
        for (const gone of before.filter((m) => !next.some((n) => n.memberId === m.memberId))) await blockers(prev._id, gone.memberId, session);
        const settings = { ...patchInput };
        delete settings.members;
        const normalized = new Account({ ...prev.toObject(), ...settings }).toObject() as unknown as Record<string, unknown>;
        const patch = changedPatch(prev.toObject(), Object.fromEntries(Object.keys(settings).map((key) => [key, normalized[key]])));
        const intents = membershipIntents(before, next);
        if (Object.keys(patch).length) intents.unshift({ code: 'account.settings.updated', subject: { kind: 'account', id: String(prev._id) }, params: { changedFields: Object.keys(patch) as ('name' | 'currency' | 'settings')[] } });
        if (!intents.length) return { status: 200, body: prev };
        const version = Number(prev.get('__v') ?? 0);
        if (!Number.isSafeInteger(version) || version < 0 || version === Number.MAX_SAFE_INTEGER) reject(409, 'ACCOUNT_REVISION_INVALID');
        await emit(context, `account:change:${prev._id}:${prev.get('__v')}`, intents, async () => {
            for (const userId of [...new Set(verifiedUsers)].sort()) await lockActivityUser(userId, session);
            for (const intent of intents.filter((i) => i.subject.kind === 'member').sort((a, b) => a.subject.id.localeCompare(b.subject.id))) await lockMemberRevision(intent.subject.id, session);
            await Account.updateOne({ _id: prev._id }, { $set: { ...patch, members: next, __v: version + 1 } }, { session });
            return true;
        });
        return { status: 200, body: await Account.findById(prev._id).session(session) };
    });
}
r.patch('/:id', validateBody(UpdateAccount), (req, res) => changeAccount(req, res, 'patch'));
r.post('/:id/members', validateBody(AddMemberToAccount), (req, res) => changeAccount(req, res, 'add'));
r.delete('/:id/members/:memberId', (req, res) => changeAccount(req, res, 'remove'));
export default r;

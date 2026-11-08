import { fingerprint } from '../services/creation-proof.js';
import Event from '../models/Event.js';
import { Router } from 'express';
import { Types } from 'mongoose';
import AccountBalance from '../models/AccountBalance.js';
import { toMonthDate } from '../lib/month.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { QueryAccountBalances, UpsertAccountBalance } from '../validation/account-balances.js';
import { accountScope, isObjectId } from '../auth/account-access.js';

import { requireAccountContext } from '../auth/account-context.js';
import { activityRoute, changedPatch } from '../services/activity-route.js';
import { monthKeyFromAnchor } from '@tobu/contracts/calendar';
const r = Router();

/** GET /api/account-balances?accountId=&from=YYYY-MM&to=YYYY-MM */
r.get('/', validateQuery(QueryAccountBalances), async (req, res) => {
    const { accountId, from, to } = (req as any).q;
    const q: any = {};
    const scope = await accountScope(req, res, accountId);
    if (!scope) return;
    q.accountId = Array.isArray(scope) ? { $in: scope } : scope;
    if (from || to) {
        q.month = {};
        if (from) q.month.$gte = toMonthDate(from);
        if (to) q.month.$lte = toMonthDate(to);
    }
    res.json(await AccountBalance.find(q).lean());
});

r.put('/', validateBody(UpsertAccountBalance), async (req, res) => {
    const b = UpsertAccountBalance.parse(req.body);
    const context = await requireAccountContext(req, res, b.accountId);
    if (!context) return;
    return activityRoute(req, res, async (session, emit) => {
        const key = { accountId: new Types.ObjectId(b.accountId), month: toMonthDate(b.month) };
        const existing = await AccountBalance.findOne(key).session(session);
        const values = { closingBalanceMinor: b.closingBalanceMinor };
        if (existing && !Object.keys(changedPatch(existing.toObject(), values)).length) return { status: 200, body: existing };
        const generation = existing
            ? String(existing.get('mutationVersion') ?? 0)
            : 'new-' + (await Event.countDocuments({ accountId: key.accountId, 'params.month': b.month, code: { $in: ['accountBalance.set', 'accountBalance.removed'] } }).session(session));
        const id = existing?._id ?? new Types.ObjectId(fingerprint({ resource: 'accountBalance', key, generation }).slice(0, 24));
        const prev = { ...key, ...values };
        await emit(
            context,
            `accountBalance:set:${id}:${existing ? 'update:' + generation : 'create'}`,
            [{ code: 'accountBalance.set', subject: { kind: 'accountBalance', id: String(id) }, params: { month: monthKeyFromAnchor(prev.month), closingBalanceMinor: prev.closingBalanceMinor } }],
            async () => {
                if (existing) await AccountBalance.updateOne({ _id: id }, { $set: values, $inc: { mutationVersion: 1 } }, { session });
                else await AccountBalance.create([{ ...key, ...values, _id: id }], { session });
                return true;
            }
        );
        return { status: 200, body: await AccountBalance.findById(id).session(session) };
    });
});
r.delete('/:id', async (req, res) => {
    const existing = isObjectId(req.params.id) ? await AccountBalance.findById(req.params.id).lean() : null;
    if (!existing) return res.sendStatus(404);
    const context = await requireAccountContext(req, res, existing.accountId);
    if (!context) return;
    return activityRoute(req, res, async (session, emit) => {
        const prev = await AccountBalance.findById(existing._id).session(session);
        if (!prev) return { status: 404 };
        await emit(
            context,
            `accountBalance:delete:${prev._id}:${prev.get('mutationVersion')}`,
            [{ code: 'accountBalance.removed', subject: { kind: 'accountBalance', id: String(prev._id) }, params: { month: prev.month ? monthKeyFromAnchor(prev.month) : null } }],
            async () => {
                await AccountBalance.deleteOne({ _id: prev._id }, { session });
                return true;
            }
        );
        return { status: 204 };
    });
});
export default r;

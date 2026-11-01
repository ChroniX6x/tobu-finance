import { Router } from 'express';
import { Types } from 'mongoose';
import AccountBalance from '../models/AccountBalance.js';
import { toMonthDate } from '../lib/month.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { QueryAccountBalances, UpsertAccountBalance } from '../validation/account-balances.js';
import { accountScope, isObjectId, requireAccountAccess } from '../auth/account-access.js';

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

/** PUT /api/account-balances  (Upsert je accountId+month) */
r.put('/', validateBody(UpsertAccountBalance), async (req, res) => {
    const b = (req as any).data;
    if (!(await requireAccountAccess(req, res, b.accountId))) return;
    const key = {
        accountId: new Types.ObjectId(b.accountId),
        month: toMonthDate(b.month)
    };
    const update = { $set: { closingBalanceMinor: b.closingBalanceMinor } };
    const doc = await AccountBalance.findOneAndUpdate(key, update, { new: true, upsert: true });
    res.json(doc);
});

/** DELETE /api/account-balances/:id */
r.delete('/:id', async (req, res) => {
    const existing = isObjectId(req.params.id) ? await AccountBalance.findById(req.params.id, { accountId: 1 }).lean() : null;
    if (!existing) return res.sendStatus(404);
    if (!(await requireAccountAccess(req, res, existing.accountId))) return;
    const ok = await AccountBalance.findByIdAndDelete(req.params.id);
    if (!ok) return res.sendStatus(404);
    res.sendStatus(204);
});

export default r;

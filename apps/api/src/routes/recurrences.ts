import { Router } from 'express';
import { Types } from 'mongoose';
import Recurrence from '../models/Recurrence.js';
import { toMonthDate } from '../lib/month.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { QueryRecurrences, CreateRecurrence, UpdateRecurrence } from '../validation/recurrences.js';
import { accountScope, foreignReference, isObjectId, requireAccountAccess } from '../auth/account-access.js';

const r = Router();

/** GET /api/recurrences?accountId=...&activeOn=YYYY-MM&nextFrom=ISO&nextTo=ISO – without accountId only the caller's accounts */
r.get('/', validateQuery(QueryRecurrences), async (req, res) => {
    const { accountId, activeOn, nextFrom, nextTo } = (req as any).q;
    const scope = await accountScope(req, res, accountId);
    if (!scope) return;
    const q: any = { accountId: Array.isArray(scope) ? { $in: scope } : scope };
    if (activeOn) {
        const M = toMonthDate(activeOn);
        q.$and = [{ $or: [{ activeFrom: null }, { activeFrom: { $lte: M } }] }, { $or: [{ activeUntil: null }, { activeUntil: { $gte: M } }] }];
    }
    if (nextFrom || nextTo) {
        q.nextPlanned = {};
        if (nextFrom) q.nextPlanned.$gte = new Date(nextFrom);
        if (nextTo) q.nextPlanned.$lte = new Date(nextTo);
    }
    res.json(await Recurrence.find(q).lean());
});

/** POST /api/recurrences */
r.post('/', validateBody(CreateRecurrence), async (req, res) => {
    const b = (req as any).data;
    if (!(await requireAccountAccess(req, res, b.accountId))) return;
    const foreign = await foreignReference(b.accountId, { categoryId: b.categoryId, memberIds: { createdByMemberId: b.createdByMemberId } });
    if (foreign) return res.status(422).json({ error: 'REFERENCE_NOT_IN_ACCOUNT', field: foreign });
    const doc: any = {
        accountId: new Types.ObjectId(b.accountId),
        categoryId: b.categoryId ? new Types.ObjectId(b.categoryId) : null,
        title: b.title ?? null,
        type: b.type,
        amountMinor: b.amountMinor,
        schedule: {
            freq: b.schedule?.freq ?? 'monthly',
            dayOfMonth: b.schedule?.dayOfMonth ?? 1
        },
        activeFrom: b.activeFrom ? toMonthDate(b.activeFrom) : new Date(),
        activeUntil: b.activeUntil ? toMonthDate(b.activeUntil) : null,
        createdByMemberId: b.createdByMemberId ? new Types.ObjectId(b.createdByMemberId) : null,
        nextPlanned: b.nextPlanned ? new Date(b.nextPlanned) : null,
        lastEmitted: b.lastEmitted ? new Date(b.lastEmitted) : null
    };
    const created = await Recurrence.create(doc);
    res.status(201).json(created);
});

/** PATCH /api/recurrences/:id – the account of a recurrence never changes */
r.patch('/:id', validateBody(UpdateRecurrence), async (req, res) => {
    const { id } = req.params;
    const u: any = { ...(req as any).data };
    const existing = isObjectId(id) ? await Recurrence.findById(id, { accountId: 1 }).lean() : null;
    if (!existing) return res.sendStatus(404);
    if (!(await requireAccountAccess(req, res, existing.accountId))) return;
    if (u.accountId !== undefined && String(u.accountId) !== String(existing.accountId)) return res.status(422).json({ error: 'ACCOUNT_IMMUTABLE' });
    delete u.accountId;
    const foreign = await foreignReference(existing.accountId, { categoryId: u.categoryId, memberIds: { createdByMemberId: u.createdByMemberId } });
    if (foreign) return res.status(422).json({ error: 'REFERENCE_NOT_IN_ACCOUNT', field: foreign });
    if ('categoryId' in u && u.categoryId) u.categoryId = new Types.ObjectId(u.categoryId);
    if ('createdByMemberId' in u && u.createdByMemberId) u.createdByMemberId = new Types.ObjectId(u.createdByMemberId);
    if ('activeFrom' in u && u.activeFrom) u.activeFrom = toMonthDate(u.activeFrom);
    if ('activeUntil' in u && u.activeUntil) u.activeUntil = toMonthDate(u.activeUntil);
    if ('nextPlanned' in u && u.nextPlanned) u.nextPlanned = new Date(u.nextPlanned);
    if ('lastEmitted' in u && u.lastEmitted) u.lastEmitted = new Date(u.lastEmitted);
    const updated = await Recurrence.findByIdAndUpdate(id, u, { new: true });
    if (!updated) return res.sendStatus(404);
    res.json(updated);
});

/** DELETE /api/recurrences/:id */
r.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const existing = isObjectId(id) ? await Recurrence.findById(id, { accountId: 1 }).lean() : null;
    if (!existing) return res.sendStatus(404);
    if (!(await requireAccountAccess(req, res, existing.accountId))) return;
    const ok = await Recurrence.findByIdAndDelete(id);
    if (!ok) return res.sendStatus(404);
    res.sendStatus(204);
});

export default r;

import { fingerprint } from '../services/creation-proof.js';
import Event from '../models/Event.js';
import { Router } from 'express';
import { Types } from 'mongoose';
import CarryOver from '../models/CarryOver.js';
import { toMonthDate } from '../lib/month.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { QueryCarryOvers, UpsertCarryOver } from '../validation/carryovers.js';
import { accountScope, isObjectId } from '../auth/account-access.js';

import { requireAccountContext } from '../auth/account-context.js';
import { activityRoute, changedPatch, validateReferences } from '../services/activity-route.js';
import { monthKeyFromAnchor } from '@tobu/contracts/calendar';
const r = Router();

/** GET /api/carryovers?accountId=&memberId=&from=YYYY-MM&to=YYYY-MM */
r.get('/', validateQuery(QueryCarryOvers), async (req, res) => {
    const { accountId, memberId, from, to } = (req as any).q;
    const q: any = {};
    const scope = await accountScope(req, res, accountId);
    if (!scope) return;
    q.accountId = Array.isArray(scope) ? { $in: scope } : scope;
    if (memberId) q.memberId = new Types.ObjectId(memberId);
    if (from || to) {
        q.month = {};
        if (from) q.month.$gte = toMonthDate(from);
        if (to) q.month.$lte = toMonthDate(to);
    }
    res.json(await CarryOver.find(q).lean());
});

r.put('/', validateBody(UpsertCarryOver), async (req, res) => {
    const b = UpsertCarryOver.parse(req.body);
    const context = await requireAccountContext(req, res, b.accountId);
    if (!context) return;
    return activityRoute(req, res, async (session, emit) => {
        await validateReferences(b.accountId, session, { memberIds: [b.memberId] });
        const key = { accountId: new Types.ObjectId(b.accountId), month: toMonthDate(b.month), memberId: new Types.ObjectId(b.memberId) };
        const existing = await CarryOver.findOne(key).session(session);
        const values = { amountMinor: b.amountMinor, reason: b.reason ?? '' };
        if (existing && !Object.keys(changedPatch(existing.toObject(), values)).length) return { status: 200, body: existing };
        const generation = existing
            ? String(existing.get('mutationVersion') ?? 0)
            : 'new-' + (await Event.countDocuments({ accountId: key.accountId, 'params.month': b.month, 'params.memberId': String(key.memberId), code: { $in: ['carryOver.set', 'carryOver.removed'] } }).session(session));
        const id = existing?._id ?? new Types.ObjectId(fingerprint({ resource: 'carryOver', key, generation }).slice(0, 24));
        const prev = { ...key, ...values };
        await emit(
            context,
            `carryOver:set:${id}:${existing ? 'update:' + generation : 'create'}`,
            [{ code: 'carryOver.set', subject: { kind: 'carryOver', id: String(id) }, params: { memberId: String(prev.memberId), month: monthKeyFromAnchor(prev.month), amountMinor: prev.amountMinor } }],
            async () => {
                if (existing) await CarryOver.updateOne({ _id: id }, { $set: values, $inc: { mutationVersion: 1 } }, { session });
                else await CarryOver.create([{ ...key, ...values, _id: id }], { session });
                return true;
            }
        );
        return { status: 200, body: await CarryOver.findById(id).session(session) };
    });
});
r.delete('/:id', async (req, res) => {
    const existing = isObjectId(req.params.id) ? await CarryOver.findById(req.params.id).lean() : null;
    if (!existing) return res.sendStatus(404);
    const context = await requireAccountContext(req, res, existing.accountId);
    if (!context) return;
    return activityRoute(req, res, async (session, emit) => {
        const prev = await CarryOver.findById(existing._id).session(session);
        if (!prev) return { status: 404 };
        await emit(
            context,
            `carryOver:delete:${prev._id}:${prev.get('mutationVersion')}`,
            [{ code: 'carryOver.removed', subject: { kind: 'carryOver', id: String(prev._id) }, params: { memberId: String(prev.memberId), month: prev.month ? monthKeyFromAnchor(prev.month) : null } }],
            async () => {
                await CarryOver.deleteOne({ _id: prev._id }, { session });
                return true;
            }
        );
        return { status: 204 };
    });
});
export default r;

import { QueryMemberIncomes } from '@tobu/contracts/read-queries';
import { Router } from 'express';
import { Types } from 'mongoose';
import MemberIncome from '../models/MemberIncome.js';
import { toMonthDate } from '../lib/month.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { CreateMemberIncome, UpdateMemberIncome } from '../validation/member-incomes.js';
import { accountScope, isObjectId } from '../auth/account-access.js';
import { requireAccountContext } from '../auth/account-context.js';
import { activityRoute, creationReply, changedPatch, validateReferences, DomainRejection } from '../services/activity-route.js';
import { creationId } from '../services/creation-proof.js';
import type { ActivityIntent } from '../services/activity-writer.js';
import { monthRangesOverlap } from '../utils/month-overlap.js';
const r = Router();
r.get('/', validateQuery(QueryMemberIncomes), async (req, res) => {
    const { accountId, memberId } = (req.query ?? {}) as { accountId?: string; memberId?: string };
    const scope = await accountScope(req, res, accountId);
    if (!scope) return;
    const q: Record<string, unknown> = { accountId: Array.isArray(scope) ? { $in: scope } : scope };
    if (memberId && /^[a-f\d]{24}$/i.test(memberId)) q.memberId = new Types.ObjectId(memberId);
    const items = await MemberIncome.find(q).lean();
    res.json(items);
});
r.post('/', validateBody(CreateMemberIncome), async (req, res) => {
    const b = CreateMemberIncome.parse(req.body);
    const context = await requireAccountContext(req, res, b.accountId);
    if (!context) return;
    const id = creationId(req, res, 'memberIncome', b);
    if (!id) return;
    return activityRoute(
        req,
        res,
        async (session, emit) => {
            await validateReferences(b.accountId, session, { memberIds: [b.memberId] });
            const values = { ...b, _id: id, fromMonth: b.fromMonth ? toMonthDate(b.fromMonth) : null, toMonth: b.toMonth ? toMonthDate(b.toMonth) : null };
            const siblings = await MemberIncome.find({ accountId: b.accountId, memberId: b.memberId, _id: { $ne: id } })
                .session(session)
                .lean();
            for (const sibling of siblings) if (monthRangesOverlap(values, sibling)) throw new DomainRejection(409, { code: 'INCOME_OVERLAP', message: 'The time range overlaps with an existing entry.' });
            const prev = values;
            await emit(
                context,
                `memberIncome:create:${id}`,
                [{ code: 'memberIncome.added', subject: { kind: 'memberIncome', id: String(id) }, params: { memberId: String(prev.memberId), amountMinor: prev.amountMinor } } as ActivityIntent],
                async () => {
                    await MemberIncome.create([values], { session });
                    return true;
                }
            );
            return creationReply(await MemberIncome.findById(id).session(session));
        },
        async (readSession) => creationReply(await MemberIncome.findById(id).session(readSession))
    );
});
r.patch('/:id', validateBody(UpdateMemberIncome), async (req, res) => {
    const b = UpdateMemberIncome.parse(req.body);
    const existing = isObjectId(req.params.id) ? await MemberIncome.findById(req.params.id).lean() : null;
    if (!existing) return res.sendStatus(404);
    const context = await requireAccountContext(req, res, existing.accountId);
    if (!context) return;
    return activityRoute(req, res, async (session, emit) => {
        const prev = await MemberIncome.findById(existing._id).session(session);
        if (!prev) return { status: 404 };
        await validateReferences(prev.accountId, session, { memberIds: [prev.memberId] });
        const values: Record<string, unknown> = { ...b };
        if (b.fromMonth !== undefined) values.fromMonth = b.fromMonth ? toMonthDate(b.fromMonth) : null;
        if (b.toMonth !== undefined) values.toMonth = b.toMonth ? toMonthDate(b.toMonth) : null;
        const patch = changedPatch(prev.toObject(), values);
        if (!Object.keys(patch).length) return { status: 200, body: prev };
        const siblings = await MemberIncome.find({ accountId: prev.accountId, memberId: prev.memberId, _id: { $ne: prev._id } })
            .session(session)
            .lean();
        const next = { fromMonth: b.fromMonth !== undefined ? (values.fromMonth as Date | null) : prev.fromMonth, toMonth: b.toMonth !== undefined ? (values.toMonth as Date | null) : prev.toMonth };
        for (const sibling of siblings) if (monthRangesOverlap(next, sibling)) throw new DomainRejection(409, { code: 'INCOME_OVERLAP', message: 'The time range overlaps with an existing entry.' });
        await emit(
            context,
            `memberIncome:patch:${prev._id}:${prev.get('mutationVersion')}`,
            [{ code: 'memberIncome.updated', subject: { kind: 'memberIncome', id: String(prev._id) }, params: { memberId: String(prev.memberId), amountMinor: b.amountMinor ?? prev.amountMinor } } as ActivityIntent],
            async () => {
                await MemberIncome.updateOne({ _id: prev._id }, { $set: patch, $inc: { mutationVersion: 1 } }, { session });
                return true;
            }
        );
        return { status: 200, body: await MemberIncome.findById(prev._id).session(session) };
    });
});
r.delete('/:id', async (req, res) => {
    const existing = isObjectId(req.params.id) ? await MemberIncome.findById(req.params.id).lean() : null;
    if (!existing) return res.sendStatus(404);
    const context = await requireAccountContext(req, res, existing.accountId);
    if (!context) return;
    return activityRoute(req, res, async (session, emit) => {
        const prev = await MemberIncome.findById(existing._id).session(session);
        if (!prev) return { status: 404 };
        await validateReferences(prev.accountId, session, { memberIds: [prev.memberId] });
        await emit(
            context,
            `memberIncome:delete:${prev._id}:${prev.get('mutationVersion')}`,
            [{ code: 'memberIncome.removed', subject: { kind: 'memberIncome', id: String(prev._id) }, params: { memberId: String(prev.memberId) } } as ActivityIntent],
            async () => {
                await MemberIncome.deleteOne({ _id: prev._id }, { session });
                return true;
            }
        );
        return { status: 204 };
    });
});
export default r;

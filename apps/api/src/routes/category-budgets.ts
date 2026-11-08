import { QueryCategoryBudgets } from '@tobu/contracts/read-queries';
import { Router } from 'express';
import { Types } from 'mongoose';
import CategoryBudget from '../models/CategoryBudget.js';
import { toMonthDate } from '../lib/month.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { CreateCategoryBudget, UpdateCategoryBudget } from '../validation/category-budgets.js';
import { accountScope, isObjectId } from '../auth/account-access.js';
import { requireAccountContext } from '../auth/account-context.js';
import { activityRoute, creationReply, changedPatch, validateReferences, DomainRejection } from '../services/activity-route.js';
import { creationId } from '../services/creation-proof.js';
import type { ActivityIntent } from '../services/activity-writer.js';
import { monthRangesOverlap } from '../utils/month-overlap.js';
import { regenerateBaseRules } from '../services/contribution-rule-generator.js';
const r = Router();
r.get('/', validateQuery(QueryCategoryBudgets), async (req, res) => {
    const { accountId, categoryId } = (req.query ?? {}) as { accountId?: string; categoryId?: string };
    const scope = await accountScope(req, res, accountId);
    if (!scope) return;
    const q: Record<string, unknown> = { accountId: Array.isArray(scope) ? { $in: scope } : scope };
    if (categoryId && /^[a-f\d]{24}$/i.test(categoryId)) q.categoryId = new Types.ObjectId(categoryId);
    const items = await CategoryBudget.find(q).lean();
    res.json(items);
});
r.post('/', validateBody(CreateCategoryBudget), async (req, res) => {
    const b = CreateCategoryBudget.parse(req.body);
    const context = await requireAccountContext(req, res, b.accountId);
    if (!context) return;
    const id = creationId(req, res, 'categoryBudget', b);
    if (!id) return;
    return activityRoute(
        req,
        res,
        async (session, emit) => {
            await validateReferences(b.accountId, session, { categoryId: b.categoryId });
            const values = { ...b, _id: id, fromMonth: b.fromMonth ? toMonthDate(b.fromMonth) : null, toMonth: b.toMonth ? toMonthDate(b.toMonth) : null };
            const siblings = await CategoryBudget.find({ accountId: b.accountId, categoryId: b.categoryId, _id: { $ne: id } })
                .session(session)
                .lean();
            for (const sibling of siblings) if (monthRangesOverlap(values, sibling)) throw new DomainRejection(409, { code: 'BUDGET_OVERLAP', message: 'The time range overlaps with an existing entry.' });
            const prev = values;
            await emit(
                context,
                `categoryBudget:create:${id}`,
                [{ code: 'categoryBudget.added', subject: { kind: 'categoryBudget', id: String(id) }, params: { categoryId: String(prev.categoryId), amountMinor: prev.amountMinor } } as ActivityIntent],
                async () => {
                    await CategoryBudget.create([values], { session });
                    await regenerateBaseRules(new Types.ObjectId(String(prev.accountId)), session);
                    return true;
                }
            );
            return creationReply(await CategoryBudget.findById(id).session(session));
        },
        async (readSession) => creationReply(await CategoryBudget.findById(id).session(readSession))
    );
});
r.patch('/:id', validateBody(UpdateCategoryBudget), async (req, res) => {
    const b = UpdateCategoryBudget.parse(req.body);
    const existing = isObjectId(req.params.id) ? await CategoryBudget.findById(req.params.id).lean() : null;
    if (!existing) return res.sendStatus(404);
    const context = await requireAccountContext(req, res, existing.accountId);
    if (!context) return;
    return activityRoute(req, res, async (session, emit) => {
        const prev = await CategoryBudget.findById(existing._id).session(session);
        if (!prev) return { status: 404 };
        await validateReferences(prev.accountId, session, { categoryId: prev.categoryId });
        const values: Record<string, unknown> = { ...b };
        if (b.fromMonth !== undefined) values.fromMonth = b.fromMonth ? toMonthDate(b.fromMonth) : null;
        if (b.toMonth !== undefined) values.toMonth = b.toMonth ? toMonthDate(b.toMonth) : null;
        const patch = changedPatch(prev.toObject(), values);
        if (!Object.keys(patch).length) return { status: 200, body: prev };
        const siblings = await CategoryBudget.find({ accountId: prev.accountId, categoryId: prev.categoryId, _id: { $ne: prev._id } })
            .session(session)
            .lean();
        const next = { fromMonth: b.fromMonth !== undefined ? (values.fromMonth as Date | null) : prev.fromMonth, toMonth: b.toMonth !== undefined ? (values.toMonth as Date | null) : prev.toMonth };
        for (const sibling of siblings) if (monthRangesOverlap(next, sibling)) throw new DomainRejection(409, { code: 'BUDGET_OVERLAP', message: 'The time range overlaps with an existing entry.' });
        await emit(
            context,
            `categoryBudget:patch:${prev._id}:${prev.get('mutationVersion')}`,
            [{ code: 'categoryBudget.updated', subject: { kind: 'categoryBudget', id: String(prev._id) }, params: { categoryId: String(prev.categoryId), amountMinor: b.amountMinor ?? prev.amountMinor } } as ActivityIntent],
            async () => {
                await CategoryBudget.updateOne({ _id: prev._id }, { $set: patch, $inc: { mutationVersion: 1 } }, { session });
                await regenerateBaseRules(new Types.ObjectId(String(prev.accountId)), session);
                return true;
            }
        );
        return { status: 200, body: await CategoryBudget.findById(prev._id).session(session) };
    });
});
r.delete('/:id', async (req, res) => {
    const existing = isObjectId(req.params.id) ? await CategoryBudget.findById(req.params.id).lean() : null;
    if (!existing) return res.sendStatus(404);
    const context = await requireAccountContext(req, res, existing.accountId);
    if (!context) return;
    return activityRoute(req, res, async (session, emit) => {
        const prev = await CategoryBudget.findById(existing._id).session(session);
        if (!prev) return { status: 404 };
        await validateReferences(prev.accountId, session, { categoryId: prev.categoryId });
        await emit(
            context,
            `categoryBudget:delete:${prev._id}:${prev.get('mutationVersion')}`,
            [{ code: 'categoryBudget.removed', subject: { kind: 'categoryBudget', id: String(prev._id) }, params: { categoryId: String(prev.categoryId) } } as ActivityIntent],
            async () => {
                await CategoryBudget.deleteOne({ _id: prev._id }, { session });
                await regenerateBaseRules(new Types.ObjectId(String(prev.accountId)), session);
                return true;
            }
        );
        return { status: 204 };
    });
});
export default r;

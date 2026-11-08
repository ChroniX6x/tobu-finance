import { Router } from 'express';
import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';
import CategoryBudget from '../models/CategoryBudget.js';
import Recurrence from '../models/Recurrence.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { QueryCategories, CreateCategory, UpdateCategory } from '../validation/categories.js';
import { accountScope, isObjectId } from '../auth/account-access.js';

import { requireAccountContext } from '../auth/account-context.js';
import { activityRoute, creationReply, changedPatch, validateReferences, reject } from '../services/activity-route.js';
import { creationId } from '../services/creation-proof.js';
const r = Router();

/** GET /api/categories?accountId=... – without accountId only the categories of the caller's accounts */
r.get('/', validateQuery(QueryCategories), async (req, res) => {
    const { accountId } = (req as any).q;
    const scope = await accountScope(req, res, accountId);
    if (!scope) return;
    const items = await Category.find({ accountId: Array.isArray(scope) ? { $in: scope } : scope }).lean();
    res.json(items);
});

/** All writes and their activity share one H02 transaction. */
r.post('/', validateBody(CreateCategory), async (req, res) => {
    const b = CreateCategory.parse(req.body);
    const context = await requireAccountContext(req, res, b.accountId);
    if (!context) return;
    const id = creationId(req, res, 'category', b);
    if (!id) return;
    return activityRoute(
        req,
        res,
        async (session, emit) => {
            await validateReferences(b.accountId, session, { memberIds: (b.customSplit ?? []).map((s) => s.memberId) });
            await emit(context, `category:create:${id}`, [{ code: 'category.created', subject: { kind: 'category', id: String(id) }, params: { categoryId: String(id), name: b.name ?? null } }], async () => {
                await Category.create([{ ...b, _id: id }], { session });
                return true;
            });
            return creationReply(await Category.findById(id).session(session));
        },
        async (readSession) => creationReply(await Category.findById(id).session(readSession))
    );
});
r.patch('/:id', validateBody(UpdateCategory), async (req, res) => {
    const b = UpdateCategory.parse(req.body);
    const existing = isObjectId(req.params.id) ? await Category.findById(req.params.id).lean() : null;
    if (!existing) return res.sendStatus(404);
    const context = await requireAccountContext(req, res, existing.accountId);
    if (!context) return;
    if (b.accountId && String(b.accountId) !== String(existing.accountId)) return res.status(422).json({ error: 'ACCOUNT_IMMUTABLE' });
    return activityRoute(req, res, async (session, emit) => {
        const prev = await Category.findById(existing._id).session(session);
        if (!prev) return { status: 404 };
        await validateReferences(prev.accountId, session, { memberIds: (b.customSplit ?? prev.customSplit ?? []).map((s) => s.memberId) });
        const values = { ...b };
        delete values.accountId;
        if (values.customSplit) values.customSplit = values.customSplit.map((s) => ({ ...s, memberId: s.memberId.toLowerCase() }));
        const patch = changedPatch(prev.toObject(), values);
        if (!Object.keys(patch).length) return { status: 200, body: prev };
        await emit(
            context,
            `category:patch:${prev._id}:${prev.get('mutationVersion')}`,
            [{ code: 'category.updated', subject: { kind: 'category', id: String(prev._id) }, params: { categoryId: String(prev._id), changedFields: Object.keys(patch) as ('name' | 'customSplit')[] } }],
            async () => {
                await Category.updateOne({ _id: prev._id }, { $set: patch, $inc: { mutationVersion: 1 } }, { session });
                return true;
            }
        );
        return { status: 200, body: await Category.findById(prev._id).session(session) };
    });
});
r.delete('/:id', async (req, res) => {
    if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'INVALID_ID' });
    const existing = await Category.findById(req.params.id).lean();
    if (!existing) return res.sendStatus(404);
    const context = await requireAccountContext(req, res, existing.accountId);
    if (!context) return;
    return activityRoute(req, res, async (session, emit) => {
        const prev = await Category.findById(existing._id).session(session);
        if (!prev) return { status: 404 };
        await validateReferences(prev.accountId, session, { memberIds: prev.customSplit.map((s) => s.memberId) });
        if (await Transaction.exists({ categoryId: prev._id }).session(session)) reject(409, 'CATEGORY_REFERENCED');
        if (await CategoryBudget.exists({ categoryId: prev._id }).session(session)) reject(409, 'CATEGORY_REFERENCED');
        if (await Recurrence.exists({ categoryId: prev._id }).session(session)) reject(409, 'CATEGORY_REFERENCED');
        await emit(
            context,
            `category:delete:${prev._id}:${prev.get('mutationVersion')}`,
            [{ code: 'category.deleted', subject: { kind: 'category', id: String(prev._id) }, params: { categoryId: String(prev._id), name: prev.name ?? null } }],
            async () => {
                await Category.deleteOne({ _id: prev._id }, { session });
                return true;
            }
        );
        return { status: 204 };
    });
});
export default r;

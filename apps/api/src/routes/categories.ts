import { Router } from 'express';
import { Types } from 'mongoose';
import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';
import CategoryBudget from '../models/CategoryBudget.js';
import Recurrence from '../models/Recurrence.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { QueryCategories, CreateCategory, UpdateCategory } from '../validation/categories.js';
import { accountScope, foreignReference, isObjectId, requireAccountAccess } from '../auth/account-access.js';

const r = Router();

/** Member ids named by a (validated) customSplit, keyed by their position for the error message. */
function splitMemberIds(customSplit: unknown): Record<string, unknown> {
    const ids: Record<string, unknown> = {};
    if (Array.isArray(customSplit)) customSplit.forEach((s, i) => (ids[`customSplit.${i}.memberId`] = (s as { memberId?: unknown })?.memberId));
    return ids;
}

/** GET /api/categories?accountId=... – without accountId only the categories of the caller's accounts */
r.get('/', validateQuery(QueryCategories), async (req, res) => {
    const { accountId } = (req as any).q;
    const scope = await accountScope(req, res, accountId);
    if (!scope) return;
    const items = await Category.find({ accountId: Array.isArray(scope) ? { $in: scope } : scope }).lean();
    res.json(items);
});

/** POST /api/categories { accountId, name, customSplit? } */
r.post('/', validateBody(CreateCategory), async (req, res) => {
    const b = (req as any).data;
    if (!(await requireAccountAccess(req, res, b.accountId))) return;
    const foreign = await foreignReference(b.accountId, { memberIds: splitMemberIds(b.customSplit) });
    if (foreign) return res.status(422).json({ error: 'REFERENCE_NOT_IN_ACCOUNT', field: foreign });
    const doc: any = {
        accountId: new Types.ObjectId(b.accountId),
        name: b.name ?? null,
        customSplit: Array.isArray(b.customSplit)
            ? b.customSplit.map((x: any) => ({
                  memberId: new Types.ObjectId(x.memberId),
                  split: x.split
              }))
            : []
    };
    const created = await Category.create(doc);
    res.status(201).json(created);
});

/** PATCH /api/categories/:id – the account of a category never changes */
r.patch('/:id', validateBody(UpdateCategory), async (req, res) => {
    const { id } = req.params;
    const u: any = { ...(req as any).data };
    const existing = isObjectId(id) ? await Category.findById(id).lean() : null;
    if (!existing) return res.sendStatus(404);
    if (!(await requireAccountAccess(req, res, existing.accountId))) return;
    if (u.accountId !== undefined && String(u.accountId) !== String(existing.accountId)) return res.status(422).json({ error: 'ACCOUNT_IMMUTABLE' });
    delete u.accountId;
    if (Array.isArray(u.customSplit)) {
        const foreign = await foreignReference(existing.accountId, { memberIds: splitMemberIds(u.customSplit) });
        if (foreign) return res.status(422).json({ error: 'REFERENCE_NOT_IN_ACCOUNT', field: foreign });
        u.customSplit = u.customSplit.map((x: any) => ({
            memberId: new Types.ObjectId(x.memberId),
            split: x.split
        }));
    }
    const updated = await Category.findByIdAndUpdate(id, u, { new: true });
    if (!updated) return res.sendStatus(404);
    res.json(updated);
});

/** DELETE /api/categories/:id */
r.delete('/:id', async (req, res) => {
    const { id } = req.params;
    if (!/^[a-f\d]{24}$/i.test(id)) return res.status(400).json({ error: 'INVALID_ID' });

    const existing = await Category.findById(id, { accountId: 1 }).lean();
    if (!existing) return res.sendStatus(404);
    if (!(await requireAccountAccess(req, res, existing.accountId))) return;

    const catId = new Types.ObjectId(id);

    // Guard: category still referenced
    const [txRef, budgetRef, recRef] = await Promise.all([Transaction.exists({ categoryId: catId }), CategoryBudget.exists({ categoryId: catId }), Recurrence.exists({ categoryId: catId })]);

    const blockers: string[] = [];
    if (txRef) blockers.push('Wird in Buchungen verwendet');
    if (budgetRef) blockers.push('Hat ein aktives Budget');
    if (recRef) blockers.push('Wird in Wiederkehrer verwendet');

    if (blockers.length > 0) {
        return res.status(409).json({ error: 'CATEGORY_REFERENCED', usageHints: blockers });
    }

    const ok = await Category.findByIdAndDelete(id);
    if (!ok) return res.sendStatus(404);
    res.sendStatus(204);
});

export default r;

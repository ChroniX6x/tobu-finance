import { QueryCategoryBudgets } from '@tobu/contracts/read-queries';
import { Router, type Response } from 'express';
import mongoose, { Types, type ClientSession } from 'mongoose';
import { DateTime } from 'luxon';

import Account from '../models/Account.js';
import CategoryBudget from '../models/CategoryBudget.js';
import Event from '../models/Event.js';
import { toMonthDate } from '../lib/month.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { CreateCategoryBudget, UpdateCategoryBudget } from '../validation/category-budgets.js';
import { monthRangesOverlap } from '../utils/month-overlap.js';
import { regenerateBaseRules } from '../services/contribution-rule-generator.js';
import { accountScope, foreignReference, isObjectId, requireAccountAccess } from '../auth/account-access.js';

const r = Router();

type Outcome = { status: number; body?: unknown };

class Rejected extends Error {
    constructor(readonly outcome: Outcome) {
        super(`rejected ${outcome.status}`);
    }
}

/**
 * Budget, event and the rebuilt base rules commit together or not at all. A write to the account document first
 * serializes concurrent budget writes of one account (MongoDB aborts and reruns one of them against the committed
 * state), so the base rules always match the final set of budgets. A rejected request (409, 404, ...) aborts the
 * transaction, so not even that serializing write is kept: rejected requests write nothing.
 */
async function writeAtomically(res: Response, accountId: Types.ObjectId, work: (session: ClientSession) => Promise<Outcome>) {
    let outcome: Outcome;
    try {
        outcome = await mongoose.connection.transaction(async (session) => {
            const lock = await Account.updateOne({ _id: accountId }, { $set: { updatedAt: new Date() } }, { session, timestamps: false });
            if (lock.matchedCount === 0) throw new Rejected({ status: 404 });
            const result = await work(session);
            if (result.status >= 400) throw new Rejected(result);
            return result;
        });
    } catch (error) {
        if (!(error instanceof Rejected)) throw error;
        outcome = error.outcome;
    }
    return outcome.body === undefined ? res.sendStatus(outcome.status) : res.status(outcome.status).json(outcome.body);
}

/** GET /api/category-budgets?accountId=...&categoryId=... */
r.get('/', validateQuery(QueryCategoryBudgets), async (req, res) => {
    const { accountId, categoryId } = (req.query ?? {}) as { accountId?: string; categoryId?: string };
    const scope = await accountScope(req, res, accountId);
    if (!scope) return;
    const q: Record<string, unknown> = { accountId: Array.isArray(scope) ? { $in: scope } : scope };
    if (categoryId && /^[a-f\d]{24}$/i.test(categoryId)) q.categoryId = new Types.ObjectId(categoryId);
    const items = await CategoryBudget.find(q).lean();
    res.json(items);
});

/** POST /api/category-budgets */
r.post('/', validateBody(CreateCategoryBudget), async (req, res) => {
    const b = (
        req as unknown as {
            data: {
                accountId: string;
                categoryId: string;
                amountMinor: number;
                fromMonth?: string | null;
                toMonth?: string | null;
            };
        }
    ).data;

    if (!(await requireAccountAccess(req, res, b.accountId))) return;
    const foreign = await foreignReference(b.accountId, { categoryId: b.categoryId });
    if (foreign) return res.status(422).json({ error: 'REFERENCE_NOT_IN_ACCOUNT', field: foreign });

    const accountId = new Types.ObjectId(b.accountId);
    const newFrom = b.fromMonth ? toMonthDate(b.fromMonth) : null;
    const newTo = b.toMonth ? toMonthDate(b.toMonth) : null;

    return writeAtomically(res, accountId, async (session) => {
        // Overlap check: no two budgets for the same category may overlap in time
        const siblings = await CategoryBudget.find({ accountId, categoryId: new Types.ObjectId(b.categoryId) }, null, { session }).lean();

        for (const s of siblings) {
            if (monthRangesOverlap({ fromMonth: newFrom, toMonth: newTo }, { fromMonth: s.fromMonth as unknown as Date | null, toMonth: s.toMonth as unknown as Date | null })) {
                return {
                    status: 409,
                    body: { code: 'BUDGET_OVERLAP', message: 'A budget for this category already covers the given time range.' }
                };
            }
        }

        const [created] = await CategoryBudget.create([{ accountId, categoryId: new Types.ObjectId(b.categoryId), amountMinor: b.amountMinor, fromMonth: newFrom, toMonth: newTo }], { session });

        await Event.create(
            [
                {
                    accountId,
                    date: DateTime.utc().toJSDate(),
                    code: 'categoryBudget.added',
                    params: { categoryId: b.categoryId, amountMinor: b.amountMinor },
                    createdByMemberId: null
                }
            ],
            { session }
        );

        await regenerateBaseRules(accountId, session);

        return { status: 201, body: created };
    });
});

/** PATCH /api/category-budgets/:id */
r.patch('/:id', validateBody(UpdateCategoryBudget), async (req, res) => {
    const { id } = req.params;

    const u = (
        req as unknown as {
            data: Partial<{ amountMinor: number; fromMonth: string | null; toMonth: string | null }>;
        }
    ).data;

    const found = isObjectId(id) ? await CategoryBudget.findById(id, { accountId: 1 }).lean() : null;
    if (!found) return res.sendStatus(404);
    if (!(await requireAccountAccess(req, res, found.accountId))) return;

    return writeAtomically(res, found.accountId as Types.ObjectId, async (session) => {
        const existing = await CategoryBudget.findById(id).session(session);
        if (!existing) return { status: 404 };

        // Resolve effective new range (fall back to existing values if not in patch)
        const newFrom = u.fromMonth !== undefined ? (u.fromMonth ? toMonthDate(u.fromMonth) : null) : (existing.fromMonth as unknown as Date | null);
        const newTo = u.toMonth !== undefined ? (u.toMonth ? toMonthDate(u.toMonth) : null) : (existing.toMonth as unknown as Date | null);

        // Overlap check (exclude self)
        const siblings = await CategoryBudget.find({ accountId: existing.accountId, categoryId: existing.categoryId, _id: { $ne: existing._id } }, null, { session }).lean();

        for (const s of siblings) {
            if (monthRangesOverlap({ fromMonth: newFrom, toMonth: newTo }, { fromMonth: s.fromMonth as unknown as Date | null, toMonth: s.toMonth as unknown as Date | null })) {
                return {
                    status: 409,
                    body: { code: 'BUDGET_OVERLAP', message: 'The updated time range overlaps with another budget for the same category.' }
                };
            }
        }

        const patch: Record<string, unknown> = {};
        if (typeof u.amountMinor === 'number') patch.amountMinor = u.amountMinor;
        if (u.fromMonth !== undefined) patch.fromMonth = newFrom;
        if (u.toMonth !== undefined) patch.toMonth = newTo;

        const updated = await CategoryBudget.findByIdAndUpdate(id, patch, { new: true, session });
        if (!updated) return { status: 404 };

        await Event.create(
            [
                {
                    accountId: updated.accountId as unknown as Types.ObjectId,
                    date: DateTime.utc().toJSDate(),
                    code: 'categoryBudget.updated',
                    params: { categoryId: String(updated.categoryId), amountMinor: (updated as { amountMinor?: number }).amountMinor ?? 0 },
                    createdByMemberId: null
                }
            ],
            { session }
        );

        await regenerateBaseRules(updated.accountId as unknown as Types.ObjectId, session);

        return { status: 200, body: updated };
    });
});

/** DELETE /api/category-budgets/:id */
r.delete('/:id', async (req, res) => {
    const { id } = req.params;

    const found = isObjectId(id) ? await CategoryBudget.findById(id, { accountId: 1 }).lean() : null;
    if (!found) return res.sendStatus(404);
    if (!(await requireAccountAccess(req, res, found.accountId))) return;

    return writeAtomically(res, found.accountId as Types.ObjectId, async (session) => {
        const existing = await CategoryBudget.findById(id).session(session);
        if (!existing) return { status: 404 };

        await CategoryBudget.deleteOne({ _id: id }, { session });

        await Event.create(
            [
                {
                    accountId: existing.accountId as unknown as Types.ObjectId,
                    date: DateTime.utc().toJSDate(),
                    code: 'categoryBudget.removed',
                    params: { categoryId: String(existing.categoryId) },
                    createdByMemberId: null
                }
            ],
            { session }
        );

        await regenerateBaseRules(existing.accountId as unknown as Types.ObjectId, session);

        return { status: 204 };
    });
});

export default r;

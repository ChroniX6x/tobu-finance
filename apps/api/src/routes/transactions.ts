import { Router, type Response } from 'express';
import mongoose, { Types, type ClientSession } from 'mongoose';
import Transaction from '../models/Transaction.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { CreateTx, PatchTx, QueryTx, monthFromYYYYMM } from '../validation/transactions.js';
import Event from '../models/Event.js';
import { DateTime } from 'luxon';
import { childDatesAgree, resolveCreateDates, resolvePatchDates, type MonthRuleError } from '../lib/transaction-dates.js';

const r = Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Business rule violation inside a transaction: aborts it and is answered with the given status/body. */
class HttpError extends Error {
    constructor(
        readonly status: number,
        readonly body: Record<string, unknown>
    ) {
        super(String(body.error));
    }
}

const monthRuleStatus = (error: MonthRuleError) => (error === 'MONTH_REQUIRED' ? { status: 422, body: { error, message: 'Provide bookDate or month.' } } : { status: 422, body: { error } });

function failMonthRule(error: MonthRuleError): never {
    const { status, body } = monthRuleStatus(error);
    throw new HttpError(status, body);
}

/** Runs the write in one MongoDB transaction (parent, children and events commit or roll back together). */
async function writeAtomically(res: Response, work: (session: ClientSession) => Promise<{ status: number; body?: unknown }>) {
    try {
        const result = await mongoose.connection.transaction(work);
        if (result.body === undefined) return res.sendStatus(result.status);
        return res.status(result.status).json(result.body);
    } catch (error) {
        if (error instanceof HttpError) return res.status(error.status).json(error.body);
        throw error;
    }
}

/**
 * Serializes concurrent split writes: children are separate documents, so two transactions that only read the parent
 * would not conflict (write skew: split sum, children left behind after a date change). A write to the parent makes
 * them conflict; MongoDB aborts one and the driver reruns it against the committed state.
 */
async function lockParent(parentId: Types.ObjectId, session: ClientSession): Promise<void> {
    await Transaction.updateOne({ _id: parentId }, { $set: { updatedAt: new Date() } }, { session, timestamps: false });
}

/** Sum amountMinor of all direct children of a parent (excluding one optional id). */
async function sumChildren(parentId: Types.ObjectId, session: ClientSession, excludeId?: Types.ObjectId): Promise<number> {
    const match: Record<string, unknown> = { parentTransactionId: parentId };
    if (excludeId) match._id = { $ne: excludeId };
    const agg = await Transaction.aggregate<{ total: number }>([{ $match: match }, { $group: { _id: null, total: { $sum: '$amountMinor' } } }]).session(session);
    return agg[0]?.total ?? 0;
}

// ─── GET /api/transactions ────────────────────────────────────────────────────

r.get('/', validateQuery(QueryTx), async (req, res) => {
    const { accountId, month, monthFrom, monthTo, status, q: search, parentTransactionId: ptxId, categoryIds, page, pageSize, sort } = (req as any).q;

    // Determine mode: parent-list mode (default) vs. child-list mode (explicit ObjectId)
    const isParentMode = !ptxId || ptxId === 'null';

    const filter: Record<string, unknown> = {
        accountId: new Types.ObjectId(accountId),
        parentTransactionId: isParentMode ? null : new Types.ObjectId(ptxId)
    };

    if (status) filter.status = status;

    // Build $or clauses for category and search filters
    const orClauses: Array<Record<string, unknown>> = [];

    // Category filter with support for __UNCATEGORIZED__ marker
    // Ensure categoryIds is always an array (query parsers might return string for single value)
    const categoryIdsArray = categoryIds ? (Array.isArray(categoryIds) ? categoryIds : [categoryIds]) : [];

    if (categoryIdsArray.length > 0) {
        const hasUncategorized = categoryIdsArray.includes('__UNCATEGORIZED__');
        const realCategoryIds = categoryIdsArray.filter((id: string) => id !== '__UNCATEGORIZED__').map((id: string) => new Types.ObjectId(id));

        if (hasUncategorized && realCategoryIds.length > 0) {
            // Combine: uncategorized OR specific categories
            orClauses.push({ categoryId: null });
            orClauses.push({ categoryId: { $in: realCategoryIds } });
        } else if (hasUncategorized) {
            // Only uncategorized
            filter.categoryId = null;
        } else if (realCategoryIds.length > 0) {
            // Only specific categories
            filter.categoryId = { $in: realCategoryIds };
        }
    }

    if (month) {
        filter.month = monthFromYYYYMM(month);
    } else if (monthFrom || monthTo) {
        const range: Record<string, Date> = {};
        if (monthFrom) range.$gte = monthFromYYYYMM(monthFrom);
        if (monthTo) range.$lte = monthFromYYYYMM(monthTo);
        filter.month = range;
    }

    // Search filter
    if (search) {
        const searchOr = [{ title: { $regex: search, $options: 'i' } }, { notes: { $regex: search, $options: 'i' } }];

        // If we already have category OR clauses, we need to combine with $and
        if (orClauses.length > 0) {
            filter.$and = [{ $or: orClauses }, { $or: searchOr }];
        } else {
            filter.$or = searchOr;
        }
    } else if (orClauses.length > 0) {
        // Only category OR clauses, no search
        filter.$or = orClauses;
    }

    const sortField = sort.startsWith('amount') ? 'amountMinor' : 'bookDate';
    const sortDir = sort.endsWith('Asc') ? 1 : -1;
    const skip = (page - 1) * pageSize;

    const [parents, total] = await Promise.all([
        Transaction.find(filter)
            .sort({ [sortField]: sortDir, _id: 1 })
            .skip(skip)
            .limit(pageSize)
            .lean(),
        Transaction.countDocuments(filter)
    ]);

    let items: unknown[];

    if (isParentMode && parents.length > 0) {
        // Batch-fetch all children for the returned page of parents in one query
        const parentIds = parents.map((p) => p._id);
        const allChildren = await Transaction.find({ parentTransactionId: { $in: parentIds } })
            .sort({ amountMinor: -1, _id: 1 })
            .lean();

        // Group children by parentTransactionId string key
        const childMap = new Map<string, typeof allChildren>();
        for (const child of allChildren) {
            const pid = (child.parentTransactionId as Types.ObjectId).toString();
            if (!childMap.has(pid)) childMap.set(pid, []);
            childMap.get(pid)!.push(child);
        }

        items = parents.map((p) => ({
            ...p,
            children: childMap.get((p._id as Types.ObjectId).toString()) ?? []
        }));
    } else {
        // Child-list mode or empty page: no embedding needed
        items = parents;
    }

    res.json({ items, total, page, pageSize });
});

// ─── POST /api/transactions ───────────────────────────────────────────────────

r.post('/', validateBody(CreateTx), async (req, res) => {
    const b = (req as any).data;
    const isChild = !!b.parentTransactionId;
    const dates = resolveCreateDates(b.bookDate, b.month);
    if (!dates.ok) {
        const { status, body } = monthRuleStatus(dates.error);
        return res.status(status).json(body);
    }

    return writeAtomically(res, async (session) => {
        let parentDoc: InstanceType<typeof Transaction> | null = null;

        if (isChild) {
            // The parent is looked up inside the target account, so a parent of another account is never even read.
            parentDoc = await Transaction.findOne({ _id: b.parentTransactionId, accountId: new Types.ObjectId(b.accountId) }).session(session);
            if (!parentDoc) throw new HttpError(422, { error: 'PARENT_NOT_FOUND' });
            if (parentDoc.parentTransactionId) throw new HttpError(422, { error: 'PARENT_IS_CHILD' });
            await lockParent(parentDoc._id as Types.ObjectId, session);

            // check split constraint
            const assigned = await sumChildren(parentDoc._id as Types.ObjectId, session);
            if (assigned + b.amountMinor > parentDoc.amountMinor) {
                throw new HttpError(422, { error: 'SPLIT_CONSTRAINT_EXCEEDED', assigned, parentTotal: parentDoc.amountMinor });
            }
            // Children inherit bookDate and month; explicit values must agree with the parent.
            if (!childDatesAgree(parentDoc, { month: dates.value.month, ...(b.bookDate ? { bookDate: dates.value.bookDate } : {}) })) {
                throw new HttpError(422, { error: 'CHILD_DATES_MUST_MATCH_PARENT' });
            }
        }

        const doc: Record<string, unknown> = {
            accountId: new Types.ObjectId(b.accountId),
            categoryId: b.categoryId ? new Types.ObjectId(b.categoryId) : null,
            title: b.title,
            notes: b.notes ?? null,
            amountMinor: b.amountMinor,
            month: isChild ? parentDoc!.month : dates.value.month,
            bookDate: isChild ? parentDoc!.bookDate : dates.value.bookDate,
            status: b.status ?? 'pending',
            isFromSharedAccount: isChild ? parentDoc!.isFromSharedAccount : b.isFromSharedAccount,
            paidByMemberId: isChild ? parentDoc!.paidByMemberId : b.paidByMemberId ? new Types.ObjectId(b.paidByMemberId) : null,
            parentTransactionId: isChild ? new Types.ObjectId(b.parentTransactionId) : null,
            recurrenceId: b.recurrenceId ? new Types.ObjectId(b.recurrenceId) : null,
            // type: always from parent for children
            type: isChild ? parentDoc!.type : b.type
        };

        const [created] = await Transaction.create([doc], { session });

        await Event.create(
            [
                {
                    accountId: doc.accountId,
                    date: DateTime.utc().toJSDate(),
                    code: isChild ? 'transaction.splitChildCreated' : 'transaction.created',
                    params: {
                        transactionId: String(created!._id),
                        ...(isChild ? { parentTransactionId: b.parentTransactionId } : {}),
                        type: doc.type,
                        amountMinor: doc.amountMinor,
                        title: b.title,
                        categoryId: b.categoryId ?? undefined
                    },
                    createdByMemberId: (doc.paidByMemberId as Types.ObjectId) ?? null
                }
            ],
            { session }
        );

        return { status: 201, body: created };
    });
});

// ─── PATCH /api/transactions/:id ─────────────────────────────────────────────

r.patch('/:id', validateBody(PatchTx), async (req, res) => {
    const { id } = req.params;
    const b = (req as any).data;

    return writeAtomically(res, async (session) => {
        const prev = await Transaction.findById(id).session(session);
        if (!prev) return { status: 404 };

        const isChild = !!prev.parentTransactionId;

        // Children: block changes to inherited fields
        if (isChild) {
            if (b.type !== undefined) throw new HttpError(422, { error: 'CHILD_FIELD_IMMUTABLE', field: 'type' });
            if (b.isFromSharedAccount !== undefined) throw new HttpError(422, { error: 'CHILD_FIELD_IMMUTABLE', field: 'isFromSharedAccount' });
            if (b.paidByMemberId !== undefined) throw new HttpError(422, { error: 'CHILD_FIELD_IMMUTABLE', field: 'paidByMemberId' });
        }

        // Build next state for cross-field validation
        const nextBookDate = 'bookDate' in b ? b.bookDate : prev.bookDate ? prev.bookDate.toISOString() : null;
        const nextStatus = b.status ?? prev.status;
        const nextIsShared = b.isFromSharedAccount ?? prev.isFromSharedAccount;
        const nextPaidBy = 'paidByMemberId' in b ? b.paidByMemberId : String(prev.paidByMemberId ?? '');

        if (nextStatus === 'booked' && !nextBookDate) throw new HttpError(422, { error: 'BOOKED_REQUIRES_BOOKDATE' });
        if (nextIsShared === false && !nextPaidBy) throw new HttpError(422, { error: 'PRIVATE_REQUIRES_PAIDBYMEMBER' });
        if ('bookDate' in b && b.bookDate === null && nextStatus === 'booked') throw new HttpError(422, { error: 'CANNOT_CLEAR_BOOKDATE_WHILE_BOOKED' });

        // bookDate + month: the date decides the month, a conflicting month is rejected before anything is written
        const dates = resolvePatchDates(prev, b);
        if (!dates.ok) failMonthRule(dates.error);
        let parentDoc: InstanceType<typeof Transaction> | null = null;
        if (isChild) {
            parentDoc = await Transaction.findById(prev.parentTransactionId).session(session);
            if (!parentDoc) throw new HttpError(422, { error: 'PARENT_NOT_FOUND' });
            if (!childDatesAgree(parentDoc, dates.value)) {
                throw new HttpError(422, { error: 'CHILD_FIELD_IMMUTABLE', field: dates.value.bookDate !== undefined ? 'bookDate' : 'month' });
            }
        }

        // Split constraints
        if (typeof b.amountMinor === 'number') {
            if (isChild) {
                await lockParent(parentDoc!._id as Types.ObjectId, session);
                const assignedWithoutThis = await sumChildren(parentDoc!._id as Types.ObjectId, session, prev._id as Types.ObjectId);
                if (assignedWithoutThis + b.amountMinor > parentDoc!.amountMinor) {
                    throw new HttpError(422, { error: 'SPLIT_CONSTRAINT_EXCEEDED', assignedWithoutThis, parentTotal: parentDoc!.amountMinor });
                }
            } else {
                // parent amount shrinking: check children still fit
                const assigned = await sumChildren(prev._id as Types.ObjectId, session);
                if (assigned > b.amountMinor) {
                    throw new HttpError(422, { error: 'SPLIT_CONSTRAINT_EXCEEDED', assigned, newParentTotal: b.amountMinor });
                }
            }
        }

        // Build patch
        const patch: Record<string, unknown> = {};
        if (b.categoryId !== undefined) patch.categoryId = b.categoryId ? new Types.ObjectId(b.categoryId) : null;
        if (b.title !== undefined) patch.title = b.title;
        if (b.notes !== undefined) patch.notes = b.notes ?? null;
        if (b.type !== undefined) patch.type = b.type;
        if (typeof b.amountMinor === 'number') patch.amountMinor = b.amountMinor;
        if (b.status !== undefined) patch.status = b.status;
        if (b.isFromSharedAccount !== undefined) patch.isFromSharedAccount = b.isFromSharedAccount;
        if (b.paidByMemberId !== undefined) patch.paidByMemberId = b.paidByMemberId ? new Types.ObjectId(b.paidByMemberId) : null;
        if (b.recurrenceId !== undefined) patch.recurrenceId = b.recurrenceId ? new Types.ObjectId(b.recurrenceId) : null;
        if (dates.value.bookDate !== undefined) patch.bookDate = dates.value.bookDate;
        if (dates.value.month !== undefined) patch.month = dates.value.month;

        // Nothing to change (e.g. a month equal to the stored one): no write, not even updatedAt.
        if (Object.keys(patch).length === 0) return { status: 200, body: prev };

        const updated = await Transaction.findByIdAndUpdate(id, patch, { new: true, session });
        if (!updated) return { status: 404 };

        // Cascade: if type, status or dates changed on a parent, update children in the same transaction
        if (!isChild) {
            const childPatch: Record<string, unknown> = {};
            if (patch.type) childPatch.type = patch.type;
            if (patch.status) childPatch.status = patch.status;
            if (patch.bookDate !== undefined) childPatch.bookDate = patch.bookDate;
            if (patch.month !== undefined) childPatch.month = patch.month;
            if (Object.keys(childPatch).length) {
                await Transaction.updateMany({ parentTransactionId: updated._id }, childPatch, { session });
            }
        }

        // Events
        if (prev.status !== 'booked' && updated.status === 'booked') {
            await Event.create(
                [
                    {
                        accountId: updated.accountId,
                        date: DateTime.utc().toJSDate(),
                        code: 'transaction.booked',
                        params: { transactionId: String(updated._id), type: updated.type, amountMinor: updated.amountMinor, title: updated.title ?? undefined },
                        createdByMemberId: updated.paidByMemberId ?? null
                    }
                ],
                { session }
            );
        } else if (prev.status !== updated.status) {
            await Event.create(
                [
                    {
                        accountId: updated.accountId,
                        date: DateTime.utc().toJSDate(),
                        code: 'transaction.statusChanged',
                        params: { transactionId: String(updated._id), from: prev.status, to: updated.status, title: updated.title ?? undefined },
                        createdByMemberId: updated.paidByMemberId ?? null
                    }
                ],
                { session }
            );
        }

        return { status: 200, body: updated };
    });
});

// ─── DELETE /api/transactions/:id ─────────────────────────────────────────────

r.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const target = await Transaction.findById(id);
    if (!target) return res.sendStatus(404);

    const isParent = !target.parentTransactionId;

    if (isParent) {
        // best-effort cascade: delete children first, then parent
        await Transaction.deleteMany({ parentTransactionId: target._id });
    }

    await Transaction.findByIdAndDelete(id);

    if (!target.parentTransactionId) {
        // it was a parent – nothing more needed
    } else {
        // it was a child – emit event
        await Event.create({
            accountId: target.accountId,
            date: DateTime.utc().toJSDate(),
            code: 'transaction.splitChildDeleted',
            params: { transactionId: String(target._id), parentTransactionId: String(target.parentTransactionId) },
            createdByMemberId: target.paidByMemberId ?? null
        }).catch(() => {}); // non-fatal
    }

    res.sendStatus(204);
});

export default r;

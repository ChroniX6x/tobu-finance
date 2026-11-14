import { Router, type Request, type Response } from 'express';
import { Types, type ClientSession } from 'mongoose';
import { DateTime } from 'luxon';
import Transaction from '../models/Transaction.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { CreateTx, PatchTx, QueryTx, monthFromYYYYMM } from '../validation/transactions.js';
import { requireAccountContext } from '../auth/account-context.js';
import { activityRoute, creationReply, changedPatch, validateReferences, DomainRejection } from '../services/activity-route.js';
import { creationId, fingerprint } from '../services/creation-proof.js';
import type { ActivityIntent } from '../services/activity-writer.js';
import { childDatesAgree, resolveCreateDates, resolvePatchDates, type MonthRuleError } from '../lib/transaction-dates.js';
import { foreignReference, isObjectId, requireAccountAccess } from '../auth/account-access.js';
import Recurrence from '../models/Recurrence.js';

const r = Router();

/** The transaction must exist and belong to an account of the caller; otherwise 404 (indistinguishable). */
async function loadAuthorizedTransaction(req: Request, res: Response, id: unknown) {
    const target = isObjectId(id) ? await Transaction.findById(id, { accountId: 1, parentTransactionId: 1, categoryId: 1 }).lean() : null;
    if (!target) {
        res.sendStatus(404);
        return null;
    }
    return (await requireAccountAccess(req, res, target.accountId)) ? target : null;
}

/** Category, payer and recurrence of a write must belong to the same account. Answers 422 and returns false otherwise. */
async function referencesBelongToAccount(res: Response, accountId: unknown, refs: { categoryId?: unknown; paidByMemberId?: unknown; recurrenceId?: unknown }): Promise<boolean> {
    let field = await foreignReference(accountId, { categoryId: refs.categoryId, memberIds: { paidByMemberId: refs.paidByMemberId } });
    if (!field && refs.recurrenceId && !(await Recurrence.exists({ _id: refs.recurrenceId, accountId }))) field = 'recurrenceId';
    if (!field) return true;
    res.status(422).json({ error: 'REFERENCE_NOT_IN_ACCOUNT', field });
    return false;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Business rule violation inside a transaction: aborts it and is answered with the given status/body. */
const HttpError = DomainRejection;

const monthRuleStatus = (error: MonthRuleError) => (error === 'MONTH_REQUIRED' ? { status: 422, body: { error, message: 'Provide bookDate or month.' } } : { status: 422, body: { error } });

function failMonthRule(error: MonthRuleError): never {
    const { status, body } = monthRuleStatus(error);
    throw new HttpError(status, body);
}

/**
 * Serializes concurrent split writes: children are separate documents, so two transactions that only read the parent
 * would not conflict (write skew: split sum, children left behind after a date change). A write to the parent makes
 * them conflict; MongoDB aborts one and the driver reruns it against the committed state.
 */
async function lockParent(parentId: Types.ObjectId, session: ClientSession): Promise<void> {
    await Transaction.updateOne({ _id: parentId }, { $inc: { mutationVersion: 1 }, $set: { updatedAt: DateTime.utc().toJSDate() } }, { session, timestamps: false });
}

/** Sum amountMinor of all direct children of a parent (excluding one optional id). */
async function sumChildren(parentId: Types.ObjectId, session: ClientSession, excludeId?: Types.ObjectId): Promise<number> {
    const parent = await Transaction.findById(parentId, { accountId: 1 }).session(session);
    if (!parent) throw new HttpError(422, { error: 'PARENT_NOT_FOUND' });
    if (await Transaction.exists({ parentTransactionId: parentId, accountId: { $ne: parent.accountId } }).session(session)) throw new HttpError(422, { error: 'SPLIT_ACCOUNT_MISMATCH' });
    const match: Record<string, unknown> = { parentTransactionId: parentId, accountId: parent.accountId };
    if (excludeId) match._id = { $ne: excludeId };
    const agg = await Transaction.aggregate<{ total: number }>([{ $match: match }, { $group: { _id: null, total: { $sum: '$amountMinor' } } }]).session(session);
    return agg[0]?.total ?? 0;
}

// ─── GET /api/transactions ────────────────────────────────────────────────────

r.get('/', validateQuery(QueryTx), async (req, res) => {
    const { accountId, month, monthFrom, monthTo, status, q: search, parentTransactionId: ptxId, categoryIds, page, pageSize, sort } = (req as any).q;
    if (!(await requireAccountAccess(req, res, accountId))) return;

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
        const allChildren = await Transaction.find({ accountId: new Types.ObjectId(accountId), parentTransactionId: { $in: parentIds } })
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
    const context = await requireAccountContext(req, res, b.accountId);
    if (!context) return;
    // A split child may echo the parent's stored (possibly legacy, non-carrier) bookDate; the locked parent is re-checked in the transaction.
    const echoParent = isChild && isObjectId(b.parentTransactionId) ? await Transaction.findOne({ _id: b.parentTransactionId, accountId: new Types.ObjectId(b.accountId) }, { bookDate: 1 }).lean() : null;
    const dates = resolveCreateDates(b.bookDate, b.month, echoParent?.bookDate ?? null);
    if (!dates.ok) {
        const { status, body } = monthRuleStatus(dates.error);
        return res.status(status).json(body);
    }
    if (!(await referencesBelongToAccount(res, b.accountId, { categoryId: b.categoryId, paidByMemberId: b.paidByMemberId, recurrenceId: b.recurrenceId }))) return;

    const domainId = creationId(req, res, 'transaction', b);
    if (!domainId) return;
    return activityRoute(
        req,
        res,
        async (session, emit) => {
            await validateReferences(b.accountId, session, { categoryId: b.categoryId, memberIds: [b.paidByMemberId], recurrenceId: b.recurrenceId });
            let parentDoc: InstanceType<typeof Transaction> | null = null;

            if (isChild) {
                // The parent is looked up inside the target account, so a parent of another account is never even read.
                parentDoc = await Transaction.findOne({ _id: b.parentTransactionId, accountId: new Types.ObjectId(b.accountId) }).session(session);
                if (!parentDoc) throw new HttpError(422, { error: 'PARENT_NOT_FOUND' });
                if (parentDoc.parentTransactionId) throw new HttpError(422, { error: 'PARENT_IS_CHILD' });
                await validateReferences(parentDoc.accountId, session, { memberIds: [parentDoc.paidByMemberId] });

                // check split constraint
                const assigned = await sumChildren(parentDoc._id as Types.ObjectId, session, domainId);
                if (assigned + b.amountMinor > parentDoc.amountMinor) {
                    throw new HttpError(422, { error: 'SPLIT_CONSTRAINT_EXCEEDED', assigned, parentTotal: parentDoc.amountMinor });
                }
                // Children inherit bookDate and month; explicit values must agree with the parent.
                if (!childDatesAgree(parentDoc, { month: dates.value.month, ...(b.bookDate ? { bookDate: dates.value.bookDate } : {}) })) {
                    throw new HttpError(422, { error: 'CHILD_DATES_MUST_MATCH_PARENT' });
                }
            }

            const doc: Record<string, unknown> = {
                _id: domainId,
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

            const intents: ActivityIntent[] = [
                {
                    code: isChild ? 'transaction.splitChildCreated' : 'transaction.created',
                    subject: { kind: 'transaction', id: String(domainId) },
                    params: {
                        transactionId: String(domainId),
                        ...(isChild ? { parentTransactionId: b.parentTransactionId } : {}),
                        type: doc.type as 'income' | 'expense',
                        amountMinor: b.amountMinor,
                        title: b.title,
                        ...(b.categoryId ? { categoryId: b.categoryId } : {})
                    }
                } as ActivityIntent
            ];
            await emit(context, `transaction:create:${domainId}`, intents, async () => {
                if (parentDoc) await lockParent(parentDoc._id as Types.ObjectId, session);
                await Transaction.create([doc], { session });
                return true;
            });
            return creationReply(await Transaction.findById(domainId).session(session));
        },
        async (readSession) => creationReply(await Transaction.findById(domainId).session(readSession))
    );
});

// ─── PATCH /api/transactions/:id ─────────────────────────────────────────────

r.patch('/:id', validateBody(PatchTx), async (req, res) => {
    const { id } = req.params;
    const b = (req as any).data;

    const target = await loadAuthorizedTransaction(req, res, id);
    if (!target) return;
    if (!(await referencesBelongToAccount(res, target.accountId, { categoryId: b.categoryId, paidByMemberId: b.paidByMemberId, recurrenceId: b.recurrenceId }))) return;

    const context = await requireAccountContext(req, res, target.accountId);
    if (!context) return;
    return activityRoute(req, res, async (session, emit) => {
        const prev = await Transaction.findById(id).session(session);
        if (!prev) return { status: 404 };
        await validateReferences(prev.accountId, session, {
            categoryId: b.categoryId !== undefined ? b.categoryId : prev.categoryId,
            memberIds: [b.paidByMemberId !== undefined ? b.paidByMemberId : prev.paidByMemberId],
            recurrenceId: b.recurrenceId !== undefined ? b.recurrenceId : prev.recurrenceId
        });

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
            parentDoc = await Transaction.findOne({ _id: prev.parentTransactionId, accountId: prev.accountId }).session(session);
            if (!parentDoc) throw new HttpError(422, { error: 'PARENT_NOT_FOUND' });
            if (!childDatesAgree(parentDoc, dates.value)) {
                throw new HttpError(422, { error: 'CHILD_FIELD_IMMUTABLE', field: dates.value.bookDate !== undefined ? 'bookDate' : 'month' });
            }
        }

        // Split constraints
        if (typeof b.amountMinor === 'number') {
            if (isChild) {
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
        let patch: Record<string, unknown> = {};
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

        patch = changedPatch(prev.toObject() as unknown as Record<string, unknown>, patch);
        // Nothing to change (e.g. a month equal to the stored one): no write, not even updatedAt.
        if (Object.keys(patch).length === 0) return { status: 200, body: prev };
        if (!isChild && (await Transaction.exists({ parentTransactionId: prev._id, accountId: { $ne: prev.accountId } }).session(session))) throw new HttpError(422, { error: 'SPLIT_ACCOUNT_MISMATCH' });

        const intents: ActivityIntent[] = [];
        const subject = { kind: 'transaction' as const, id: String(prev._id) };
        const fields = Object.keys(patch).filter((key) => key !== 'status');
        if (fields.length)
            intents.push({
                code: 'transaction.updated',
                subject,
                params: {
                    transactionId: String(prev._id),
                    changedFields: fields,
                    ...(patch.amountMinor !== undefined ? { amountMinor: { from: prev.amountMinor, to: patch.amountMinor } } : {}),
                    ...(patch.categoryId !== undefined ? { categoryId: { from: prev.categoryId ? String(prev.categoryId) : null, to: patch.categoryId ? String(patch.categoryId) : null } } : {})
                }
            } as ActivityIntent);
        if (prev.status !== nextStatus)
            intents.push(
                nextStatus === 'booked'
                    ? { code: 'transaction.booked', subject, params: { transactionId: String(prev._id), type: (patch.type ?? prev.type) as 'income' | 'expense', amountMinor: (patch.amountMinor ?? prev.amountMinor) as number } }
                    : { code: 'transaction.statusChanged', subject, params: { transactionId: String(prev._id), from: prev.status, to: nextStatus } }
            );
        await emit(context, `transaction:patch:${id}:${prev.get('mutationVersion')}:${fingerprint(patch)}`, intents, async () => {
            if (isChild) await lockParent(parentDoc!._id as Types.ObjectId, session);
            await Transaction.updateOne({ _id: id }, { $set: patch, $inc: { mutationVersion: 1 } }, { session });
            if (!isChild) {
                const childPatch = Object.fromEntries(Object.entries(patch).filter(([key]) => ['type', 'status', 'bookDate', 'month', 'isFromSharedAccount', 'paidByMemberId'].includes(key)));
                if (Object.keys(childPatch).length) await Transaction.updateMany({ parentTransactionId: prev._id, accountId: prev.accountId }, { $set: childPatch, $inc: { mutationVersion: 1 } }, { session });
            }
            return true;
        });
        return { status: 200, body: await Transaction.findById(id).session(session) };
    });
});

r.delete('/:id', async (req, res) => {
    const target = await loadAuthorizedTransaction(req, res, req.params.id);
    if (!target) return;
    const context = await requireAccountContext(req, res, target.accountId);
    if (!context) return;
    return activityRoute(req, res, async (session, emit) => {
        const current = await Transaction.findById(req.params.id).session(session);
        if (!current) return { status: 404 };
        if (await Transaction.exists({ parentTransactionId: current._id, accountId: { $ne: current.accountId } }).session(session)) throw new HttpError(422, { error: 'SPLIT_ACCOUNT_MISMATCH' });
        if (current.parentTransactionId && !(await Transaction.exists({ _id: current.parentTransactionId, accountId: current.accountId, parentTransactionId: null }).session(session))) throw new DomainRejection(422, { error: 'PARENT_NOT_FOUND' });
        const childCount = await Transaction.countDocuments({ parentTransactionId: current._id, accountId: current.accountId }).session(session);
        const intent: ActivityIntent = current.parentTransactionId
            ? { code: 'transaction.splitChildDeleted', subject: { kind: 'transaction', id: String(current._id) }, params: { transactionId: String(current._id), parentTransactionId: String(current.parentTransactionId) } }
            : { code: 'transaction.deleted', subject: { kind: 'transaction', id: String(current._id) }, params: { transactionId: String(current._id), type: current.type, amountMinor: current.amountMinor, childCount } };
        await emit(context, `transaction:delete:${current._id}:${current.get('mutationVersion')}`, [intent], async () => {
            if (current.parentTransactionId) await lockParent(current.parentTransactionId as Types.ObjectId, session);
            else await Transaction.deleteMany({ parentTransactionId: current._id, accountId: current.accountId }, { session });
            await Transaction.deleteOne({ _id: current._id }, { session });
            return true;
        });
        return { status: 204 };
    });
});

export default r;

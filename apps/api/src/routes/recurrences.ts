import { Router } from 'express';
import { Types } from 'mongoose';
import Recurrence from '../models/Recurrence.js';
import { toMonthDate } from '../lib/month.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { QueryRecurrences, CreateRecurrence, UpdateRecurrence } from '../validation/recurrences.js';
import { accountScope, foreignReference, isObjectId } from '../auth/account-access.js';

import { requireAccountContext } from '../auth/account-context.js';
import { activityRoute, creationReply, changedPatch, validateReferences } from '../services/activity-route.js';
import { creationId } from '../services/creation-proof.js';
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
    const b = CreateRecurrence.parse(req.body);
    const context = await requireAccountContext(req, res, b.accountId);
    if (!context) return;
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
    const id = creationId(req, res, 'legacyRecurrence', b);
    if (!id) return;
    return activityRoute(
        req,
        res,
        async (session, emit) => {
            await validateReferences(b.accountId, session, { categoryId: b.categoryId, memberIds: [b.createdByMemberId] });
            await emit(context, `legacyRecurrence:create:${id}`, [{ code: 'legacyRecurrence.created', subject: { kind: 'legacyRecurrence', id: String(id) }, params: { ...(b.title ? { title: b.title } : {}) } }], async () => {
                await Recurrence.create([{ ...doc, _id: id }], { session });
                return true;
            });
            return creationReply(await Recurrence.findById(id).session(session));
        },
        async (readSession) => creationReply(await Recurrence.findById(id).session(readSession))
    );
});

/** PATCH /api/recurrences/:id – the account of a recurrence never changes */
r.patch('/:id', validateBody(UpdateRecurrence), async (req, res) => {
    const { id } = req.params;
    const u: any = { ...(req as any).data };
    const existing = isObjectId(id) ? await Recurrence.findById(id, { accountId: 1 }).lean() : null;
    if (!existing) return res.sendStatus(404);
    const context = await requireAccountContext(req, res, existing.accountId);
    if (!context) return;
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
    return activityRoute(req, res, async (session, emit) => {
        const prev = await Recurrence.findById(id).session(session);
        if (!prev) return { status: 404 };
        await validateReferences(prev.accountId, session, { categoryId: u.categoryId !== undefined ? u.categoryId : prev.categoryId, memberIds: [u.createdByMemberId !== undefined ? u.createdByMemberId : prev.createdByMemberId] });
        const patch = changedPatch(prev.toObject(), u);
        if (!Object.keys(patch).length) return { status: 200, body: prev };
        const revision = Number(prev.get('mutationVersion') ?? 0);
        await emit(context, `legacyRecurrence:patch:${id}:${revision}`, [{ code: 'legacyRecurrence.updated', subject: { kind: 'legacyRecurrence', id: String(id) }, params: {} }], async () => {
            await Recurrence.updateOne({ _id: id }, { $set: patch, $inc: { mutationVersion: 1 } }, { session });
            return true;
        });
        return { status: 200, body: await Recurrence.findById(id).session(session) };
    });
});

/** DELETE /api/recurrences/:id */
r.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const existing = isObjectId(id) ? await Recurrence.findById(id, { accountId: 1 }).lean() : null;
    if (!existing) return res.sendStatus(404);
    const context = await requireAccountContext(req, res, existing.accountId);
    if (!context) return;
    return activityRoute(req, res, async (session, emit) => {
        const prev = await Recurrence.findById(id).session(session);
        if (!prev) return { status: 404 };
        await validateReferences(prev.accountId, session, { categoryId: prev.categoryId, memberIds: [prev.createdByMemberId] });
        const revision = Number(prev.get('mutationVersion') ?? 0);
        await emit(context, `legacyRecurrence:delete:${id}:${revision}`, [{ code: 'legacyRecurrence.deleted', subject: { kind: 'legacyRecurrence', id: String(id) }, params: {} }], async () => {
            await Recurrence.deleteOne({ _id: id }, { session });
            return true;
        });
        return { status: 204 };
    });
});

export default r;

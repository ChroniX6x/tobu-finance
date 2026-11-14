import { User } from '../auth/models.js';
import { Router } from 'express';
import { Types } from 'mongoose';
import Member from '../models/Member.js';
import Account from '../models/Account.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { QueryMembers, CreateMember, UpdateMember } from '../validation/members.js';
import { isObjectId, visibleMemberIds } from '../auth/account-access.js';

import { createHash } from 'node:crypto';
import { resolveAccountContext } from '../auth/account-context.js';
import { activityRoute, changedPatch, nextRevision, reject, requireMutationProof } from '../services/activity-route.js';
import { creationId, creationGeneration } from '../services/creation-proof.js';
import { lockActivityUser } from '../services/activity-writer.js';
const r = Router();

/** GET /api/members?userId=... – only members linked to the caller or listed in the caller's accounts */
r.get('/', validateQuery(QueryMembers), async (req, res) => {
    const { userId } = (req as any).q;
    const q: any = { _id: { $in: await visibleMemberIds(req) } };
    if (userId) q.userId = new Types.ObjectId(userId);
    const items = await Member.find(q).lean();
    res.json(items);
});

/** POST /api/members  { name?, email?, userId? } – userId may only be the caller's own id */
r.post('/', validateBody(CreateMember), async (req, res) => {
    const b = CreateMember.parse(req.body);
    if (b.userId && b.userId !== req.user!.sub) return res.status(403).json({ error: 'USER_LINK_FORBIDDEN' });
    // The self member has a server-derived identity; reuse is explicit, not a payload deduplication of people.
    if (b.userId) {
        const own = await Member.find({ userId: req.user!.sub });
        if (own.length > 1) return res.status(422).json({ error: 'AMBIGUOUS_SELF_MEMBER' });
        if (own.length === 1) return res.status(201).json(own[0]);
    }
    const creator = await User.findById(req.user!.sub);
    if (!creator?.isActive) return res.sendStatus(401);
    const id = creationId(req, res, 'member', b, Number(creator.get('__v') ?? 0));
    if (!id) return;
    const domainId = b.userId ? new Types.ObjectId(createHash('sha256').update(`self-member:${req.user!.sub}`).digest('hex').slice(0, 24)) : id;
    // No account event for user-scoped master data (E01). A user revision fences physical deletion.
    return activityRoute(req, res, async (session) => {
        const existing = await Member.findById(domainId).select('+createdByUserId').session(session);
        if (existing) {
            if (String(existing.createdByUserId) !== req.user!.sub) reject(404, 'NOT_FOUND');
            if (existing.userId && String(existing.userId) !== req.user!.sub) reject(404, 'NOT_FOUND');
            const accounts = await Account.find({ 'members.memberId': existing._id }).session(session);
            let visible = accounts.length === 0;
            for (const account of accounts) if (await resolveAccountContext(req, account._id, session)) visible = true;
            if (!visible) reject(404, 'NOT_FOUND');
            return { status: 201, body: { ...existing.toObject(), createdByUserId: undefined } };
        }
        const user = await User.findById(req.user!.sub).session(session);
        if (!user?.isActive) reject(401, 'UNAUTHORIZED');
        if (Number(user.get('__v') ?? 0) !== creationGeneration(id)) reject(409, 'MEMBER_CREATION_PROOF_STALE');
        await lockActivityUser(String(user._id), session);
        const [created] = await Member.create([{ ...b, _id: domainId, createdByUserId: req.user!.sub }], { session });
        return { status: 201, body: { ...created!.toObject(), createdByUserId: undefined } };
    });
});

/** The member must be visible to the caller (linked to them or in one of their accounts); otherwise 404. */
async function visibleMember(req: Parameters<typeof visibleMemberIds>[0], id: unknown) {
    if (!isObjectId(id)) return null;
    const visible = await visibleMemberIds(req);
    if (!visible.some((v) => String(v) === id)) return null;
    return Member.findById(id).select('+createdByUserId');
}

/** PATCH /api/members/:id – the login link can never be changed here */
r.patch('/:id', validateBody(UpdateMember), async (req, res) => {
    const { id } = req.params;
    const u: any = { ...(req as any).data };
    const existing = await visibleMember(req, id);
    if (!existing) return res.sendStatus(404);
    if ('userId' in u) {
        if (String(u.userId ?? '') !== String(existing.userId ?? '')) return res.status(403).json({ error: 'USER_LINK_FORBIDDEN' });
        delete u.userId;
    }
    return activityRoute(req, res, async (session, emit) => {
        const prev = await Member.findById(id).select('+createdByUserId').session(session);
        if (!prev) return { status: 404 };
        const patch = changedPatch(prev.toObject(), u);
        if (!Object.keys(patch).length) return { status: 200, body: { ...prev.toObject(), createdByUserId: undefined } };
        const accounts = await Account.find({ 'members.memberId': prev._id }).sort({ _id: 1 }).session(session);
        const contexts = [];
        for (const account of accounts) {
            const context = await resolveAccountContext(req, account._id, session);
            if (!context) reject(404, 'NOT_FOUND');
            contexts.push(context);
        }
        if (!accounts.length && String(prev.userId ?? prev.createdByUserId ?? '') !== req.user!.sub) reject(404, 'NOT_FOUND');
        let written = false;
        for (const context of contexts)
            await emit(
                context,
                `member:patch:${prev._id}:${prev.get('__v')}`,
                [{ code: 'member.updated', subject: { kind: 'member', id: String(prev._id) }, params: { memberId: String(prev._id), changedFields: Object.keys(patch) as ('name' | 'email')[] } }],
                async () => {
                    if (!written) {
                        await Member.updateOne({ _id: prev._id }, { $set: { ...patch, __v: nextRevision(prev.get('__v'), 'MEMBER_REVISION_INVALID') } }, { session });
                        written = true;
                    }
                    return true;
                }
            );
        if (!contexts.length) {
            requireMutationProof(req, `member:patch:${prev._id}:${prev.get('__v')}`);
            await lockActivityUser(req.user!.sub, session);
            await Member.updateOne({ _id: prev._id }, { $set: { ...patch, __v: nextRevision(prev.get('__v'), 'MEMBER_REVISION_INVALID') } }, { session });
        }
        return { status: 200, body: await Member.findById(id).session(session) };
    });
});

/** DELETE /api/members/:id – a member linked to a login cannot be deleted */
r.delete('/:id', async (req, res) => {
    const existing = await visibleMember(req, req.params.id);
    if (!existing) return res.sendStatus(404);
    return activityRoute(req, res, async (session) => {
        const prev = await Member.findById(existing._id).select('+createdByUserId').session(session);
        if (!prev) return { status: 404 };
        if (prev.userId) reject(409, 'MEMBER_LINKED');
        if (await Account.exists({ 'members.memberId': prev._id }).session(session)) reject(409, 'MEMBER_IN_USE');
        if (String(prev.createdByUserId ?? '') !== req.user!.sub) reject(404, 'NOT_FOUND');
        if (!(await User.exists({ _id: req.user!.sub, isActive: true }).session(session))) reject(401, 'UNAUTHORIZED');
        requireMutationProof(req, `member:delete:${prev._id}:${prev.get('__v')}`);
        await lockActivityUser(req.user!.sub, session);
        await Member.deleteOne({ _id: prev._id }, { session });
        return { status: 204 };
    });
});

export default r;

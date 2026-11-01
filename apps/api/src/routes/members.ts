import { Router } from 'express';
import { Types } from 'mongoose';
import Member from '../models/Member.js';
import Account from '../models/Account.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { QueryMembers, CreateMember, UpdateMember } from '../validation/members.js';
import { callerUserId, isObjectId, visibleMemberIds } from '../auth/account-access.js';

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
    const b = (req as any).data;
    if (b.userId && String(b.userId) !== String(callerUserId(req))) return res.status(403).json({ error: 'USER_LINK_FORBIDDEN' });
    const created = await Member.create({
        name: b.name ?? null,
        email: b.email ?? null,
        userId: b.userId ? new Types.ObjectId(b.userId) : null
    });
    res.status(201).json(created);
});

/** The member must be visible to the caller (linked to them or in one of their accounts); otherwise 404. */
async function visibleMember(req: Parameters<typeof visibleMemberIds>[0], id: unknown) {
    if (!isObjectId(id)) return null;
    const visible = await visibleMemberIds(req);
    if (!visible.some((v) => String(v) === id)) return null;
    return Member.findById(id);
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
    const updated = await Member.findByIdAndUpdate(id, u, { new: true });
    if (!updated) return res.sendStatus(404);
    res.json(updated);
});

/** DELETE /api/members/:id – a member linked to a login cannot be deleted */
r.delete('/:id', async (req, res) => {
    const existing = await visibleMember(req, req.params.id);
    if (!existing) return res.sendStatus(404);
    if (existing.userId) return res.status(409).json({ error: 'MEMBER_LINKED' });
    if (await Account.exists({ 'members.memberId': existing._id })) return res.status(409).json({ error: 'MEMBER_IN_USE' });
    await Member.findByIdAndDelete(existing._id);
    res.sendStatus(204);
});

export default r;

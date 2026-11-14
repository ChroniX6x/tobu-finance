import { QueryContributionRules } from '@tobu/contracts/read-queries';
import { Router } from 'express';
import ContributionRule from '../models/ContributionRule.js';
import { toMonthDate } from '../lib/month.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { CreateContributionRule, UpdateContributionRule } from '../validation/contribution-rules.js';
import { accountScope, isObjectId } from '../auth/account-access.js';
import { requireAccountContext } from '../auth/account-context.js';
import { activityRoute, creationReply, changedPatch, validateReferences, reject } from '../services/activity-route.js';
import { creationId } from '../services/creation-proof.js';
import type { ActivityIntent } from '../services/activity-writer.js';
import { ContributionDistributionSchema } from '@tobu/contracts/contribution-rules';
const r = Router();
r.get('/', validateQuery(QueryContributionRules), async (req, res) => {
    const { accountId } = (req.query ?? {}) as { accountId?: string };
    const scope = await accountScope(req, res, accountId);
    if (!scope) return;
    const q: Record<string, unknown> = { accountId: Array.isArray(scope) ? { $in: scope } : scope };
    const items = await ContributionRule.find(q).lean();
    res.json(items);
});
function distributionIds(value: unknown): unknown[] {
    const d = value as { memberId?: unknown; customSplit?: { memberId?: unknown }[] } | null;
    return [d?.memberId, ...(Array.isArray(d?.customSplit) ? d.customSplit.map((s) => s?.memberId) : [])];
}
r.post('/', validateBody(CreateContributionRule, 422), async (req, res) => {
    const b = CreateContributionRule.parse(req.body);
    const context = await requireAccountContext(req, res, b.accountId);
    if (!context) return;
    const id = creationId(req, res, 'contributionRule', b);
    if (!id) return;
    return activityRoute(
        req,
        res,
        async (session, emit) => {
            await validateReferences(b.accountId, session, { memberIds: [b.createdByMemberId, ...distributionIds(b.distribution)] });
            const values = {
                accountId: b.accountId,
                type: b.type,
                recurring: b.recurring,
                description: b.description ?? null,
                amountMinor: b.amountMinor,
                distribution: b.distribution,
                _id: id,
                fromMonth: b.fromMonth ? toMonthDate(b.fromMonth) : null,
                toMonth: b.toMonth ? toMonthDate(b.toMonth) : null
            };
            const prev = values;
            await emit(
                context,
                `contributionRule:create:${id}`,
                [{ code: 'contributionRule.added', subject: { kind: 'contributionRule', id: String(id) }, params: { ruleId: String(id), ruleType: prev.type, amountMinor: prev.amountMinor } } as ActivityIntent],
                async () => {
                    await ContributionRule.create([values], { session });
                    return true;
                }
            );
            return creationReply(await ContributionRule.findById(id).session(session));
        },
        async (readSession) => creationReply(await ContributionRule.findById(id).session(readSession))
    );
});
r.patch('/:id', validateBody(UpdateContributionRule, 422), async (req, res) => {
    const b = UpdateContributionRule.parse(req.body);
    const existing = isObjectId(req.params.id) ? await ContributionRule.findById(req.params.id).lean() : null;
    if (!existing) return res.sendStatus(404);
    const context = await requireAccountContext(req, res, existing.accountId);
    if (!context) return;
    return activityRoute(req, res, async (session, emit) => {
        const prev = await ContributionRule.findById(existing._id).session(session);
        if (!prev) return { status: 404 };
        if (prev.type === 'base') reject(403, 'BASE_RULE_IMMUTABLE');
        const distribution = ContributionDistributionSchema.safeParse(b.distribution ?? JSON.parse(JSON.stringify(prev.toObject().distribution)));
        if (!distribution.success) reject(422, 'INVALID_DISTRIBUTION');
        await validateReferences(prev.accountId, session, { memberIds: [b.createdByMemberId, ...distributionIds(b.distribution !== undefined ? b.distribution : prev.distribution)] });
        const values: Record<string, unknown> = { ...b };
        if (b.fromMonth !== undefined) values.fromMonth = b.fromMonth ? toMonthDate(b.fromMonth) : null;
        if (b.toMonth !== undefined) values.toMonth = b.toMonth ? toMonthDate(b.toMonth) : null;
        delete values.createdByMemberId;
        const patch = changedPatch(prev.toObject(), values);
        if (!Object.keys(patch).length) return { status: 200, body: prev };
        await emit(
            context,
            `contributionRule:patch:${prev._id}:${prev.get('mutationVersion')}`,
            [{ code: 'contributionRule.updated', subject: { kind: 'contributionRule', id: String(prev._id) }, params: { ruleId: String(prev._id), ruleType: prev.type, amountMinor: b.amountMinor ?? prev.amountMinor } } as ActivityIntent],
            async () => {
                await ContributionRule.updateOne({ _id: prev._id }, { $set: patch, $inc: { mutationVersion: 1 } }, { session });
                return true;
            }
        );
        return { status: 200, body: await ContributionRule.findById(prev._id).session(session) };
    });
});
r.delete('/:id', async (req, res) => {
    const existing = isObjectId(req.params.id) ? await ContributionRule.findById(req.params.id).lean() : null;
    if (!existing) return res.sendStatus(404);
    const context = await requireAccountContext(req, res, existing.accountId);
    if (!context) return;
    return activityRoute(req, res, async (session, emit) => {
        const prev = await ContributionRule.findById(existing._id).session(session);
        if (!prev) return { status: 404 };
        if (prev.type === 'base') reject(403, 'BASE_RULE_IMMUTABLE');
        await validateReferences(prev.accountId, session, { memberIds: distributionIds(prev.distribution) });
        await emit(
            context,
            `contributionRule:delete:${prev._id}:${prev.get('mutationVersion')}`,
            [{ code: 'contributionRule.removed', subject: { kind: 'contributionRule', id: String(prev._id) }, params: { ruleId: String(prev._id), ruleType: prev.type } } as ActivityIntent],
            async () => {
                await ContributionRule.deleteOne({ _id: prev._id }, { session });
                return true;
            }
        );
        return { status: 204 };
    });
});
export default r;

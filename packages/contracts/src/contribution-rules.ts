import { z } from 'zod';
import { MonthInputSchema as MonthInput } from './calendar.js';
const ObjectId = z.string().regex(/^[a-f\d]{24}$/i, 'must be a 24-char hex ObjectId');
const CustomSplit = z
    .array(z.object({ memberId: ObjectId, split: z.number().min(0).max(100) }).strict())
    .min(1)
    .superRefine((items, ctx) => {
        if (Math.abs(items.reduce((sum, item) => sum + item.split, 0) - 100) > 1e-6) ctx.addIssue({ code: 'custom', message: 'customSplit must sum to 100' });
        if (new Set(items.map((item) => item.memberId.toLowerCase())).size !== items.length) ctx.addIssue({ code: 'custom', message: 'customSplit members must be unique' });
    });
// Inactive fields may echo the nulls produced by Mongoose; they cannot carry a second distribution.
export const ContributionDistributionSchema = z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('perMember'), memberId: ObjectId, customSplit: z.null().optional() }).strict(),
    z.object({ mode: z.literal('customSplit'), memberId: z.null().optional(), customSplit: CustomSplit }).strict(),
    z.object({ mode: z.literal('proRataIncome'), memberId: z.null().optional(), customSplit: z.null().optional() }).strict()
]);
// `base` rules are auto-generated via regenerateBaseRules – manual creation is blocked at the API level.
export const CreateContributionRule = z.object({
    accountId: ObjectId,
    type: z.enum(['additional', 'topup']),
    recurring: z.boolean(),
    description: z.string().nullish(),
    amountMinor: z.number().int().positive(),
    distribution: ContributionDistributionSchema,
    fromMonth: MonthInput.nullish(),
    toMonth: MonthInput.nullish(),
    createdByMemberId: ObjectId.nullish()
});
// `type` is immutable after creation.
export const UpdateContributionRule = z.object({
    recurring: z.boolean().optional(),
    description: z.string().nullish(),
    amountMinor: z.number().int().positive().optional(),
    distribution: ContributionDistributionSchema.optional(),
    fromMonth: MonthInput.nullish(),
    toMonth: MonthInput.nullish(),
    createdByMemberId: ObjectId.nullish()
});
export type CreateContributionRuleInput = z.infer<typeof CreateContributionRule>;
export type UpdateContributionRuleInput = z.infer<typeof UpdateContributionRule>;

import { z } from 'zod';
import { MonthInputSchema as MonthInput } from './calendar.js';
const ObjectId = z.string().regex(/^[a-f\d]{24}$/i, 'must be a 24-char hex ObjectId');
// `base` rules are auto-generated via regenerateBaseRules – manual creation is blocked at the API level.
export const CreateContributionRule = z.object({
    accountId: ObjectId,
    type: z.enum(['additional', 'topup']),
    recurring: z.boolean(),
    description: z.string().nullish(),
    amountMinor: z.number().int().positive(),
    distribution: z.unknown(),
    fromMonth: MonthInput.nullish(),
    toMonth: MonthInput.nullish(),
    createdByMemberId: ObjectId.nullish()
});
// `type` is immutable after creation.
export const UpdateContributionRule = z.object({
    recurring: z.boolean().optional(),
    description: z.string().nullish(),
    amountMinor: z.number().int().positive().optional(),
    distribution: z.unknown().optional(),
    fromMonth: MonthInput.nullish(),
    toMonth: MonthInput.nullish(),
    createdByMemberId: ObjectId.nullish()
});
export type CreateContributionRuleInput = z.infer<typeof CreateContributionRule>;
export type UpdateContributionRuleInput = z.infer<typeof UpdateContributionRule>;

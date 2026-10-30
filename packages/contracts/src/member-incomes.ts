import { z } from 'zod';
import { MonthInputSchema as MonthInput } from './calendar.js';
const ObjectId = z.string().regex(/^[a-f\d]{24}$/i, 'must be a 24-char hex ObjectId');
export const CreateMemberIncome = z.object({
    accountId: ObjectId,
    memberId: ObjectId,
    amountMinor: z.number().int().nonnegative(),
    fromMonth: MonthInput.nullish(),
    toMonth: MonthInput.nullish()
});
export const UpdateMemberIncome = z.object({
    amountMinor: z.number().int().nonnegative().optional(),
    fromMonth: MonthInput.nullish(),
    toMonth: MonthInput.nullish()
});
export type CreateMemberIncomeInput = z.infer<typeof CreateMemberIncome>;
export type UpdateMemberIncomeInput = z.infer<typeof UpdateMemberIncome>;

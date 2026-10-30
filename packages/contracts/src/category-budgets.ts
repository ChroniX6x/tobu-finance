import { z } from 'zod';
import { MonthInputSchema as MonthInput } from './calendar.js';
const ObjectId = z.string().regex(/^[a-f\d]{24}$/i, 'must be a 24-char hex ObjectId');
export const CreateCategoryBudget = z.object({
    accountId: ObjectId,
    categoryId: ObjectId,
    amountMinor: z.number().int().positive(),
    fromMonth: MonthInput.nullish(),
    toMonth: MonthInput.nullish()
});
export const UpdateCategoryBudget = z.object({
    amountMinor: z.number().int().positive().optional(),
    fromMonth: MonthInput.nullish(),
    toMonth: MonthInput.nullish()
});
export type CreateCategoryBudgetInput = z.infer<typeof CreateCategoryBudget>;
export type UpdateCategoryBudgetInput = z.infer<typeof UpdateCategoryBudget>;

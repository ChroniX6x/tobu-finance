import { z } from 'zod';
import { Month } from './common.js';
export const QueryMonthView = z.object({ month: Month.optional() });
export const QueryPlanning = QueryMonthView;
// Preserve legacy list semantics: handlers only apply filters that are valid ObjectIds.
export const QueryMemberIncomes = z.object({ accountId: z.string().optional(), memberId: z.string().optional() });
export const QueryCategoryBudgets = z.object({ accountId: z.string().optional(), categoryId: z.string().optional() });
export const QueryContributionRules = z.object({ accountId: z.string().optional() });

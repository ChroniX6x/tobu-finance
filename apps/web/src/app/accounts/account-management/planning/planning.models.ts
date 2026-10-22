import type { AccountPlanningResponse, PlanningOverviewVm, BudgetPlanningItemVm, IncomePlanningMemberVm, ContributionBlockVm, PlanningPreviewVm, PlanningHintVm } from '@tobu/contracts/planning';
export type { AccountPlanningResponse, PlanningOverviewVm, BudgetPlanningItemVm, IncomePlanningMemberVm, ContributionBlockVm, PlanningPreviewVm, PlanningHintVm } from '@tobu/contracts/planning';

import type {z} from 'zod';
import type {CreateCategoryBudget, UpdateCategoryBudget} from '@tobu/contracts/category-budgets';
import type {CreateMemberIncome, UpdateMemberIncome} from '@tobu/contracts/member-incomes';
import type {CreateContributionRule, UpdateContributionRule} from '@tobu/contracts/contribution-rules';
export type CreateBudgetPayload = z.input<typeof CreateCategoryBudget>;
export type UpdateBudgetPayload = z.input<typeof UpdateCategoryBudget>;
export type CreateIncomePayload = z.input<typeof CreateMemberIncome>;
export type UpdateIncomePayload = z.input<typeof UpdateMemberIncome>;
// Form-only title is mapped to description by the HTTP service.
export type CreateContributionRulePayload = z.input<typeof CreateContributionRule> & {title:string};
export type UpdateContributionRulePayload = z.input<typeof UpdateContributionRule> & {title?:string};

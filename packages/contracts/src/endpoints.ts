import { z } from 'zod';
import * as accounts from './accounts.js';
import * as members from './members.js';
import * as categories from './categories.js';
import * as transactions from './transactions.js';
import * as recurrences from './recurrences.js';
import * as incomes from './member-incomes.js';
import * as budgets from './category-budgets.js';
import * as rules from './contribution-rules.js';
import * as balances from './account-balances.js';
import * as carryovers from './carryovers.js';
import * as auth from './auth.js';
import * as resources from './resources.js';
import * as views from './views.js';
import { AccountPlanningResponseSchema } from './planning.js';
import { AccountMasterDataResponseSchema } from './master-data.js';
import { QueryAccountsSummary } from './accounts-summary.js';
import { QueryMonthView, QueryPlanning, QueryMemberIncomes, QueryCategoryBudgets, QueryContributionRules } from './read-queries.js';
export interface Endpoint {
    method: string;
    path: string;
    auth: 'bearer' | 'public';
    body?: z.ZodType;
    query?: z.ZodType;
    response?: z.ZodType;
    status: number;
}
const endpoint = (method: string, path: string, response: z.ZodType | undefined, body?: z.ZodType, query?: z.ZodType, status = 200): Endpoint => ({ method, path, auth: 'bearer', status, ...(response ? { response } : {}), ...(body ? { body } : {}), ...(query ? { query } : {}) });
const crud = (path: string, response: z.ZodType, create: z.ZodType, patch: z.ZodType, query?: z.ZodType): Endpoint[] => [
    endpoint('get', path, z.array(response), undefined, query), endpoint('post', path, response, create, undefined, 201), endpoint('patch', path + '/:id', response, patch), endpoint('delete', path + '/:id', undefined, undefined, undefined, 204),
];
export const endpoints: Endpoint[] = [
    endpoint('get', '/api/accounts/summary', z.array(views.ApiAccountsSummaryItemSchema), undefined, QueryAccountsSummary),
    endpoint('get', '/api/accounts/:id/overview', views.ApiAccountOverviewSchema),
    endpoint('get', '/api/accounts/:id/month-view', views.ApiMonthViewSchema, undefined, QueryMonthView),
    endpoint('get', '/api/accounts/:accountId/master-data', AccountMasterDataResponseSchema),
    endpoint('get', '/api/accounts/:accountId/planning', AccountPlanningResponseSchema, undefined, QueryPlanning),
    endpoint('get', '/api/accounts', z.array(resources.AccountResponse), undefined, accounts.QueryAccounts),
    endpoint('get', '/api/accounts/:id', resources.AccountResponse),
    endpoint('get', '/api/accounts/:id/expanded', resources.ExpandedAccountResponse, undefined, accounts.QueryAccountExpanded),
    endpoint('post', '/api/accounts', resources.AccountResponse, accounts.CreateAccount, undefined, 201),
    endpoint('patch', '/api/accounts/:id', resources.AccountResponse, accounts.UpdateAccount),
    endpoint('post', '/api/accounts/:id/members', resources.AccountResponse, accounts.AddMemberToAccount),
    endpoint('delete', '/api/accounts/:id/members/:memberId', resources.AccountResponse),
    ...crud('/api/members', resources.MemberResponse, members.CreateMember, members.UpdateMember, members.QueryMembers),
    ...crud('/api/categories', resources.CategoryResponse, categories.CreateCategory, categories.UpdateCategory, categories.QueryCategories),
    endpoint('get', '/api/transactions', transactions.TransactionsPagedResponseSchema, undefined, transactions.QueryTx),
    endpoint('post', '/api/transactions', transactions.TransactionSchema, transactions.CreateTx, undefined, 201),
    endpoint('patch', '/api/transactions/:id', transactions.TransactionSchema, transactions.PatchTx),
    endpoint('delete', '/api/transactions/:id', undefined, undefined, undefined, 204),
    ...crud('/api/recurrences', resources.RecurrenceResponse, recurrences.CreateRecurrence, recurrences.UpdateRecurrence, recurrences.QueryRecurrences),
    ...crud('/api/member-incomes', resources.MemberIncomeResponse, incomes.CreateMemberIncome, incomes.UpdateMemberIncome, QueryMemberIncomes),
    ...crud('/api/category-budgets', resources.CategoryBudgetResponse, budgets.CreateCategoryBudget, budgets.UpdateCategoryBudget, QueryCategoryBudgets),
    ...crud('/api/contribution-rules', resources.ContributionRuleResponse, rules.CreateContributionRule, rules.UpdateContributionRule, QueryContributionRules),
    endpoint('get', '/api/account-balances', z.array(resources.AccountBalanceResponse), undefined, balances.QueryAccountBalances),
    endpoint('put', '/api/account-balances', resources.AccountBalanceResponse, balances.UpsertAccountBalance),
    endpoint('delete', '/api/account-balances/:id', undefined, undefined, undefined, 204),
    endpoint('get', '/api/carryovers', z.array(resources.CarryOverResponse), undefined, carryovers.QueryCarryOvers),
    endpoint('put', '/api/carryovers', resources.CarryOverResponse, carryovers.UpsertCarryOver),
    endpoint('delete', '/api/carryovers/:id', undefined, undefined, undefined, 204),
    { ...endpoint('post', '/api/auth/register', auth.AuthResponseSchema, auth.registerSchema, undefined, 201), auth: 'public' },
    { ...endpoint('post', '/api/auth/login', auth.AuthResponseSchema, auth.loginSchema), auth: 'public' },
    { ...endpoint('post', '/api/auth/refresh', auth.RefreshResponseSchema), auth: 'public' },
    { ...endpoint('post', '/api/auth/logout', undefined, undefined, undefined, 204), auth: 'public' },
];
export function findEndpoint(method: string, path: string): Endpoint | undefined {
    return endpoints.find(e => e.method === method.toLowerCase() && new RegExp('^' + e.path.replace(/:[^/]+/g, '[^/]+') + '/?$').test(path));
}
/** Inspect the serialized value. Never strip metadata or coerce server responses. */
export function assertResponse(method: string, path: string, status: number, value: unknown): void {
    const e = findEndpoint(method, path);
    if (!e)
        throw new Error(`Undocumented endpoint: ${method} ${path}`);
    if (status >= 400) {
        resources.ErrorResponse.parse(value);
        return;
    }
    if (status !== e.status)
        throw new Error(`Unexpected status ${status} for ${method} ${path}; expected ${e.status}`);
    if (e.response)
        e.response.parse(value);
    else if (value !== undefined && value !== null && value !== '')
        throw new Error('Expected empty response');
}

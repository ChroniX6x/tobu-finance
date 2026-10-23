import { z } from 'zod';
import { ObjId, Split, ISODateTime, MoneyMinor, MoneyMinorAny } from './common.js';
import { AccountSettings } from './accounts.js';
import { TransactionSchema } from './transactions.js';
// JSON transport shapes, not database documents. Extra server metadata is preserved on the wire.
export const MemberResponse = z.object({ _id: ObjId, name: z.string().nullable(), email: z.string().nullable(), userId: ObjId.nullable(), avatar: z.string().nullable() });
export const CategoryResponse = z.object({ _id: ObjId, accountId: ObjId, name: z.string().nullable(), customSplit: z.array(Split) });
export const AccountResponse = z.object({ _id: ObjId, name: z.string().nullable(), currency: z.string(), members: z.array(z.object({ memberId: ObjId, role: z.enum(['owner', 'member']) })), settings: AccountSettings });
const range = { fromMonth: ISODateTime.nullable(), toMonth: ISODateTime.nullable() };
export const MemberIncomeResponse = z.object({ _id: ObjId, accountId: ObjId, memberId: ObjId, amountMinor: MoneyMinor, ...range });
export const CategoryBudgetResponse = z.object({ _id: ObjId, accountId: ObjId, categoryId: ObjId, amountMinor: MoneyMinor, ...range });
export const DistributionResponse = z.object({ mode: z.enum(['perMember', 'customSplit', 'proRataIncome']), memberId: ObjId.nullish(), customSplit: z.array(Split).nullish() });
export const ContributionRuleResponse = z.object({ _id: ObjId, accountId: ObjId, type: z.enum(['base', 'additional', 'topup']), recurring: z.boolean(), description: z.string().nullable(), amountMinor: MoneyMinor, distribution: DistributionResponse, ...range });
export const CarryOverResponse = z.object({ _id: ObjId, accountId: ObjId, memberId: ObjId, month: ISODateTime.nullable(), amountMinor: MoneyMinorAny, reason: z.string().nullable() });
export const AccountBalanceResponse = z.object({ _id: ObjId, accountId: ObjId, month: ISODateTime.nullable(), closingBalanceMinor: MoneyMinorAny });
export const RecurrenceResponse = z.object({ _id: ObjId, accountId: ObjId, categoryId: ObjId.nullable(), title: z.string().nullable(), type: z.enum(['income', 'expense']), amountMinor: MoneyMinor, schedule: z.object({ freq: z.literal('monthly'), dayOfMonth: z.number().int().min(1).max(28) }), activeFrom: ISODateTime, activeUntil: ISODateTime.nullable(), createdByMemberId: ObjId.nullable(), nextPlanned: ISODateTime.nullable(), lastEmitted: ISODateTime.nullable() });
export const ExpandedAccountResponse = z.object({ account: AccountResponse, members: z.array(MemberResponse).optional(), categories: z.array(CategoryResponse).optional(), transactions: z.array(TransactionSchema).optional(), memberIncomes: z.array(MemberIncomeResponse).optional(), carryovers: z.array(CarryOverResponse).optional(), accountBalances: z.array(AccountBalanceResponse).optional(), categoryBudgets: z.array(CategoryBudgetResponse).optional(), recurrences: z.array(RecurrenceResponse).optional() });
export type ApiAccount = z.infer<typeof AccountResponse>;
export type ApiMember = z.infer<typeof MemberResponse>;
export type ApiCategory = z.infer<typeof CategoryResponse>;
// Existing error variants remain explicit; 404 may also be text/plain.
export const ErrorResponse = z.union([
    z.object({ error: z.union([z.string(), z.object({ formErrors: z.array(z.string()), fieldErrors: z.record(z.string(), z.array(z.string())) })]) }).passthrough(),
    z.object({ code: z.string(), message: z.string() }).passthrough(),
]);

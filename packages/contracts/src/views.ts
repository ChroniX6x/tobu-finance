import { z } from "zod";
export const ApiMonthViewMemberSchema = z.object({
    id: z.string(),
    name: z.union([z.string(), z.null()]),
    avatar: z.union([z.string(), z.null()]),
    role: z.union([z.literal('owner'), z.literal('member')]),
    monthlyDueMinor: z.number(),
    paidAmountMinor: z.number(),
    openAmountMinor: z.number(),
    paid: z.boolean(),
    carryoverMinor: z.number(),
    lastPaymentDate: z.union([z.string(), z.null()]),
    privateAdvancesMinor: z.number(),
});
export type ApiMonthViewMember = z.infer<typeof ApiMonthViewMemberSchema>;
export const ApiMonthViewCategorySchema = z.object({
    id: z.string(),
    name: z.union([z.string(), z.null()]),
    spentMinor: z.number(),
    budgetMinor: z.union([z.number(), z.null()]),
    status: z.union([z.literal('ok'), z.literal('over'), z.literal('no_budget')]),
});
export type ApiMonthViewCategory = z.infer<typeof ApiMonthViewCategorySchema>;
export const ApiMonthViewContributionRuleSchema = z.object({
    ruleId: z.string(),
    description: z.union([z.string(), z.null()]),
    type: z.string(),
    amountMinor: z.number(),
    distributionMode: z.string(),
    perMember: z.record(z.string(), z.number()),
});
export type ApiMonthViewContributionRule = z.infer<typeof ApiMonthViewContributionRuleSchema>;
export const ApiMonthViewMemberIncomeSchema = z.object({
    memberId: z.string(),
    amountMinor: z.number(),
    weight: z.number(),
});
export type ApiMonthViewMemberIncome = z.infer<typeof ApiMonthViewMemberIncomeSchema>;
export const ApiMonthViewCarryoverSchema = z.object({
    memberId: z.string(),
    amountMinor: z.number(),
    reason: z.string(),
});
export type ApiMonthViewCarryover = z.infer<typeof ApiMonthViewCarryoverSchema>;
export const ApiMonthViewCategoryHistorySchema = z.object({
    month: z.string(),
    spentByCategoryId: z.record(z.string(), z.number()),
});
export type ApiMonthViewCategoryHistory = z.infer<typeof ApiMonthViewCategoryHistorySchema>;
export const ApiMonthViewSchema = z.object({
    account: z.object({
        id: z.string(),
        name: z.union([z.string(), z.null()]),
        monthIso: z.string(),
    }),
    kpis: z.object({
        totalDueMinor: z.number(),
        totalPaidMinor: z.number(),
        totalSpentMinor: z.number(),
        carryoverTotalMinor: z.number(),
    }),
    members: z.array(ApiMonthViewMemberSchema),
    categories: z.array(ApiMonthViewCategorySchema),
    contributionBreakdown: z.array(ApiMonthViewContributionRuleSchema),
    memberIncomes: z.array(ApiMonthViewMemberIncomeSchema),
    carryovers: z.array(ApiMonthViewCarryoverSchema),
    categoryHistory: z.array(ApiMonthViewCategoryHistorySchema),
});
export type ApiMonthView = z.infer<typeof ApiMonthViewSchema>;
export const ApiAccountsSummaryItemSchema = z.object({
    id: z.string(),
    name: z.string(),
    memberCount: z.number(),
    currentBalanceMinor: z.number(),
    balanceHistoryMinor: z.array(z.number()),
    currentMonth: z.string(),
    stalenessDays: z.number(),
    isStale: z.boolean(),
    missingMonths: z.array(z.string()).optional(),
});
export type ApiAccountsSummaryItem = z.infer<typeof ApiAccountsSummaryItemSchema>;
export const ApiAccountOverviewSchema = z.object({
    account: z.object({
        id: z.string(),
        name: z.string().nullable().optional(),
        currentMonth: z.string(),
        currentBalanceMinor: z.number(),
        balanceChangePct: z.number(),
        forecastMinor: z.number(),
        warning: z.string().nullable().optional(),
        stalenessDays: z.number(),
        isStale: z.boolean(),
        missingMonths: z.array(z.string()).optional(),
    }),
    members: z.array(z.object({
        id: z.string(),
        name: z.string().nullable().optional(),
        role: z.string().optional(),
        avatar: z.union([z.string(), z.null()]).optional(),
        monthlyDueMinor: z.number(),
        paidAmountMinor: z.number(),
        paid: z.boolean(),
    })),
    quickStats: z.object({
        openDuesCount: z.number(),
        pendingRecurringCount: z.number(),
        extraContributionsCount: z.number(),
        extraContributionsSumMinor: z.number(),
        warningsCount: z.number(),
    }),
    charts: z.object({
        history: z.object({
            labels: z.array(z.string()),
            data: z.array(z.number()),
        }),
        incomeVsExpenseMinor: z.object({
            incomeMinor: z.number(),
            expenseMinor: z.number(),
        }),
        topCategories: z.array(z.object({
            name: z.string().nullable().optional(),
            sumMinor: z.number(),
        })),
    }),
    insights: z.array(z.object({
        id: z.string(),
        createdAt: z.string(),
        month: z.string().optional(),
        kind: z.union([z.literal('task'), z.literal('warning'), z.literal('info'), z.literal('critical')]),
        severity: z.union([z.literal('info'), z.literal('warn'), z.literal('error')]),
        scope: z.union([z.literal('all'), z.literal('me')]),
        assigneeId: z.string().optional(),
        status: z.union([z.literal('open'), z.literal('in_progress'), z.literal('resolved'), z.literal('dismissed')]).optional(),
        code: z.string(),
        params: z.record(z.string(), z.any()).optional(),
        entityRef: z.object({
            type: z.union([z.literal('transaction'), z.literal('category'), z.literal('member'), z.literal('account')]),
            id: z.string(),
        }).optional(),
        actions: z.array(z.object({
            labelCode: z.string(),
            route: z.string().optional(),
        })).optional(),
    })),
    timeline: z.array(z.object({
        id: z.string(),
        date: z.string(),
        user: z.string().nullable().optional(),
        text: z.string(),
    })),
});
export type ApiAccountOverview = z.infer<typeof ApiAccountOverviewSchema>;

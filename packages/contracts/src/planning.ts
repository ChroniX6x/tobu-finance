import { z } from "zod";
export const PlanningOverviewVmSchema = z.object({
    activeBudgetSumMinor: z.number(),
    activeBudgetCount: z.number(),
    activeContributionBlockCount: z.number(),
    proRataStatus: z.union([z.literal('notUsed'), z.literal('complete'), z.literal('incomplete')]),
    hintCount: z.number(),
});
export type PlanningOverviewVm = z.infer<typeof PlanningOverviewVmSchema>;
export const BudgetPlanningItemVmSchema = z.object({
    budgetId: z.string(),
    categoryId: z.string(),
    categoryName: z.string().nullable(),
    amountMinor: z.number(),
    fromMonth: z.string(),
    toMonth: z.union([z.string(), z.null()]),
    isActiveInReferenceMonth: z.boolean(),
    hasOverlapConflict: z.boolean(),
    usageHints: z.array(z.string()),
});
export type BudgetPlanningItemVm = z.infer<typeof BudgetPlanningItemVmSchema>;
export const IncomePlanningMemberVmSchema = z.object({
    memberId: z.string(),
    memberName: z.string().nullable(),
    activeIncome: z.union([z.object({
            incomeId: z.string(),
            amountMinor: z.number(),
            fromMonth: z.string(),
            toMonth: z.union([z.string(), z.null()]),
        }), z.null()]),
    incomeSharePct: z.union([z.number(), z.null()]),
    missingForProRata: z.boolean(),
    history: z.array(z.object({
        incomeId: z.string(),
        amountMinor: z.number(),
        fromMonth: z.string(),
        toMonth: z.union([z.string(), z.null()]),
    })),
});
export type IncomePlanningMemberVm = z.infer<typeof IncomePlanningMemberVmSchema>;
export const ContributionBlockVmSchema = z.object({
    id: z.string(),
    source: z.union([z.literal('generatedBase'), z.literal('contributionRule')]),
    ruleId: z.union([z.string(), z.null()]),
    type: z.union([z.literal('base'), z.literal('additional'), z.literal('topup')]),
    title: z.string(),
    description: z.union([z.string(), z.null()]),
    amountMinor: z.number(),
    recurring: z.boolean(),
    fromMonth: z.union([z.string(), z.null()]),
    toMonth: z.union([z.string(), z.null()]),
    distribution: z.object({
        mode: z.union([z.literal('perMember'), z.literal('customSplit'), z.literal('proRataIncome')]),
        memberId: z.string().optional(),
        customSplit: z.array(z.object({
            memberId: z.string(),
            split: z.number(),
        })).optional(),
    }),
    isActiveInReferenceMonth: z.boolean(),
    isEditable: z.boolean(),
    effectByMember: z.array(z.object({
        memberId: z.string(),
        amountMinor: z.number(),
        sharePct: z.number(),
    })),
    usageHints: z.array(z.string()),
});
export type ContributionBlockVm = z.infer<typeof ContributionBlockVmSchema>;
export const PlanningPreviewVmSchema = z.object({
    month: z.string(),
    plannedNeedMinor: z.number(),
    memberDuePreview: z.array(z.object({
        memberId: z.string(),
        memberName: z.string().nullable(),
        dueMinor: z.number(),
        breakdown: z.array(z.object({
            blockId: z.string(),
            title: z.string(),
            amountMinor: z.number(),
        })),
    })),
});
export type PlanningPreviewVm = z.infer<typeof PlanningPreviewVmSchema>;
export const PlanningHintVmSchema = z.object({
    code: z.string(),
    severity: z.union([z.literal('info'), z.literal('warn'), z.literal('error')]),
    message: z.string(),
    target: z.union([z.object({
            kind: z.literal('budget'),
            id: z.string(),
        }), z.object({
            kind: z.literal('income'),
            memberId: z.string(),
        }), z.object({
            kind: z.literal('contributionRule'),
            id: z.string(),
        }), z.object({
            kind: z.literal('general'),
        })]),
});
export type PlanningHintVm = z.infer<typeof PlanningHintVmSchema>;
export const AccountPlanningResponseSchema = z.object({
    accountId: z.string(),
    referenceMonth: z.string(),
    overview: PlanningOverviewVmSchema,
    budgets: z.array(BudgetPlanningItemVmSchema),
    incomes: z.array(IncomePlanningMemberVmSchema),
    contributionBlocks: z.array(ContributionBlockVmSchema),
    specialBlocks: z.array(ContributionBlockVmSchema),
    preview: PlanningPreviewVmSchema,
    hints: z.array(PlanningHintVmSchema),
    categories: z.array(z.object({
        id: z.string(),
        name: z.union([z.string(), z.null()]),
    })),
});
export type AccountPlanningResponse = z.infer<typeof AccountPlanningResponseSchema>;

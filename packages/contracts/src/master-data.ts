import { z } from "zod";
export const AccountMasterVmSchema = z.object({
    _id: z.string(),
    name: z.union([z.string(), z.null()]),
    currency: z.string(),
    memberCount: z.number(),
    settings: z.object({
        dashboard: z.object({
            historyMonths: z.number(),
            topKCategories: z.number(),
        }),
        alerts: z.object({
            lowBalanceForecastMinor: z.union([z.number(), z.null()]),
            carryoverLargeMinor: z.union([z.number(), z.null()]),
            stalenessDays: z.union([z.number(), z.null()]),
        }),
    }),
});
export type AccountMasterVm = z.infer<typeof AccountMasterVmSchema>;
export const MemberMasterItemVmSchema = z.object({
    memberId: z.string(),
    name: z.union([z.string(), z.null()]),
    email: z.union([z.string(), z.null()]),
    avatar: z.union([z.string(), z.null()]),
    role: z.union([z.literal('owner'), z.literal('member')]),
    hasUserAccount: z.boolean(),
    canRemoveFromAccount: z.boolean(),
    canChangeRole: z.boolean(),
    usageHints: z.array(z.string()),
});
export type MemberMasterItemVm = z.infer<typeof MemberMasterItemVmSchema>;
export const CategoryMasterItemVmSchema = z.object({
    categoryId: z.string(),
    name: z.union([z.string(), z.null()]),
    customSplit: z.array(z.object({
        memberId: z.string(),
        split: z.number(),
    })),
    hasCustomSplit: z.boolean(),
    customSplitLabel: z.union([z.string(), z.null()]),
    transactionCount: z.number(),
    recurrenceCount: z.number(),
    hasBudget: z.boolean(),
    canDelete: z.boolean(),
    usageHints: z.array(z.string()),
});
export type CategoryMasterItemVm = z.infer<typeof CategoryMasterItemVmSchema>;
export const MasterDataMetaVmSchema = z.object({
    uncategorizedTransactionCount: z.number(),
    hasSingleMemberInfo: z.boolean(),
    infoHints: z.array(z.string()),
    warningHints: z.array(z.string()),
});
export type MasterDataMetaVm = z.infer<typeof MasterDataMetaVmSchema>;
export const AccountMasterDataResponseSchema = z.object({
    account: AccountMasterVmSchema,
    members: z.array(MemberMasterItemVmSchema),
    categories: z.array(CategoryMasterItemVmSchema),
    meta: MasterDataMetaVmSchema,
});
export type AccountMasterDataResponse = z.infer<typeof AccountMasterDataResponseSchema>;

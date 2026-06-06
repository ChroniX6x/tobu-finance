export interface AccountPlanningResponse {
  accountId: string;
  referenceMonth: string;
  overview: PlanningOverviewVm;
  budgets: BudgetPlanningItemVm[];
  incomes: IncomePlanningMemberVm[];
  contributionBlocks: ContributionBlockVm[];
  specialBlocks: ContributionBlockVm[];
  preview: PlanningPreviewVm;
  hints: PlanningHintVm[];
}

export interface PlanningOverviewVm {
  activeBudgetSumMinor: number;
  activeBudgetCount: number;
  activeContributionBlockCount: number;
  proRataStatus: 'notUsed' | 'complete' | 'incomplete';
  hintCount: number;
}

export interface BudgetPlanningItemVm {
  budgetId: string;
  categoryId: string;
  categoryName: string;
  amountMinor: number;
  fromMonth: string;
  toMonth: string | null;
  isActiveInReferenceMonth: boolean;
  hasOverlapConflict: boolean;
  usageHints: string[];
}

export interface IncomePlanningMemberVm {
  memberId: string;
  memberName: string;
  activeIncome: {
    incomeId: string;
    amountMinor: number;
    fromMonth: string;
    toMonth: string | null;
  } | null;
  incomeSharePct: number | null;
  missingForProRata: boolean;
  history: Array<{
    incomeId: string;
    amountMinor: number;
    fromMonth: string;
    toMonth: string | null;
  }>;
}

export interface ContributionBlockVm {
  id: string;
  source: 'generatedBase' | 'contributionRule';
  ruleId: string | null;
  type: 'base' | 'additional' | 'topup';
  title: string;
  description: string | null;
  amountMinor: number;
  recurring: boolean;
  fromMonth: string | null;
  toMonth: string | null;
  distribution: {
    mode: 'perMember' | 'customSplit' | 'proRataIncome';
    memberId?: string;
    customSplit?: Array<{ memberId: string; split: number }>;
  };
  isActiveInReferenceMonth: boolean;
  isEditable: boolean;
  effectByMember: Array<{
    memberId: string;
    amountMinor: number;
    sharePct: number;
  }>;
  usageHints: string[];
}

export interface PlanningPreviewVm {
  month: string;
  plannedNeedMinor: number;
  memberDuePreview: Array<{
    memberId: string;
    memberName: string;
    dueMinor: number;
    breakdown: Array<{
      blockId: string;
      title: string;
      amountMinor: number;
    }>;
  }>;
}

export interface PlanningHintVm {
  code: string;
  severity: 'info' | 'warn' | 'error';
  message: string;
  target:
    | { kind: 'budget'; id: string }
    | { kind: 'income'; memberId: string }
    | { kind: 'contributionRule'; id: string }
    | { kind: 'general' };
}

// ---- CRUD Payloads ----

export interface CreateBudgetPayload {
  accountId: string;
  categoryId: string;
  amountMinor: number;
  fromMonth: string;
  toMonth?: string | null;
}

export interface UpdateBudgetPayload {
  amountMinor?: number;
  fromMonth?: string;
  toMonth?: string | null;
}

export interface CreateIncomePayload {
  accountId: string;
  memberId: string;
  amountMinor: number;
  fromMonth: string;
  toMonth?: string | null;
}

export interface UpdateIncomePayload {
  amountMinor?: number;
  fromMonth?: string;
  toMonth?: string | null;
}

export interface CreateContributionRulePayload {
  accountId: string;
  title: string;
  description?: string | null;
  amountMinor: number;
  recurring: boolean;
  fromMonth?: string | null;
  toMonth?: string | null;
  type: 'additional' | 'topup';
  distribution: ContributionBlockVm['distribution'];
}

export interface UpdateContributionRulePayload {
  title?: string;
  description?: string | null;
  amountMinor?: number;
  recurring?: boolean;
  fromMonth?: string | null;
  toMonth?: string | null;
  distribution?: ContributionBlockVm['distribution'];
}

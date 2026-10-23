// domain/month-view.ui-model.ts
// Frontend-ViewModel für die MonthView-Seite.
// Alle Geldwerte sind in Minor-Units (Cent) gespeichert; Formatierung erfolgt im Template.

export interface MonthViewKpisUi {
  totalDueMinor: number;       // Monatsbedarf gesamt
  totalPaidMinor: number;      // Eingezahlt gesamt
  totalSpentMinor: number;     // Ausgegeben gesamt
  carryoverTotalMinor: number; // Übertrag gesamt
}

export interface MonthViewMemberUi {
  id: string;
  name: string;
  avatar: string | null;
  role: 'owner' | 'member';
  monthlyDueMinor: number;
  paidAmountMinor: number;
  openAmountMinor: number;
  paid: boolean;
  carryoverMinor: number;
  /** ISO datetime of the most recent booked income transaction; null = no payment yet */
  lastPaymentDate: string | null;
  /** Sum of private-advance expenses paid out of pocket this month */
  privateAdvancesMinor: number;
}

export interface MonthViewCategoryUi {
  id: string;
  name: string;
  spentMinor: number;
  budgetMinor: number | null;
  status: 'ok' | 'over' | 'no_budget';
  /** 0–100, null when no budget defined */
  budgetPct: number | null;
}

export interface MonthViewContributionRuleUi {
  ruleId: string;
  description: string;
  type: string;
  amountMinor: number;
  distributionMode: string;
  /** memberId → amount in Minor */
  perMember: Record<string, number>;
}

export interface MonthViewMemberIncomeUi {
  memberId: string;
  memberName: string;
  amountMinor: number;
  /** 0–1 fraction */
  weight: number;
}

export interface MonthViewCarryoverUi {
  memberId: string;
  memberName: string;
  amountMinor: number;
  reason: string;
}

export interface MonthViewCategoryHistoryUi {
  /** YYYY-MM */
  month: string;
  /** cents per category id */
  spentByCategoryId: Record<string, number>;
}

export interface MonthViewUi {
  accountId: string;
  accountName: string;
  /** YYYY-MM */
  monthIso: string;
  kpis: MonthViewKpisUi;
  members: MonthViewMemberUi[];
  categories: MonthViewCategoryUi[];
  contributionBreakdown: MonthViewContributionRuleUi[];
  memberIncomes: MonthViewMemberIncomeUi[];
  carryovers: MonthViewCarryoverUi[];
  /** Last 6 months of category spend for the history chart */
  categoryHistory: MonthViewCategoryHistoryUi[];
}

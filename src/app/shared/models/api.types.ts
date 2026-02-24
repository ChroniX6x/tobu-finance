export interface ApiAccountsSummaryItem {
  id: string;
  name: string;
  memberCount: number;
  currentBalanceMinor: number;       // cents
  balanceHistoryMinor: number[];     // cents (rolling)
  currentMonth: string;         // ISO month of last reliable snapshot
  stalenessDays: number;        // days since last reliable data
  isStale: boolean;             // true if stalenessDays > threshold
  missingMonths?: string[];     // optional: months without snapshots
}

export interface ApiAccountOverview {
  account: {
    id: string;
    name?: string;
    currentMonth: string;       // ISO month of last reliable snapshot
    currentBalanceMinor: number;     // cents
    balanceChangePct: number;   // %
    forecastMinor: number;           // cents
    warning?: string;
    stalenessDays: number;      // days since last reliable data
    isStale: boolean;           // true if stalenessDays > threshold
    missingMonths?: string[];   // optional: months without snapshots
  };
  members: Array<{
    id: string;
    name?: string;
    role?: string;
    avatar?: string | null;
    monthlyDue: number;         // cents
    paidAmount: number;         // cents
    paid: boolean;
  }>;
  quickStats: {
    openDuesCount: number;
    pendingRecurringCount: number;
    extraContributionsCount: number;
    extraContributionsSumMinor: number; // cents
    warningsCount: number;
  };
  charts: {
    history: {
      labels: string[];         // ISO (Monatsgrenzen oder Tageswerte, laut API)
      data: number[];           // cents
    };
    incomeVsExpenseMinor: {
      incomeMinor: number;           // cents
      expenseMinor: number;          // cents
    };
    topCategories: Array<{ name?: string; sum: number }>; // cents
  };
  insights: Array<{
    id: string;
    createdAt: string;          // ISO
    month?: string;             // ISO
    kind: 'task' | 'warning' | 'info' | 'critical';
    severity: 'info' | 'warn' | 'error';
    scope: 'all' | 'me';
    assigneeId?: string;
    status?: 'open' | 'in_progress' | 'resolved' | 'dismissed';
    code: string;
    params?: Record<string, any>;
    entityRef?: { type: 'transaction' | 'category' | 'member' | 'account'; id: string };
    actions?: Array<{ labelCode: string; route?: string }>;
  }>;
  timeline: Array<{ id: string; date: string; user?: string; text: string }>;
}

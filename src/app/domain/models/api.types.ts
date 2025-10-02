export interface ApiDashboardAccount {
  id: string;
  name: string;
  memberCount: number;
  currentBalance: number;       // cents
  balanceHistory: number[];     // cents (rolling)
}

export interface ApiAccountOverview {
  account: {
    id: string;
    name?: string;
    currentMonth: string;       // ISO
    currentBalance: number;     // cents
    balanceChangePct: number;   // %
    forecast: number;           // cents
    warning?: string;
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
    extraContributionsSum: number; // cents
    warningsCount: number;
  };
  charts: {
    history: {
      labels: string[];         // ISO (Monatsgrenzen oder Tageswerte, laut API)
      data: number[];           // cents
    };
    incomeVsExpense: {
      income: number;           // cents
      expense: number;          // cents
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

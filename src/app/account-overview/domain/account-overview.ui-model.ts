// currency-neutral: amounts in minor units (e.g., cents)

export interface AccountHeaderModel {
  id: string;
  name: string;
  currentMonthIso: string;        // ISO month of last reliable snapshot
  currentBalanceMinor: number;    // was ...Cents
  balanceChangePct: number;
  forecastMinor: number;          // was ...Cents
  warning?: string;
  stalenessDays: number;          // days since last reliable data
  isStale: boolean;               // true if stalenessDays > threshold
  missingMonthsIso?: string[];    // optional: months without snapshots
}

export interface AccountMemberUi {
  id: string;
  name: string;
  role?: string;
  avatar?: string | null;
  monthlyDueMinor: number;        // was ...Cents
  paidAmountMinor: number;        // was ...Cents
  paid: boolean;
}

export interface QuickStatsUi {
  openDuesCount: number;
  pendingRecurringCount: number;
  extraContributionsCount: number;
  extraContributionsSumMinor: number; // was ...Cents
  warningsCount: number;
}

export interface ChartLineData {
  labelsIso: string[];            // ISO
  datasets: Array<{
    label: string;
    dataMinor: number[];          // was dataCents
    fill?: boolean;
    tension?: number;
  }>;
}

export interface ChartDoughnutData {
  labels: string[];
  datasets: Array<{
    dataMinor: number[];          // was dataCents
  }>;
}

export interface ChartPieData extends ChartDoughnutData {}

export interface InsightUi {
  id: string;
  createdAt: string;              // ISO
  month?: string;                 // ISO
  kind: 'task' | 'warning' | 'info' | 'critical';
  severity: 'info' | 'warn' | 'error';
  scope: 'all' | 'me';
  assigneeId?: string;
  status?: 'open' | 'in_progress' | 'resolved' | 'dismissed';
  code: string;
  params?: Record<string, any>;
  entityRef?: { type: 'transaction'|'category'|'member'|'account'; id: string };
  actions?: Array<{ labelCode: string; route?: string }>;
}

export interface TimelineItem {
  id: string;
  date: string;                   // ISO
  user?: string;
  text: string;
}

export interface AccountOverviewUi {
  account: AccountHeaderModel;
  members: AccountMemberUi[];
  quickStats: QuickStatsUi;
  lineChartDataMinor: ChartLineData;    // was ...Cents
  doughnutDataMinor: ChartDoughnutData; // was ...Cents
  pieChartDataMinor: ChartPieData;      // was ...Cents
  insights: InsightUi[];
  timeline: TimelineItem[];
}

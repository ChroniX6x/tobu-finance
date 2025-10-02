// ACHTUNG: Beträge in Cents; Labels (Zeiten) als ISO-Strings.

export interface AccountHeaderModel {
  id: string;
  name: string;
  currentMonthIso: string;     // ISO
  currentBalanceCents: number;
  balanceChangePct: number;
  forecastCents: number;
  warning?: string;
}

export interface AccountMemberUi {
  id: string;
  name: string;
  role?: string;
  avatar?: string | null;
  monthlyDueCents: number;
  paidAmountCents: number;
  paid: boolean;
}

export interface QuickStatsUi {
  openDuesCount: number;
  pendingRecurringCount: number;
  extraContributionsCount: number;
  extraContributionsSumCents: number;
  warningsCount: number;
}

// Wir lassen Farbangaben draußen (dynamische Färbung in der Komponente via CSS-Variablen).
export interface ChartLineData {
  labelsIso: string[];           // ISO
  datasets: Array<{
    label: string;
    dataCents: number[];
    // Farbe/Styling in der Komponente setzen
    fill?: boolean;
    tension?: number;
  }>;
}

export interface ChartDoughnutData {
  labels: string[];
  datasets: Array<{
    dataCents: number[];
    // Farben in der Komponente setzen
  }>;
}

export interface ChartPieData extends ChartDoughnutData {}

export interface InsightUi {
  id: string;
  createdAt: string;             // ISO
  month?: string;                // ISO
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
  date: string;                  // ISO
  user?: string;
  text: string;
}

export interface AccountOverviewUi {
  account: AccountHeaderModel;
  members: AccountMemberUi[];
  quickStats: QuickStatsUi;
  lineChartDataCents: ChartLineData;
  doughnutDataCents: ChartDoughnutData;
  pieChartDataCents: ChartPieData;
  insights: InsightUi[];
  timeline: TimelineItem[];
}

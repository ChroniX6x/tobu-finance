export interface DashboardAccountModel {
  id: string;
  name: string;
  participantCount: number;

  // bereits vorhanden
  currentBalanceMinor: number;
  balanceHistoryMinor: number[]; // z. B. letzte 5 Monate

  // NEU (vom Backend)
  currentMonthIso: string; // MonthKey "2025-08" or UTC month anchor "2025-08-01T00:00:00.000Z" (the API returns the anchor); render via formatMonthValue
  stalenessDays: number; // z. B. 12
  isStale: boolean; // true/false
  missingMonthsIso?: string[]; // optional, z. B. ["2025-09"]

  // recentTransactions: {
  //   date: string; // ISO date string
  //   description: string;
  //   amountMinor: number;
  //   type: 'credit' | 'debit';
  // }[];
}

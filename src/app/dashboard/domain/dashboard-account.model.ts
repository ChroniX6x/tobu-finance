// currency-neutral: amounts in minor units (e.g., cents)
export interface DashboardAccountModel {
  id: string;
  name: string;
  participantCount: number;
  currentBalanceMinor: number;
  balanceHistoryMinor: number[]; // e.g., last 5 months
  // recentTransactions: {
  //   date: string; // ISO date string
  //   description: string;
  //   amountMinor: number;
  //   type: 'credit' | 'debit';
  // }[];
}

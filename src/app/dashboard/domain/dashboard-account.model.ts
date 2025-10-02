// src/app/models/dashboard-account.model.ts
export interface DashboardAccountModel {
  id: string;
  name: string;
  memberCount: number;
  currentBalanceCents: number;
  balanceHistoryCents: number[]; // rolling window
}

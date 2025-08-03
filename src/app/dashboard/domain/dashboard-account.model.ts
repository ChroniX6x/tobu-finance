// src/app/models/dashboard-account.model.ts
export interface DashboardAccountModel {
  id: string;
  name: string;
  participantCount: number;
  currentBalance: number;
  balanceHistory: number[]; // z. B. letzte 5 Monate
}

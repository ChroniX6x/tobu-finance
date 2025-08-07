import { MemberModel } from "./member.model";

export interface AccountBalanceModel {
  month: string;   // z.B. "2025-08"
  value: number;
}

export interface MonthlyIncomeModel {
  memberId: string;
  amount: number;
  startMonth: string;
  endMonth?: string;
}

export interface PlannedContributionModel {
  memberId?: string;
  categoryId?: string;
  amount: number;
  startMonth: string;
  endMonth?: string;
}

export interface AdditionalContributionModel {
  memberId: string;
  amount: number;
  startMonth: string;
  description?: string;
  recurring: boolean;
}

export interface CarryOverBalanceModel {
  memberId: string;
  amount: number;
  month: string;
}

export interface TopUpModel {
  id: string;
  amount: number;
  month: string;
  reason: string;
  date: string;
  customSplit?: { [memberId: string]: number }; // optional
}

export interface AccountModel {
  id: string;
  name: string;
  memberIds: string[];
  members: MemberModel[]; // memberIds
  balances: AccountBalanceModel[];
  monthlyIncomes: MonthlyIncomeModel[];
  monthlyPlannedContributions: PlannedContributionModel[];
  additionalContributions?: AdditionalContributionModel[];
  carryOverBalances: CarryOverBalanceModel[];
  topUps?: TopUpModel[];
}

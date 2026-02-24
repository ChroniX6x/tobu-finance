import { MemberModel } from './member.model';

export interface AccountBalanceModel {
  month: string;   // z.B. "2025-08"
  balanceMinor: number;  // cents
}

export interface MonthlyIncomeModel {
  memberId: string;
  amountMinor: number;  // cents
  startMonth: string;
  endMonth?: string;
}

export interface PlannedContributionModel {
  memberId?: string;
  categoryId?: string;
  amountMinor: number;  // cents
  startMonth: string;
  endMonth?: string;
}

export interface AdditionalContributionModel {
  memberId: string;
  amountMinor: number;  // cents
  startMonth: string;
  description?: string;
  recurring: boolean;
}

export interface CarryOverBalanceModel {
  memberId: string;
  amountMinor: number;  // cents
  month: string;
}

export interface TopUpModel {
  id: string;
  amountMinor: number;  // cents
  month: string;
  reason: string;
  date: string;
  customSplit?: { [memberId: string]: number }; // optional, in cents
}

export interface AccountModel {
  id: string;
  name: string;
  memberIds: string[];
  members: MemberModel[];
  balances: AccountBalanceModel[];
  monthlyIncomes: MonthlyIncomeModel[];
  monthlyPlannedContributions: PlannedContributionModel[];
  additionalContributions?: AdditionalContributionModel[];
  carryOverBalances: CarryOverBalanceModel[];
  topUps?: TopUpModel[];
}

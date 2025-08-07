export interface ExpenseModel {
  id: string;
  accountId: string;
  categoryId: string;
  title: string;
  amount: number;
  month: string;
  isRecurring: boolean;
  isFromSharedAccount: boolean;
  paidBymemberId?: string;
}

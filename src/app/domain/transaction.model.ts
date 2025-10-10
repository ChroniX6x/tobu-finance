export type TransactionType = 'expense' | 'income';

export interface TransactionModel {
  id: string;
  accountId: string;
  categoryId: string | null; // kann auch null für Einkünfte sein
  title: string;
  amountMinor: number;  // cents
  type: TransactionType; // "expense" | "income"
  month: string; // Format: YYYY-MM
  isRecurring: boolean;
  isFromSharedAccount?: boolean;
  paidByMemberId?: string;     // Optional, für nicht-gemeinsame Ausgaben/Einkünfte
  status: 'pending' | 'booked'; // NEU
  recurringTemplateId?: string; // falls aus einer Vorlage generiert
}

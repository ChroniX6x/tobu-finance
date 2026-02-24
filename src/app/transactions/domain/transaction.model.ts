export type TransactionType = 'expense' | 'income';
export type TransactionStatus = 'pending' | 'booked';
export type TransactionSort = 'bookDateDesc' | 'bookDateAsc' | 'amountDesc' | 'amountAsc';

export interface TransactionModel {
  _id: string;
  accountId: string;
  type: TransactionType;
  amountMinor: number;               // Minor Units, immer >= 0
  status: TransactionStatus;         // default: pending
  bookDate: string | null;           // ISO 8601; Pflicht wenn status=booked
  month: string;                     // YYYY-MM-01T00:00:00.000Z (immer gesetzt)
  title: string;                     // 2..80 Zeichen
  notes: string | null;
  categoryId: string | null;         // null = Nicht kategorisiert
  isFromSharedAccount: boolean;      // default: true
  paidByMemberId: string | null;     // Pflicht wenn isFromSharedAccount=false
  parentTransactionId: string | null; // gesetzt => Child (max. Tiefe: 1)
  recurrenceId?: string | null;
  // Legacy (backward compat)
  isRecurring?: boolean;
}

/** API-Response: Parent mit embedded Children */
export interface TransactionWithChildren extends TransactionModel {
  children: TransactionModel[];
}

/** Paginierte Response von GET /api/transactions. `total` zählt nur Parents. */
export interface TransactionsPagedResponse {
  items: TransactionWithChildren[];
  total: number;
  page: number;
  pageSize: number;
}

/** Filter für GET /api/transactions (Phase 1) */
export interface TransactionsFilters {
  accountId: string | null;
  monthFrom: string | null;
  monthTo: string | null;
  status: TransactionStatus | null;
  page: number;
  pageSize: number;
  sort: TransactionSort;
}

/** POST /api/transactions */
export type CreateTransactionDto = Omit<
  TransactionModel,
  '_id' | 'month' | 'recurrenceId' | 'isRecurring' | 'recurringTemplateId'
>;

/** PATCH /api/transactions/:id */
export type PatchTransactionDto = Partial<
  Omit<TransactionModel, '_id' | 'accountId' | 'parentTransactionId' | 'recurrenceId'>
>;

/** Split-Metadaten pro Parent (computed) */
export interface SplitMeta {
  splitCount: number;
  assignedMinor: number;
  restMinor: number;
  completionRatio: number; // 0..1
}

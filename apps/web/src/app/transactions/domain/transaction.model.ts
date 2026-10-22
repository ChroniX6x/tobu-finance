import type {TransactionStatus, TransactionSort} from '@tobu/contracts/transactions';
export type {TransactionType, TransactionStatus, TransactionSort, TransactionModel, TransactionWithChildren, TransactionsPagedResponse, CreateTransactionDto, PatchTransactionDto} from '@tobu/contracts/transactions';

/** Filter für GET /api/transactions (Phase 1) */
export interface TransactionsFilters {
  accountId: string | null;
  monthFrom: string | null;
  monthTo: string | null;
  categoryIds?: string[] | null;
  q?: string | null;
  parentTransactionId?: string | null;
  status: TransactionStatus | null;
  page: number;
  pageSize: number;
  sort: TransactionSort;
}

/** Split-Metadaten pro Parent (computed) */
export interface SplitMeta {
  splitCount: number;
  assignedMinor: number;
  restMinor: number;
  completionRatio: number; // 0..1
}

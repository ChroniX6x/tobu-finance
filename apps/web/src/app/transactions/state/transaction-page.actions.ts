import {
  TransactionsFilters,
  TransactionSort,
  CreateTransactionDto,
  PatchTransactionDto,
  TransactionModel,
} from '../domain/transaction.model';

export class LoadTransactions {
  static readonly type = '[TransactionPage] Load';
  constructor(public filters: Partial<TransactionsFilters>) {}
}

export class SetPage {
  static readonly type = '[TransactionPage] Set Page';
  constructor(public page: number) {}
}

export class SetSort {
  static readonly type = '[TransactionPage] Set Sort';
  constructor(public sort: TransactionSort) {}
}

export class SelectTransaction {
  static readonly type = '[TransactionPage] Select';
  constructor(public id: string | null) {}
}

export class ToggleParentExpanded {
  static readonly type = '[TransactionPage] Toggle Expanded';
  constructor(public parentId: string) {}
}

export class CreateTransactionOptimistic {
  static readonly type = '[TransactionPage] Create Optimistic';
  constructor(public dto: CreateTransactionDto) {}
}

export class PatchTransactionOptimistic {
  static readonly type = '[TransactionPage] Patch Optimistic';
  constructor(public id: string, public patch: PatchTransactionDto) {}
}

/**
 * Optimistisches Delete für Child oder Parent-ohne-Children.
 * Parent mit Children → nicht hier, sondern DeleteTransactionConfirmed nach manuellem Confirm + API-Call.
 */
export class DeleteTransactionOptimistic {
  static readonly type = '[TransactionPage] Delete Optimistic';
  constructor(public id: string) {}
}

/**
 * Wird nach erfolgreichem serverseitigem Delete eines Parents mit Children dispatched.
 * Kein Optimistic, kein Undo — State-Bereinigung nach dem Faktum.
 */
export class DeleteTransactionConfirmed {
  static readonly type = '[TransactionPage] Delete Confirmed';
  constructor(public id: string) {}
}

export class UndoDeleteTransaction {
  static readonly type = '[TransactionPage] Undo Delete';
}

/** Wird von TransactionCaptureState dispatched nachdem ein Draft erfolgreich finalisiert wurde */
export class TransactionCreatedFromFinalize {
  static readonly type = '[TransactionPage] Created From Finalize';
  constructor(public transaction: TransactionModel) {}
}

import { Injectable, inject } from '@angular/core';
import { State, Selector, Action, StateContext } from '@ngxs/store';
import { tap, catchError, concatMap } from 'rxjs/operators';
import { of, from, EMPTY } from 'rxjs';
import { produce } from 'immer';
import {
  TransactionModel,
  TransactionsFilters,
  TransactionsPagedResponse,
  TransactionSort,
  SplitMeta,
  PatchTransactionDto,
  CreateTransactionDto,
} from '@/domain/transaction.model';
import { TransactionsApiService } from '@/domain/transactions-api.service';

// ─── Actions ─────────────────────────────────────────────────────────────────

export class LoadTransactions {
  static readonly type = '[Transactions] Load';
  constructor(public filters: Partial<TransactionsFilters>) {}
}

export class SetPage {
  static readonly type = '[Transactions] Set Page';
  constructor(public page: number) {}
}

export class SetSort {
  static readonly type = '[Transactions] Set Sort';
  constructor(public sort: TransactionSort) {}
}

export class SelectTransaction {
  static readonly type = '[Transactions] Select';
  constructor(public id: string | null) {}
}

export class ToggleParentExpanded {
  static readonly type = '[Transactions] Toggle Expanded';
  constructor(public parentId: string) {}
}

export class CreateTransactionOptimistic {
  static readonly type = '[Transactions] Create Optimistic';
  constructor(public dto: CreateTransactionDto) {}
}

export class PatchTransactionOptimistic {
  static readonly type = '[Transactions] Patch Optimistic';
  constructor(public id: string, public patch: PatchTransactionDto) {}
}

/**
 * Optimistisches Delete für Child oder Parent-ohne-Children.
 * Parent mit Children → nicht hier, sondern DeleteTransactionConfirmed nach manuellem Confirm + API-Call.
 */
export class DeleteTransactionOptimistic {
  static readonly type = '[Transactions] Delete Optimistic';
  constructor(public id: string) {}
}

/**
 * Wird nach erfolgreichem serverseitigem Delete eines Parents mit Children dispatched.
 * Kein Optimistic, kein Undo — State-Bereinigung nach dem Faktum.
 */
export class DeleteTransactionConfirmed {
  static readonly type = '[Transactions] Delete Confirmed';
  constructor(public id: string) {}
}

export class UndoDeleteTransaction {
  static readonly type = '[Transactions] Undo Delete';
}

/** Wird von DraftsState dispatched nachdem ein Draft erfolgreich finalisiert wurde */
export class TransactionCreatedFromFinalize {
  static readonly type = '[Transactions] Created From Finalize';
  constructor(public transaction: TransactionModel) {}
}

// ─── State Model ─────────────────────────────────────────────────────────────

export interface UndoDeleteBuffer {
  parent: TransactionModel;
  children: TransactionModel[];
}

export interface TransactionsStateModel {
  /** Flache Entity-Map: enthält Parents UND Children */
  entities: Record<string, TransactionModel>;
  /** Geordnete Parent-IDs der aktuellen Seite */
  parentIds: string[];
  /** Gesamt-Anzahl Parents server-seitig (ohne Children) */
  total: number;
  filters: TransactionsFilters;
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  expandedParents: string[];
  undoBuffer: UndoDeleteBuffer | null;
}

export const DEFAULT_TRANSACTION_FILTERS: TransactionsFilters = {
  accountId: null,
  monthFrom: null,
  monthTo: null,
  status: null,
  page: 1,
  pageSize: 50,
  sort: 'bookDateDesc',
};

// ─── State ───────────────────────────────────────────────────────────────────

@State<TransactionsStateModel>({
  name: 'transactions',
  defaults: {
    entities: {},
    parentIds: [],
    total: 0,
    filters: DEFAULT_TRANSACTION_FILTERS,
    loading: false,
    error: null,
    selectedId: null,
    expandedParents: [],
    undoBuffer: null,
  },
})
@Injectable()
export class TransactionsState {
  private api = inject(TransactionsApiService);

  // ─── Basis-Selektoren ──────────────────────────────────────────────────────

  @Selector() static entities(s: TransactionsStateModel) { return s.entities; }
  @Selector() static parentIds(s: TransactionsStateModel) { return s.parentIds; }
  @Selector() static total(s: TransactionsStateModel) { return s.total; }
  @Selector() static loading(s: TransactionsStateModel) { return s.loading; }
  @Selector() static error(s: TransactionsStateModel) { return s.error; }
  @Selector() static filters(s: TransactionsStateModel) { return s.filters; }
  @Selector() static selectedId(s: TransactionsStateModel) { return s.selectedId; }
  @Selector() static expandedParents(s: TransactionsStateModel) { return s.expandedParents; }

  @Selector()
  static parents(s: TransactionsStateModel): TransactionModel[] {
    return s.parentIds.map(id => s.entities[id]).filter(Boolean);
  }

  @Selector()
  static selectedTransaction(s: TransactionsStateModel): TransactionModel | null {
    return s.selectedId ? (s.entities[s.selectedId] ?? null) : null;
  }

  // ─── Split-Selektoren (Task 5) ─────────────────────────────────────────────

  /**
   * Record<parentId, children[]> — aus der flachen entities-Map abgeleitet.
   * Nur Parents die tatsächlich Children haben tauchen hier auf.
   */
  @Selector()
  static childrenByParentId(s: TransactionsStateModel): Record<string, TransactionModel[]> {
    const map: Record<string, TransactionModel[]> = {};
    for (const tx of Object.values(s.entities)) {
      if (tx.parentTransactionId) {
        (map[tx.parentTransactionId] ??= []).push(tx);
      }
    }
    return map;
  }

  /**
   * Record<parentId, SplitMeta> — Split-Kennzahlen pro Parent.
   * Nur Parents mit Children sind enthalten (kein Eintrag = splitCount=0, rest=amountMinor).
   */
  @Selector([TransactionsState.entities, TransactionsState.childrenByParentId])
  static splitMetaMap(
    entities: Record<string, TransactionModel>,
    childrenMap: Record<string, TransactionModel[]>,
  ): Record<string, SplitMeta> {
    const result: Record<string, SplitMeta> = {};
    for (const [parentId, children] of Object.entries(childrenMap)) {
      const parent = entities[parentId];
      if (!parent) continue;
      const assignedMinor = children.reduce((sum, c) => sum + c.amountMinor, 0);
      const restMinor = parent.amountMinor - assignedMinor;
      result[parentId] = {
        splitCount: children.length,
        assignedMinor,
        restMinor,
        completionRatio: parent.amountMinor > 0 ? assignedMinor / parent.amountMinor : 0,
      };
    }
    return result;
  }

  /**
   * Record<txId, effectiveAmountMinor>
   * - Child → eigener amountMinor
   * - Parent ohne Children → voller amountMinor
   * - Parent mit Children → restMinor (0 = Container-only)
   */
  @Selector([TransactionsState.entities, TransactionsState.splitMetaMap])
  static effectiveAmountMap(
    entities: Record<string, TransactionModel>,
    splitMeta: Record<string, SplitMeta>,
  ): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [id, tx] of Object.entries(entities)) {
      if (tx.parentTransactionId) {
        result[id] = tx.amountMinor;
      } else {
        result[id] = splitMeta[id]?.restMinor ?? tx.amountMinor;
      }
    }
    return result;
  }

  /**
   * Record<txId, signedAmountMinor> — für Charts.
   * type=expense ? -effectiveAmountMinor : +effectiveAmountMinor
   * Charts konsumieren ausschließlich diesen Selektor.
   */
  @Selector([TransactionsState.entities, TransactionsState.effectiveAmountMap])
  static signedAmountMap(
    entities: Record<string, TransactionModel>,
    effectiveMap: Record<string, number>,
  ): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [id, tx] of Object.entries(entities)) {
      const effective = effectiveMap[id] ?? 0;
      result[id] = tx.type === 'expense' ? -effective : effective;
    }
    return result;
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  @Action(LoadTransactions)
  load(ctx: StateContext<TransactionsStateModel>, { filters }: LoadTransactions) {
    const merged: TransactionsFilters = { ...ctx.getState().filters, ...filters };
    ctx.patchState({ loading: true, error: null, filters: merged });

    return this.api.getTransactions(merged).pipe(
      tap((response: TransactionsPagedResponse) => {
        const entities: Record<string, TransactionModel> = {};
        const parentIds: string[] = [];

        for (const parent of response.items) {
          const { children, ...parentTx } = parent;
          entities[parentTx.id] = parentTx;
          parentIds.push(parentTx.id);
          for (const child of children ?? []) {
            entities[child.id] = child;
          }
        }

        ctx.patchState({ entities, parentIds, total: response.total, loading: false });
      }),
      catchError(err => {
        ctx.patchState({ loading: false, error: err?.message ?? 'Laden fehlgeschlagen' });
        return of(null);
      }),
    );
  }

  @Action(SetPage)
  setPage(ctx: StateContext<TransactionsStateModel>, { page }: SetPage) {
    return ctx.dispatch(new LoadTransactions({ ...ctx.getState().filters, page }));
  }

  @Action(SetSort)
  setSort(ctx: StateContext<TransactionsStateModel>, { sort }: SetSort) {
    return ctx.dispatch(new LoadTransactions({ ...ctx.getState().filters, sort, page: 1 }));
  }

  @Action(SelectTransaction)
  select(ctx: StateContext<TransactionsStateModel>, { id }: SelectTransaction) {
    ctx.patchState({ selectedId: id });
  }

  @Action(ToggleParentExpanded)
  toggleExpanded(ctx: StateContext<TransactionsStateModel>, { parentId }: ToggleParentExpanded) {
    ctx.setState(produce(s => {
      const idx = s.expandedParents.indexOf(parentId);
      if (idx >= 0) {
        s.expandedParents.splice(idx, 1);
      } else {
        s.expandedParents.push(parentId);
      }
    }));
  }

  @Action(CreateTransactionOptimistic)
  createOptimistic(ctx: StateContext<TransactionsStateModel>, { dto }: CreateTransactionOptimistic) {
    return this.api.createTransaction(dto).pipe(
      tap(created => {
        ctx.setState(produce(s => {
          s.entities[created.id] = created;
          if (!created.parentTransactionId) {
            s.parentIds.unshift(created.id);
            s.total++;
          }
        }));
        // Selektiere Parent nach Child-Create, damit der Split-Editor aktuell bleibt
        if (dto.parentTransactionId) {
          ctx.patchState({ selectedId: dto.parentTransactionId });
        }
      }),
      catchError(err => {
        ctx.patchState({ error: err?.message ?? 'Erstellen fehlgeschlagen' });
        return of(null);
      }),
    );
  }

  @Action(PatchTransactionOptimistic)
  patchOptimistic(ctx: StateContext<TransactionsStateModel>, { id, patch }: PatchTransactionOptimistic) {
    const original = ctx.getState().entities[id];
    if (!original) return EMPTY;

    // Optimistisch aktualisieren inkl. Cascade-Spiegelung
    ctx.setState(produce(s => {
      Object.assign(s.entities[id], patch);
      // UI-Cascade: spiegelt server-seitige Cascade für type/status/bookDate
      if ('status' in patch || 'bookDate' in patch || 'type' in patch) {
        for (const tx of Object.values(s.entities)) {
          if (tx.parentTransactionId === id) {
            if ('status' in patch) tx.status = patch.status!;
            if ('bookDate' in patch) tx.bookDate = patch.bookDate!;
            if ('type' in patch) tx.type = patch.type!;
          }
        }
      }
    }));

    return this.api.patchTransaction(id, patch).pipe(
      tap(updated => {
        ctx.setState(produce(s => { s.entities[updated.id] = updated; }));
      }),
      catchError(err => {
        // Rollback
        ctx.setState(produce(s => { s.entities[id] = original; }));
        ctx.patchState({ error: err?.message ?? 'Speichern fehlgeschlagen' });
        return of(null);
      }),
    );
  }

  @Action(DeleteTransactionOptimistic)
  deleteOptimistic(ctx: StateContext<TransactionsStateModel>, { id }: DeleteTransactionOptimistic) {
    const state = ctx.getState();
    const tx = state.entities[id];
    if (!tx) return EMPTY;

    const children = tx.parentTransactionId
      ? [] // ist selbst ein Child
      : Object.values(state.entities).filter(e => e.parentTransactionId === id);

    ctx.patchState({ undoBuffer: { parent: tx, children } });
    ctx.setState(produce(s => {
      delete s.entities[id];
      const idx = s.parentIds.indexOf(id);
      if (idx >= 0) { s.parentIds.splice(idx, 1); s.total--; }
      for (const child of children) { delete s.entities[child.id]; }
      if (s.selectedId === id) s.selectedId = null;
    }));

    return this.api.deleteTransaction(id).pipe(
      catchError(err => {
        // Rollback
        ctx.setState(produce(s => {
          s.entities[tx.id] = tx;
          if (!tx.parentTransactionId) { s.parentIds.push(tx.id); s.total++; }
          for (const child of children) { s.entities[child.id] = child; }
        }));
        ctx.patchState({ undoBuffer: null, error: err?.message ?? 'Löschen fehlgeschlagen' });
        return of(null);
      }),
    );
  }

  @Action(DeleteTransactionConfirmed)
  deleteConfirmed(ctx: StateContext<TransactionsStateModel>, { id }: DeleteTransactionConfirmed) {
    ctx.setState(produce(s => {
      const children = Object.values(s.entities).filter(e => e.parentTransactionId === id);
      delete s.entities[id];
      const idx = s.parentIds.indexOf(id);
      if (idx >= 0) { s.parentIds.splice(idx, 1); s.total--; }
      for (const child of children) { delete s.entities[child.id]; }
      if (s.selectedId === id) s.selectedId = null;
    }));
  }

  @Action(UndoDeleteTransaction)
  undoDelete(ctx: StateContext<TransactionsStateModel>) {
    const { undoBuffer } = ctx.getState();
    if (!undoBuffer) return;

    ctx.setState(produce(s => {
      s.entities[undoBuffer.parent.id] = undoBuffer.parent;
      if (!undoBuffer.parent.parentTransactionId) {
        s.parentIds.push(undoBuffer.parent.id);
        s.total++;
      }
      for (const child of undoBuffer.children) {
        s.entities[child.id] = child;
      }
      s.undoBuffer = null;
    }));
  }

  @Action(TransactionCreatedFromFinalize)
  addFromFinalize(ctx: StateContext<TransactionsStateModel>, { transaction }: TransactionCreatedFromFinalize) {
    ctx.setState(produce(s => {
      s.entities[transaction.id] = transaction;
      if (!transaction.parentTransactionId) {
        s.parentIds.unshift(transaction.id);
        s.total++;
      }
    }));
  }
}


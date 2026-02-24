import { Injectable, inject } from '@angular/core';
import { State, Selector, Action, StateContext } from '@ngxs/store';
import { tap, catchError } from 'rxjs/operators';
import { of, EMPTY } from 'rxjs';
import { produce } from 'immer';
import {
  TransactionModel,
  TransactionsFilters,
  TransactionsPagedResponse,
  SplitMeta,
  PatchTransactionDto,
} from '@/domain/transaction.model';
import { TransactionsApiService } from '@/domain/transactions-api.service';
import {
  LoadTransactions,
  SetPage,
  SetSort,
  SelectTransaction,
  ToggleParentExpanded,
  CreateTransactionOptimistic,
  PatchTransactionOptimistic,
  DeleteTransactionOptimistic,
  DeleteTransactionConfirmed,
  UndoDeleteTransaction,
  TransactionCreatedFromFinalize,
} from './transaction-page.actions';

// ─── State Model ──────────────────────────────────────────────────────────────

export interface TransactionPageUndoBuffer {
  parent: TransactionModel;
  children: TransactionModel[];
}

/** Server-Daten: Entities, Paginierung, Filter */
interface TransactionPageData {
  /** Flache Entity-Map: enthält Parents UND Children */
  entities: Record<string, TransactionModel>;
  /** Geordnete Parent-IDs der aktuellen Seite */
  parentIds: string[];
  /** Gesamt-Anzahl Parents server-seitig (ohne Children) */
  total: number;
  filters: TransactionsFilters;
}

/** UI-Zustand: Ladezustand, Selektion, Expansion, Undo */
interface TransactionPageUi {
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  expandedParents: string[];
  undoBuffer: TransactionPageUndoBuffer | null;
}

// Derived state (SplitMeta, effectiveAmounts) wird ausschließlich über @Selector berechnet,
// kein persistiertes State nötig.

export interface TransactionPageStateModel extends TransactionPageData, TransactionPageUi {}

export const DEFAULT_TRANSACTION_FILTERS: TransactionsFilters = {
  accountId: null,
  monthFrom: null,
  monthTo: null,
  status: null,
  page: 1,
  pageSize: 50,
  sort: 'bookDateDesc',
};

// ─── State ────────────────────────────────────────────────────────────────────

@State<TransactionPageStateModel>({
  name: 'transactionPage',
  defaults: {
    // Data
    entities: {},
    parentIds: [],
    total: 0,
    filters: DEFAULT_TRANSACTION_FILTERS,
    // UI
    loading: false,
    error: null,
    selectedId: null,
    expandedParents: [],
    undoBuffer: null,
  },
})
@Injectable()
export class TransactionPageState {
  private api = inject(TransactionsApiService);

  // ─── Data-Selektoren ──────────────────────────────────────────────────────

  @Selector() static entities(s: TransactionPageStateModel) { return s.entities; }
  @Selector() static parentIds(s: TransactionPageStateModel) { return s.parentIds; }
  @Selector() static total(s: TransactionPageStateModel) { return s.total; }
  @Selector() static filters(s: TransactionPageStateModel) { return s.filters; }

  @Selector()
  static parents(s: TransactionPageStateModel): TransactionModel[] {
    return s.parentIds.map(id => s.entities[id]).filter(Boolean);
  }

  @Selector()
  static selectedTransaction(s: TransactionPageStateModel): TransactionModel | null {
    return s.selectedId ? (s.entities[s.selectedId] ?? null) : null;
  }

  // ─── UI-Selektoren ────────────────────────────────────────────────────────

  @Selector() static loading(s: TransactionPageStateModel) { return s.loading; }
  @Selector() static error(s: TransactionPageStateModel) { return s.error; }
  @Selector() static selectedId(s: TransactionPageStateModel) { return s.selectedId; }
  @Selector() static expandedParents(s: TransactionPageStateModel) { return s.expandedParents; }

  // ─── Derived Selektoren (Split-Logik) ─────────────────────────────────────

  /**
   * Record<parentId, children[]> — aus der flachen entities-Map abgeleitet.
   * Nur Parents die tatsächlich Children haben tauchen hier auf.
   */
  @Selector()
  static childrenByParentId(s: TransactionPageStateModel): Record<string, TransactionModel[]> {
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
  @Selector([TransactionPageState.entities, TransactionPageState.childrenByParentId])
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
  @Selector([TransactionPageState.entities, TransactionPageState.splitMetaMap])
  static effectiveAmountMap(
    entities: Record<string, TransactionModel>,
    splitMeta: Record<string, SplitMeta>,
  ): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [id, tx] of Object.entries(entities)) {
      result[id] = tx.parentTransactionId
        ? tx.amountMinor
        : (splitMeta[id]?.restMinor ?? tx.amountMinor);
    }
    return result;
  }

  /**
   * Record<txId, signedAmountMinor> — für Charts.
   * type=expense → negativ, type=income → positiv.
   */
  @Selector([TransactionPageState.entities, TransactionPageState.effectiveAmountMap])
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

  // ─── Action-Handler ───────────────────────────────────────────────────────

  @Action(LoadTransactions)
  load(ctx: StateContext<TransactionPageStateModel>, { filters }: LoadTransactions) {
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
  setPage(ctx: StateContext<TransactionPageStateModel>, { page }: SetPage) {
    return ctx.dispatch(new LoadTransactions({ ...ctx.getState().filters, page }));
  }

  @Action(SetSort)
  setSort(ctx: StateContext<TransactionPageStateModel>, { sort }: SetSort) {
    return ctx.dispatch(new LoadTransactions({ ...ctx.getState().filters, sort, page: 1 }));
  }

  @Action(SelectTransaction)
  select(ctx: StateContext<TransactionPageStateModel>, { id }: SelectTransaction) {
    ctx.patchState({ selectedId: id });
  }

  @Action(ToggleParentExpanded)
  toggleExpanded(ctx: StateContext<TransactionPageStateModel>, { parentId }: ToggleParentExpanded) {
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
  createOptimistic(ctx: StateContext<TransactionPageStateModel>, { dto }: CreateTransactionOptimistic) {
    return this.api.createTransaction(dto).pipe(
      tap(created => {
        ctx.setState(produce(s => {
          s.entities[created.id] = created;
          if (!created.parentTransactionId) {
            s.parentIds.unshift(created.id);
            s.total++;
          }
        }));
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
  patchOptimistic(ctx: StateContext<TransactionPageStateModel>, { id, patch }: PatchTransactionOptimistic) {
    const original = ctx.getState().entities[id];
    if (!original) return EMPTY;

    ctx.setState(produce(s => {
      Object.assign(s.entities[id], patch);
      // UI-Cascade: spiegelt server-seitige Cascade für type/status/bookDate
      if ('status' in patch || 'bookDate' in patch || 'type' in patch) {
        for (const tx of Object.values(s.entities)) {
          if (tx.parentTransactionId === id) {
            if ('status' in patch) tx.status = (patch as PatchTransactionDto).status!;
            if ('bookDate' in patch) tx.bookDate = (patch as PatchTransactionDto).bookDate!;
            if ('type' in patch) tx.type = (patch as PatchTransactionDto).type!;
          }
        }
      }
    }));

    return this.api.patchTransaction(id, patch).pipe(
      tap(updated => {
        ctx.setState(produce(s => { s.entities[updated.id] = updated; }));
      }),
      catchError(err => {
        ctx.setState(produce(s => { s.entities[id] = original; }));
        ctx.patchState({ error: err?.message ?? 'Speichern fehlgeschlagen' });
        return of(null);
      }),
    );
  }

  @Action(DeleteTransactionOptimistic)
  deleteOptimistic(ctx: StateContext<TransactionPageStateModel>, { id }: DeleteTransactionOptimistic) {
    const state = ctx.getState();
    const tx = state.entities[id];
    if (!tx) return EMPTY;

    const children = tx.parentTransactionId
      ? []
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
  deleteConfirmed(ctx: StateContext<TransactionPageStateModel>, { id }: DeleteTransactionConfirmed) {
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
  undoDelete(ctx: StateContext<TransactionPageStateModel>) {
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
  addFromFinalize(ctx: StateContext<TransactionPageStateModel>, { transaction }: TransactionCreatedFromFinalize) {
    ctx.setState(produce(s => {
      s.entities[transaction.id] = transaction;
      if (!transaction.parentTransactionId) {
        s.parentIds.unshift(transaction.id);
        s.total++;
      }
    }));
  }
}

import { Injectable, inject } from '@angular/core';
import { State, Selector, Action, StateContext, Store } from '@ngxs/store';
import { tap, catchError, concatMap } from 'rxjs/operators';
import { of, from, EMPTY } from 'rxjs';
import { produce } from 'immer';
import { v4 as uuidv4 } from 'uuid';
import { TransactionsApiService } from '@/domain/transactions-api.service';
import { TransactionCreatedFromFinalize } from './transaction-page.actions';
import {
  TransactionDraft,
  DraftStatus,
  CaptureMode,
  computeDraftStatus,
  ToggleDock,
  SetCaptureMode,
  AddDraft,
  UpdateDraft,
  RemoveDraft,
  UndoDraftRemove,
  SelectDraft,
  FinalizeDraft,
  FinalizeAllReadyDrafts,
  RetryFailedDrafts,
} from './transaction-capture.actions';

// Re-export untuk vereinfachten Zugriff von Außen
export type { TransactionDraft, DraftStatus, CaptureMode } from './transaction-capture.actions';
export { computeDraftStatus } from './transaction-capture.actions';

// ─── State Model ──────────────────────────────────────────────────────────────

/** Die Draft-Einträge in der Capture-Queue */
interface TransactionCaptureData {
  drafts: TransactionDraft[];
}

/** Zustand des Capture-Docks und der Selektion */
interface TransactionCaptureUi {
  dockOpen: boolean;
  captureMode: CaptureMode;
  selectedDraftId: string | null;
  undoBuffer: TransactionDraft | null;
}

export interface TransactionCaptureStateModel extends TransactionCaptureData, TransactionCaptureUi {}

// ─── State ────────────────────────────────────────────────────────────────────

@State<TransactionCaptureStateModel>({
  name: 'transactionCapture',
  defaults: {
    // Data
    drafts: [],
    // UI
    dockOpen: false,
    captureMode: 'normal',
    selectedDraftId: null,
    undoBuffer: null,
  },
})
@Injectable()
export class TransactionCaptureState {
  private api = inject(TransactionsApiService);
  private store = inject(Store);

  // ─── Data-Selektoren ──────────────────────────────────────────────────────

  @Selector() static drafts(s: TransactionCaptureStateModel) { return s.drafts; }

  @Selector()
  static readyDrafts(s: TransactionCaptureStateModel): TransactionDraft[] {
    return s.drafts.filter(d => d.draftStatus === 'ready');
  }

  @Selector()
  static draftCount(s: TransactionCaptureStateModel): number {
    return s.drafts.length;
  }

  @Selector()
  static readyCount(s: TransactionCaptureStateModel): number {
    return s.drafts.filter(d => d.draftStatus === 'ready').length;
  }

  // ─── UI-Selektoren ────────────────────────────────────────────────────────

  @Selector() static dockOpen(s: TransactionCaptureStateModel) { return s.dockOpen; }
  @Selector() static captureMode(s: TransactionCaptureStateModel) { return s.captureMode; }
  @Selector() static selectedDraftId(s: TransactionCaptureStateModel) { return s.selectedDraftId; }

  @Selector()
  static selectedDraft(s: TransactionCaptureStateModel): TransactionDraft | null {
    return s.selectedDraftId ? (s.drafts.find(d => d.id === s.selectedDraftId) ?? null) : null;
  }

  // ─── Action-Handler ───────────────────────────────────────────────────────

  @Action(ToggleDock)
  toggleDock(ctx: StateContext<TransactionCaptureStateModel>, { open }: ToggleDock) {
    ctx.patchState({ dockOpen: open ?? !ctx.getState().dockOpen });
  }

  @Action(SetCaptureMode)
  setCaptureMode(ctx: StateContext<TransactionCaptureStateModel>, { mode }: SetCaptureMode) {
    ctx.patchState({ captureMode: mode });
  }

  @Action(AddDraft)
  addDraft(ctx: StateContext<TransactionCaptureStateModel>, { draft }: AddDraft) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const newDraft: TransactionDraft = {
      id: uuidv4(),
      draftStatus: 'draft',
      type: null,
      amountMinor: null,
      title: '',
      notes: null,
      categoryId: null,
      isFromSharedAccount: true,
      paidByMemberId: null,
      bookDate: today,
      parentTransactionId: null,
      source: 'manual',
      errorMessage: null,
      ...draft,
    };

    // Sofort auf Vollständigkeit prüfen (z.B. bei OCR/Import-Drafts)
    if (draft.source && draft.source !== 'manual') {
      newDraft.draftStatus = computeDraftStatus(newDraft);
    }

    ctx.setState(produce(s => { s.drafts.push(newDraft); }));
  }

  @Action(UpdateDraft)
  updateDraft(ctx: StateContext<TransactionCaptureStateModel>, { id, changes, parentRestMinor }: UpdateDraft) {
    ctx.setState(produce(s => {
      const idx = s.drafts.findIndex(d => d.id === id);
      if (idx < 0) return;

      Object.assign(s.drafts[idx], changes);

      if (s.drafts[idx].draftStatus !== 'draft') {
        s.drafts[idx].draftStatus = computeDraftStatus(s.drafts[idx], parentRestMinor);
      }
    }));
  }

  @Action(RemoveDraft)
  removeDraft(ctx: StateContext<TransactionCaptureStateModel>, { id }: RemoveDraft) {
    const draft = ctx.getState().drafts.find(d => d.id === id);
    if (!draft) return;

    ctx.setState(produce(s => {
      s.undoBuffer = { ...draft };
      s.drafts = s.drafts.filter(d => d.id !== id);
      if (s.selectedDraftId === id) s.selectedDraftId = null;
    }));
  }

  @Action(UndoDraftRemove)
  undoDraftRemove(ctx: StateContext<TransactionCaptureStateModel>) {
    const { undoBuffer } = ctx.getState();
    if (!undoBuffer) return;
    ctx.setState(produce(s => {
      s.drafts.push(undoBuffer);
      s.undoBuffer = null;
    }));
  }

  @Action(SelectDraft)
  selectDraft(ctx: StateContext<TransactionCaptureStateModel>, { id }: SelectDraft) {
    ctx.patchState({ selectedDraftId: id });
  }

  @Action(FinalizeDraft)
  finalizeDraft(ctx: StateContext<TransactionCaptureStateModel>, { id }: FinalizeDraft) {
    const draft = ctx.getState().drafts.find(d => d.id === id);
    if (!draft || draft.draftStatus !== 'ready') return EMPTY;

    ctx.setState(produce(s => {
      const d = s.drafts.find(x => x.id === id);
      if (d) d.draftStatus = 'saving';
    }));

    const dto = {
      accountId: draft.accountId!,
      type: draft.type!,
      amountMinor: draft.amountMinor!,
      status: 'booked' as const,
      bookDate: draft.bookDate!,
      title: draft.title,
      notes: draft.notes,
      categoryId: draft.categoryId,
      isFromSharedAccount: draft.isFromSharedAccount,
      paidByMemberId: draft.paidByMemberId,
      parentTransactionId: draft.parentTransactionId,
    };

    return this.api.createTransaction(dto).pipe(
      tap(created => {
        this.store.dispatch(new TransactionCreatedFromFinalize(created));
        ctx.setState(produce(s => {
          s.drafts = s.drafts.filter(d => d.id !== id);
          if (s.selectedDraftId === id) s.selectedDraftId = null;
        }));
      }),
      catchError(err => {
        ctx.setState(produce(s => {
          const d = s.drafts.find(x => x.id === id);
          if (d) {
            d.draftStatus = 'error';
            d.errorMessage = err?.message ?? 'Speichern fehlgeschlagen';
          }
        }));
        return of(null);
      }),
    );
  }

  @Action(FinalizeAllReadyDrafts)
  finalizeAll(ctx: StateContext<TransactionCaptureStateModel>) {
    const readyIds = ctx.getState().drafts
      .filter(d => d.draftStatus === 'ready')
      .map(d => d.id);
    if (!readyIds.length) return EMPTY;

    return from(readyIds).pipe(
      concatMap(id => ctx.dispatch(new FinalizeDraft(id))),
    );
  }

  @Action(RetryFailedDrafts)
  retryFailed(ctx: StateContext<TransactionCaptureStateModel>) {
    ctx.setState(produce(s => {
      for (const d of s.drafts) {
        if (d.draftStatus === 'error') {
          d.draftStatus = 'ready';
          d.errorMessage = null;
        }
      }
    }));
    return ctx.dispatch(new FinalizeAllReadyDrafts());
  }
}

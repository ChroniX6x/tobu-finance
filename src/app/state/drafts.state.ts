import { Injectable, inject } from '@angular/core';
import { State, Selector, Action, StateContext, Store } from '@ngxs/store';
import { tap, catchError, concatMap } from 'rxjs/operators';
import { of, from, EMPTY } from 'rxjs';
import { produce } from 'immer';
import { v4 as uuidv4 } from 'uuid';
import { TransactionType } from '@/domain/transaction.model';
import { TransactionsApiService } from '@/domain/transactions-api.service';
import { TransactionCreatedFromFinalize } from './transactions.state';

// ─── Types ───────────────────────────────────────────────────────────────────

export type DraftStatus = 'draft' | 'needsReview' | 'ready' | 'saving' | 'error';
export type CaptureMode = 'normal' | 'split';
export type DraftSource = 'manual' | 'ocr' | 'pdf' | 'paste';

export interface TransactionDraft {
  id: string;                            // lokale UUID
  draftStatus: DraftStatus;
  accountId: string | null;
  type: TransactionType | null;
  amountMinor: number | null;            // null = noch nicht eingegeben
  title: string;
  notes: string | null;
  categoryId: string | null;
  isFromSharedAccount: boolean;
  paidByMemberId: string | null;
  bookDate: string | null;               // ISO; default: heute
  parentTransactionId: string | null;   // gesetzt = Split-Draft
  source: DraftSource;
  confidence?: Record<string, number>;  // 0..1 pro Feld (Import)
  rawText?: string;
  warnings?: string[];
  errorMessage?: string | null;
}

// ─── Readiness-Check (pure function, exportiert für UI-Nutzung) ───────────────

/**
 * Berechnet den Draft-Status.
 * Gibt 'ready' zurück wenn alle Pflichtfelder für status=booked erfüllt sind,
 * sonst 'needsReview'. 'saving' und 'error' werden durchgereicht.
 *
 * @param parentRestMinor - Nur relevant wenn draft.parentTransactionId gesetzt ist.
 */
export function computeDraftStatus(
  draft: TransactionDraft,
  parentRestMinor?: number,
): DraftStatus {
  if (draft.draftStatus === 'saving' || draft.draftStatus === 'error') {
    return draft.draftStatus;
  }

  const titleOk = draft.title.trim().length >= 2 && draft.title.trim().length <= 80;
  const amountOk = draft.amountMinor !== null && draft.amountMinor >= 0;
  const paidByOk = draft.isFromSharedAccount || draft.paidByMemberId !== null;
  const splitOk =
    !draft.parentTransactionId ||
    (parentRestMinor !== undefined &&
      draft.amountMinor !== null &&
      draft.amountMinor <= parentRestMinor);

  const ready =
    amountOk &&
    draft.type !== null &&
    titleOk &&
    paidByOk &&
    draft.bookDate !== null &&
    draft.accountId !== null &&
    splitOk;

  return ready ? 'ready' : 'needsReview';
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export class ToggleDock {
  static readonly type = '[Drafts] Toggle Dock';
  constructor(public open?: boolean) {}
}

export class SetCaptureMode {
  static readonly type = '[Drafts] Set Capture Mode';
  constructor(public mode: CaptureMode) {}
}

export class AddDraft {
  static readonly type = '[Drafts] Add';
  constructor(public draft: Partial<TransactionDraft> & { accountId: string }) {}
}

export class UpdateDraft {
  static readonly type = '[Drafts] Update';
  constructor(
    public id: string,
    public changes: Partial<TransactionDraft>,
    /** Aktueller rest des Parent (wenn es ein Split-Draft ist) */
    public parentRestMinor?: number,
  ) {}
}

export class RemoveDraft {
  static readonly type = '[Drafts] Remove';
  constructor(public id: string) {}
}

export class UndoDraftRemove {
  static readonly type = '[Drafts] Undo Remove';
}

export class SelectDraft {
  static readonly type = '[Drafts] Select';
  constructor(public id: string | null) {}
}

export class FinalizeDraft {
  static readonly type = '[Drafts] Finalize';
  constructor(public id: string) {}
}

export class FinalizeAllReadyDrafts {
  static readonly type = '[Drafts] Finalize All Ready';
}

export class RetryFailedDrafts {
  static readonly type = '[Drafts] Retry Failed';
}

// ─── State Model ─────────────────────────────────────────────────────────────

export interface DraftsStateModel {
  dockOpen: boolean;
  captureMode: CaptureMode;
  drafts: TransactionDraft[];
  selectedDraftId: string | null;
  undoBuffer: TransactionDraft | null;
}

// ─── State ───────────────────────────────────────────────────────────────────

@State<DraftsStateModel>({
  name: 'drafts',
  defaults: {
    dockOpen: false,
    captureMode: 'normal',
    drafts: [],
    selectedDraftId: null,
    undoBuffer: null,
  },
})
@Injectable()
export class DraftsState {
  private api = inject(TransactionsApiService);
  private store = inject(Store);

  // ─── Selektoren ────────────────────────────────────────────────────────────

  @Selector() static dockOpen(s: DraftsStateModel) { return s.dockOpen; }
  @Selector() static captureMode(s: DraftsStateModel) { return s.captureMode; }
  @Selector() static drafts(s: DraftsStateModel) { return s.drafts; }
  @Selector() static selectedDraftId(s: DraftsStateModel) { return s.selectedDraftId; }

  @Selector()
  static selectedDraft(s: DraftsStateModel): TransactionDraft | null {
    return s.selectedDraftId ? (s.drafts.find(d => d.id === s.selectedDraftId) ?? null) : null;
  }

  @Selector()
  static readyDrafts(s: DraftsStateModel): TransactionDraft[] {
    return s.drafts.filter(d => d.draftStatus === 'ready');
  }

  @Selector()
  static draftCount(s: DraftsStateModel): number {
    return s.drafts.length;
  }

  @Selector()
  static readyCount(s: DraftsStateModel): number {
    return s.drafts.filter(d => d.draftStatus === 'ready').length;
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  @Action(ToggleDock)
  toggleDock(ctx: StateContext<DraftsStateModel>, { open }: ToggleDock) {
    ctx.patchState({ dockOpen: open ?? !ctx.getState().dockOpen });
  }

  @Action(SetCaptureMode)
  setCaptureMode(ctx: StateContext<DraftsStateModel>, { mode }: SetCaptureMode) {
    ctx.patchState({ captureMode: mode });
  }

  @Action(AddDraft)
  addDraft(ctx: StateContext<DraftsStateModel>, { draft }: AddDraft) {
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
  updateDraft(ctx: StateContext<DraftsStateModel>, { id, changes, parentRestMinor }: UpdateDraft) {
    ctx.setState(produce(s => {
      const idx = s.drafts.findIndex(d => d.id === id);
      if (idx < 0) return;

      Object.assign(s.drafts[idx], changes);

      // Status neu berechnen (außer während saving/error)
      if (s.drafts[idx].draftStatus !== 'draft') {
        s.drafts[idx].draftStatus = computeDraftStatus(s.drafts[idx], parentRestMinor);
      }
    }));
  }

  @Action(RemoveDraft)
  removeDraft(ctx: StateContext<DraftsStateModel>, { id }: RemoveDraft) {
    const draft = ctx.getState().drafts.find(d => d.id === id);
    if (!draft) return;

    ctx.setState(produce(s => {
      s.undoBuffer = { ...draft };
      s.drafts = s.drafts.filter(d => d.id !== id);
      if (s.selectedDraftId === id) s.selectedDraftId = null;
    }));
  }

  @Action(UndoDraftRemove)
  undoDraftRemove(ctx: StateContext<DraftsStateModel>) {
    const { undoBuffer } = ctx.getState();
    if (!undoBuffer) return;
    ctx.setState(produce(s => {
      s.drafts.push(undoBuffer);
      s.undoBuffer = null;
    }));
  }

  @Action(SelectDraft)
  selectDraft(ctx: StateContext<DraftsStateModel>, { id }: SelectDraft) {
    ctx.patchState({ selectedDraftId: id });
  }

  @Action(FinalizeDraft)
  finalizeDraft(ctx: StateContext<DraftsStateModel>, { id }: FinalizeDraft) {
    const draft = ctx.getState().drafts.find(d => d.id === id);
    if (!draft || draft.draftStatus !== 'ready') return EMPTY;

    // Status → saving
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
  finalizeAll(ctx: StateContext<DraftsStateModel>) {
    const readyIds = ctx.getState().drafts
      .filter(d => d.draftStatus === 'ready')
      .map(d => d.id);
    if (!readyIds.length) return EMPTY;

    // Sequenziell via concatMap
    return from(readyIds).pipe(
      concatMap(id => ctx.dispatch(new FinalizeDraft(id))),
    );
  }

  @Action(RetryFailedDrafts)
  retryFailed(ctx: StateContext<DraftsStateModel>) {
    // Fehler-Drafts zurück auf 'ready' setzen, dann alle finalisieren
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

import { TransactionType } from '@/domain/transaction.model';

// ─── Draft-Domäne ─────────────────────────────────────────────────────────────

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

/**
 * Berechnet den Draft-Status. Pure function, exportiert für UI-Nutzung.
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

// ─── Actions ──────────────────────────────────────────────────────────────────

export class ToggleDock {
  static readonly type = '[TransactionCapture] Toggle Dock';
  constructor(public open?: boolean) {}
}

export class SetCaptureMode {
  static readonly type = '[TransactionCapture] Set Capture Mode';
  constructor(public mode: CaptureMode) {}
}

export class AddDraft {
  static readonly type = '[TransactionCapture] Add Draft';
  constructor(public draft: Partial<TransactionDraft> & { accountId: string }) {}
}

export class UpdateDraft {
  static readonly type = '[TransactionCapture] Update Draft';
  constructor(
    public id: string,
    public changes: Partial<TransactionDraft>,
    /** Aktueller Rest des Parent (wenn es ein Split-Draft ist) */
    public parentRestMinor?: number,
  ) {}
}

export class RemoveDraft {
  static readonly type = '[TransactionCapture] Remove Draft';
  constructor(public id: string) {}
}

export class UndoDraftRemove {
  static readonly type = '[TransactionCapture] Undo Draft Remove';
}

export class SelectDraft {
  static readonly type = '[TransactionCapture] Select Draft';
  constructor(public id: string | null) {}
}

export class FinalizeDraft {
  static readonly type = '[TransactionCapture] Finalize Draft';
  constructor(public id: string) {}
}

export class FinalizeAllReadyDrafts {
  static readonly type = '[TransactionCapture] Finalize All Ready';
}

export class RetryFailedDrafts {
  static readonly type = '[TransactionCapture] Retry Failed';
}

import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { select, Store } from '@ngxs/store';
import { map } from 'rxjs';
import { DateTime } from 'luxon';
import { v4 as uuidv4 } from 'uuid';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { TransactionCaptureState } from '../../state/transaction-capture.state';
import {
  AddDraft,
  CaptureMode,
  FinalizeAllReadyDrafts,
  FinalizeDraft,
  RemoveDraft,
  RetryFailedDrafts,
  SelectDraft,
  SetCaptureMode,
  ToggleDock,
  TransactionDraft,
  UndoDraftRemove,
  computeDraftStatus,
} from '../../state/transaction-capture.actions';
import { CategoriesState } from '@/shared/state/categories.state';
import { AccountState } from '@/shared/state/account.state';
import { TransactionModel, TransactionType } from '../../domain/transaction.model';
import { TransactionsApiService } from '../../domain/transactions-api.service';
import { disabled, form, FormField, min, minLength, maxLength, required, validate } from '@angular/forms/signals';

type ParentSuggestion = Pick<
  TransactionModel,
  '_id' | 'title' | 'amountMinor' | 'type' | 'isFromSharedAccount' | 'paidByMemberId' | 'bookDate'
> & { restMinor: number };

type DraftStatusSeverity = 'secondary' | 'warn' | 'success' | 'info' | 'danger';

interface CaptureFormModel {
  amount: number | null;
  title: string;
  categoryId: string | null;
  notes: string | null;
  type: TransactionType | null;
  isFromSharedAccount: boolean;
  paidByMemberId: string | null;
  bookDate: Date | null;
  parent: ParentSuggestion | null;
}

function freshCaptureModel(): CaptureFormModel {
  return {
    amount: null,
    title: '',
    categoryId: null,
    notes: null,
    type: 'expense',
    isFromSharedAccount: true,
    paidByMemberId: null,
    bookDate: new Date(),
    parent: null,
  };
}

@Component({
  selector: 'tbf-transactions-dock',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onDocumentKeydown($event)',
  },
  templateUrl: './transactions-dock.html',
  styleUrl: './transactions-dock.scss',
  imports: [
    FormsModule,
    FormField,
    ButtonModule,
    BadgeModule,
    InputTextModule,
    InputNumberModule,
    SelectButtonModule,
    SelectModule,
    DatePickerModule,
    AutoCompleteModule,
    TagModule,
    TooltipModule,
  ],
})
export class TransactionsDock {
  readonly accountId = input.required<string>();

  private store = inject(Store);
  private api = inject(TransactionsApiService);
  private hostElement = inject(ElementRef<HTMLElement>);

  protected dockOpen = select(TransactionCaptureState.dockOpen);
  protected draftCount = select(TransactionCaptureState.draftCount);
  protected readyCount = select(TransactionCaptureState.readyCount);
  protected canUndoRemove = select(TransactionCaptureState.canUndoRemove);
  protected captureMode = select(TransactionCaptureState.captureMode);
  protected drafts = select(TransactionCaptureState.drafts);
  protected selectedDraftId = select(TransactionCaptureState.selectedDraftId);
  protected categories = select(CategoriesState.categories);
  protected account = select(AccountState.account);

  protected modeOptions = [
    { label: 'Normal', value: 'normal' as const },
    { label: 'Teil', value: 'split' as const },
  ];

  protected typeOptions = [
    { label: 'Ausgabe', value: 'expense' as const },
    { label: 'Einnahme', value: 'income' as const },
  ];

  protected sourceOptions = [
    { label: 'Gemeinschaft', value: true },
    { label: 'Privat', value: false },
  ];

  protected categoryOptions = computed(() => [
    { label: 'Nicht kategorisiert', value: null as string | null },
    ...this.categories().map((category) => ({ label: category.name, value: category._id })),
  ]);

  protected memberOptions = computed(() =>
    (this.account()?.members ?? []).map((member) => ({ label: member.name, value: member.id }))
  );

  protected parentSuggestions = signal<ParentSuggestion[]>([]);

  // Derives from captureInput so it stays in sync without a separate signal
  protected readonly selectedParent = computed(() => this.captureInput().parent);

  // Shows validation errors after a submit attempt even if fields are untouched
  protected readonly submitted = signal(false);

  protected readonly captureInput = signal<CaptureFormModel>(freshCaptureModel());

  protected readonly captureForm = form(this.captureInput, (p) => {
    required(p.amount, { message: 'Pflichtfeld' });
    min(p.amount, 0, { message: 'Muss \u2265 0 sein' });
    required(p.title, { message: 'Pflichtfeld' });
    minLength(p.title, 2, { message: 'Mind. 2 Zeichen' });
    maxLength(p.title, 80, { message: 'Max. 80 Zeichen' });
    required(p.bookDate, { message: 'Pflichtfeld' });
    validate(p.paidByMemberId, ({ value, valueOf }) => {
      if (valueOf(p.isFromSharedAccount) === false && !value()) {
        return { kind: 'required', message: 'Pflicht bei Privat' };
      }
      return null;
    });
    validate(p.parent, ({ value }) => {
      if (this.captureMode() === 'split' && !value()) {
        return { kind: 'required', message: 'Parent erforderlich' };
      }
      return null;
    });
    validate(p.amount, ({ value, valueOf }) => {
      const parent = valueOf(p.parent) as ParentSuggestion | null;
      if (parent && this.captureMode() === 'split') {
        const minor = Math.round((value() ?? 0) * 100);
        if (minor > parent.restMinor) {
          return { kind: 'restExceeded', message: 'Betrag \u00fcberschreitet verf\u00fcgbaren Rest' };
        }
      }
      return null;
    });
    disabled(p.type, () => this.captureMode() === 'split');
    disabled(p.isFromSharedAccount, () => this.captureMode() === 'split');
    disabled(p.paidByMemberId, () => this.captureMode() === 'split');
    disabled(p.bookDate, () => this.captureMode() === 'split');
    disabled(p.parent, () => this.captureMode() !== 'split');
  });

  protected setMode(mode: CaptureMode): void {
    this.store.dispatch(new SetCaptureMode(mode));
    if (mode !== 'split') {
      this.parentSuggestions.set([]);
    }
    this.resetForm(mode);
  }

  protected toggleDock(): void {
    this.store.dispatch(new ToggleDock());
  }

  /** Called when the user picks a parent suggestion from the autocomplete. */
  protected onParentSelect(parent: ParentSuggestion): void {
    if (this.captureMode() === 'split') {
      this.captureInput.update(m => ({
        ...m,
        parent,
        type: parent.type,
        isFromSharedAccount: parent.isFromSharedAccount,
        paidByMemberId: parent.paidByMemberId ?? null,
        bookDate: parent.bookDate ? new Date(parent.bookDate) : new Date(),
      }));
    }
  }

  /** Called when the user clears the parent autocomplete. */
  protected onParentClear(): void {
    this.captureInput.update(m => ({
      ...m,
      parent: null,
      type: 'expense',
      isFromSharedAccount: true,
      paidByMemberId: null,
      bookDate: new Date(),
    }));
  }

  protected searchParents(event: { query: string }): void {
    const query = event.query?.trim() ?? '';
    if (!this.accountId()) {
      this.parentSuggestions.set([]);
      return;
    }

    this.api.getTransactions({
      accountId: this.accountId(),
      parentTransactionId: 'null',
      q: query || undefined,
      page: 1,
      pageSize: 20,
      sort: 'bookDateDesc',
    })
      .pipe(
        map((response) => response.items.map((parent) => {
          const assigned = (parent.children ?? []).reduce((sum, child) => sum + child.amountMinor, 0);
          return {
            _id: parent._id,
            title: parent.title,
            amountMinor: parent.amountMinor,
            restMinor: Math.max(0, parent.amountMinor - assigned),
            type: parent.type,
            isFromSharedAccount: parent.isFromSharedAccount,
            paidByMemberId: parent.paidByMemberId,
            bookDate: parent.bookDate,
          } as ParentSuggestion;
        }).filter((candidate) => candidate.restMinor > 0))
      )
      .subscribe((suggestions) => {
        this.parentSuggestions.set(suggestions);
      });
  }

  protected addToQueue(): void {
    this.submitDraft(false);
  }

  protected saveDirectly(): void {
    this.submitDraft(true);
  }

  protected selectDraft(id: string): void {
    this.store.dispatch(new SelectDraft(id));
  }

  protected removeDraft(id: string, event: Event): void {
    event.stopPropagation();
    this.store.dispatch(new RemoveDraft(id));
  }

  protected saveAllReady(): void {
    this.store.dispatch(new FinalizeAllReadyDrafts());
  }

  protected retryFailed(): void {
    this.store.dispatch(new RetryFailedDrafts());
  }

  protected undoRemove(): void {
    this.store.dispatch(new UndoDraftRemove());
  }

  protected finalizeOne(id: string, event: Event): void {
    event.stopPropagation();
    this.store.dispatch(new FinalizeDraft(id));
  }

  protected draftSeverity(status: TransactionDraft['draftStatus']): DraftStatusSeverity {
    switch (status) {
      case 'ready': return 'success';
      case 'needsReview': return 'warn';
      case 'saving': return 'info';
      case 'error': return 'danger';
      default: return 'secondary';
    }
  }

  protected draftStatusLabel(status: TransactionDraft['draftStatus']): string {
    switch (status) {
      case 'needsReview': return 'Pr\u00fcfen';
      case 'ready': return 'Bereit';
      case 'saving': return 'Speichert';
      case 'error': return 'Fehler';
      default: return 'Entwurf';
    }
  }

  protected toMajor(minor: number | null): string {
    if (minor == null) return '-';
    return (minor / 100).toFixed(2);
  }

  protected canSaveAll(): boolean {
    return this.readyCount() > 0;
  }

  protected hasFailedDrafts(): boolean {
    return this.drafts().some((draft) => draft.draftStatus === 'error');
  }

  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.dockOpen()) return;

    const key = event.key.toLowerCase();
    const isSaveShortcut = (event.ctrlKey || event.metaKey) && key === 's';
    if (isSaveShortcut) {
      event.preventDefault();
      if (this.canSaveAll()) this.saveAllReady();
      return;
    }

    const eventTarget = event.target as HTMLElement | null;
    const activeElement = document.activeElement as HTMLElement | null;
    const focusNode = activeElement ?? eventTarget;
    const focusedInsideDock = !!focusNode && this.hostElement.nativeElement.contains(focusNode);
    if (!focusedInsideDock) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.resetForm(this.captureMode());
      return;
    }

    if (event.key === 'Enter') {
      if (focusNode?.tagName === 'TEXTAREA') return;
      event.preventDefault();
      const added = this.submitDraft(false);
      if (added) this.focusAmountInput();
      return;
    }
  }

  private submitDraft(finalizeImmediately: boolean): boolean {
    this.submitted.set(true);

    if (!this.captureForm().valid() || !this.accountId()) return false;

    const m = this.captureInput();
    const parent = m.parent;

    if (this.captureMode() === 'split' && !parent) return false;

    const amountMajor = m.amount;
    if (amountMajor == null) return false;

    const amountMinor = Math.round(amountMajor * 100);
    // Already validated by Signal Forms schema, but guard here too
    if (parent && amountMinor > parent.restMinor) return false;

    const id = uuidv4();
    const isSplit = this.captureMode() === 'split' && !!parent;
    const type = isSplit ? parent!.type : m.type;
    const isFromShared = isSplit ? parent!.isFromSharedAccount : m.isFromSharedAccount;
    const paidByMemberId = isSplit ? parent!.paidByMemberId : m.paidByMemberId;
    const bookDateRaw = isSplit
      ? (parent!.bookDate ? new Date(parent!.bookDate) : new Date())
      : m.bookDate;

    // Bug fix: send YYYY-MM-DD format, not a full ISO timestamp
    const bookDateIso = bookDateRaw instanceof Date
      ? DateTime.fromJSDate(bookDateRaw).toISODate()
      : bookDateRaw;

    const draftPayload: TransactionDraft = {
      id,
      draftStatus: 'needsReview',
      source: 'manual',
      accountId: this.accountId(),
      amountMinor,
      title: m.title.trim(),
      notes: m.notes,
      categoryId: m.categoryId,
      type: type ?? null,
      isFromSharedAccount: !!isFromShared,
      paidByMemberId: paidByMemberId ?? null,
      bookDate: bookDateIso,
      parentTransactionId: isSplit ? parent!._id : null,
      errorMessage: null,
    };

    draftPayload.draftStatus = computeDraftStatus(draftPayload, parent?.restMinor);

    this.store.dispatch(new AddDraft({ ...draftPayload, accountId: this.accountId() }));

    if (finalizeImmediately && draftPayload.draftStatus === 'ready') {
      this.store.dispatch(new FinalizeDraft(id));
    }

    this.resetForm(this.captureMode());
    return true;
  }

  private resetForm(mode: CaptureMode): void {
    const parent = mode === 'split' ? this.captureInput().parent : null;
    this.submitted.set(false);
    this.captureInput.set({
      amount: null,
      title: '',
      categoryId: null,
      notes: null,
      type: mode === 'split' && parent ? parent.type : 'expense',
      isFromSharedAccount: mode === 'split' && parent ? parent.isFromSharedAccount : true,
      paidByMemberId: mode === 'split' && parent ? (parent.paidByMemberId ?? null) : null,
      bookDate: mode === 'split' && parent
        ? (parent.bookDate ? new Date(parent.bookDate) : new Date())
        : new Date(),
      parent,
    });
  }

  private focusAmountInput(): void {
    queueMicrotask(() => {
      const amountInput = this.hostElement.nativeElement.querySelector(
        '.amount-field input'
      ) as HTMLInputElement | null;
      amountInput?.focus();
      amountInput?.select();
    });
  }
}


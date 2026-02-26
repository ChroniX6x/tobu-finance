import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { select, Store } from '@ngxs/store';
import { map } from 'rxjs';
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

type ParentSuggestion = Pick<
  TransactionModel,
  '_id' | 'title' | 'amountMinor' | 'type' | 'isFromSharedAccount' | 'paidByMemberId' | 'bookDate'
> & { restMinor: number };

type DraftStatusSeverity = 'secondary' | 'warn' | 'success' | 'info' | 'danger';

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
    ReactiveFormsModule,
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
  private fb = inject(FormBuilder);
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
  protected memberSuggestions = signal<Array<{ label: string; value: string }>>([]);
  protected selectedParent = signal<ParentSuggestion | null>(null);

  protected form = this.fb.group({
    amount: this.fb.control<number | null>(null, { validators: [Validators.required, Validators.min(0)] }),
    title: this.fb.control('', { validators: [Validators.required, Validators.minLength(2), Validators.maxLength(80)] }),
    categoryId: this.fb.control<string | null>(null),
    notes: this.fb.control<string | null>(null),
    type: this.fb.control<TransactionType | null>('expense', { validators: [Validators.required] }),
    isFromSharedAccount: this.fb.control(true, { validators: [Validators.required] }),
    paidByMemberId: this.fb.control<string | null>(null),
    bookDate: this.fb.control<Date | null>(new Date(), { validators: [Validators.required] }),
    parent: this.fb.control<ParentSuggestion | null>(null),
  });

  constructor() {
    this.form.controls.isFromSharedAccount.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((isShared) => {
        this.applyPaidByValidation(isShared ?? true);
      });

    this.form.controls.parent.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((parent) => {
        this.selectedParent.set(parent);
        if (!parent || this.captureMode() !== 'split') {
          return;
        }

        this.form.patchValue({
          type: parent.type,
          isFromSharedAccount: parent.isFromSharedAccount,
          paidByMemberId: parent.paidByMemberId,
          bookDate: parent.bookDate ? new Date(parent.bookDate) : new Date(),
        });
      });

    effect(() => {
      this.applyMode(this.captureMode());
    });

    effect(() => {
      this.dockOpen();
      this.captureMode();
      this.ensureTypeButtonsTabbable();
    });

  }

  protected setMode(mode: CaptureMode): void {
    this.store.dispatch(new SetCaptureMode(mode));
  }

  protected toggleDock(): void {
    this.store.dispatch(new ToggleDock());
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

  protected searchMembers(event: { query: string }): void {
    const query = (event.query ?? '').trim().toLowerCase();
    const members = this.memberOptions();
    this.memberSuggestions.set(
      query
        ? members.filter((member) => member.label.toLowerCase().includes(query))
        : members
    );
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
      case 'ready':
        return 'success';
      case 'needsReview':
        return 'warn';
      case 'saving':
        return 'info';
      case 'error':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  private ensureTypeButtonsTabbable(): void {
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        const buttons = Array.from(
          this.hostElement.nativeElement.querySelectorAll(
            '.type-field p-togglebutton[role="button"]'
          )
        ) as HTMLElement[];

        if (buttons.length === 0) {
          return;
        }

        for (const button of buttons) {
          button.tabIndex = -1;
        }

        const selected = buttons.find((button) => button.getAttribute('aria-pressed') === 'true');
        (selected ?? buttons[0]).tabIndex = 11;
      });
    });
  }

  protected draftStatusLabel(status: TransactionDraft['draftStatus']): string {
    switch (status) {
      case 'needsReview':
        return 'Prüfen';
      case 'ready':
        return 'Bereit';
      case 'saving':
        return 'Speichert';
      case 'error':
        return 'Fehler';
      default:
        return 'Entwurf';
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
    if (!this.dockOpen()) {
      return;
    }

    const key = event.key.toLowerCase();
    const isSaveShortcut = (event.ctrlKey || event.metaKey) && key === 's';
    if (isSaveShortcut) {
      event.preventDefault();
      if (this.canSaveAll()) {
        this.saveAllReady();
      }
      return;
    }

    const eventTarget = event.target as HTMLElement | null;
    const activeElement = document.activeElement as HTMLElement | null;
    const focusNode = activeElement ?? eventTarget;
    const focusedInsideDock = !!focusNode && this.hostElement.nativeElement.contains(focusNode);
    if (!focusedInsideDock) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.resetForm();
      return;
    }

    if (event.key === 'Tab') {
      const activeField = focusNode?.closest('.amount-field, .type-field, .title-field');
      if (activeField?.classList.contains('amount-field') && !event.shiftKey) {
        event.preventDefault();
        this.focusTypeButton(0, true);
        return;
      }

      if (activeField?.classList.contains('type-field')) {
        event.preventDefault();
        if (event.shiftKey) {
          this.focusAmountInput(true);
        } else {
          this.focusTitleInput(true);
        }
        return;
      }

      if (activeField?.classList.contains('title-field') && event.shiftKey) {
        event.preventDefault();
        this.focusTypeButton(1, true);
        return;
      }
    }

    if (event.key === 'Enter') {
      if (focusNode?.tagName === 'TEXTAREA') {
        return;
      }
      event.preventDefault();
      const added = this.submitDraft(false);
      if (added) {
        this.focusAmountInput();
      }
      return;
    }

  }

  private submitDraft(finalizeImmediately: boolean): boolean {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.accountId()) {
      return false;
    }

    const parent = this.form.controls.parent.value;
    if (this.captureMode() === 'split' && !parent) {
      return false;
    }

    const amountMajor = this.form.controls.amount.value;
    if (amountMajor == null) {
      return false;
    }

    const amountMinor = Math.round(amountMajor * 100);
    if (parent && amountMinor > parent.restMinor) {
      this.form.controls.amount.setErrors({ restExceeded: true });
      return false;
    }

    const id = uuidv4();
    const isSplit = this.captureMode() === 'split' && !!parent;
    const type = isSplit ? parent!.type : this.form.controls.type.value;
    const isFromShared = isSplit ? parent!.isFromSharedAccount : this.form.controls.isFromSharedAccount.value;
    const paidByMemberId = isSplit ? parent!.paidByMemberId : this.form.controls.paidByMemberId.value;
    const bookDateDate = isSplit
      ? (parent!.bookDate ? new Date(parent!.bookDate) : new Date())
      : this.form.controls.bookDate.value;

    const draftPayload: TransactionDraft = {
      id,
      draftStatus: 'needsReview',
      source: 'manual',
      accountId: this.accountId(),
      amountMinor,
      title: this.form.controls.title.value?.trim() ?? '',
      notes: this.form.controls.notes.value,
      categoryId: this.form.controls.categoryId.value,
      type: type ?? null,
      isFromSharedAccount: !!isFromShared,
      paidByMemberId: paidByMemberId ?? null,
      bookDate: bookDateDate ? bookDateDate.toISOString() : null,
      parentTransactionId: isSplit ? parent!._id : null,
      errorMessage: null,
    };

    draftPayload.draftStatus = computeDraftStatus(draftPayload, parent?.restMinor);

    const addDraftPayload: Partial<TransactionDraft> & { accountId: string } = {
      ...draftPayload,
      accountId: this.accountId(),
    };

    this.store.dispatch(new AddDraft(addDraftPayload));

    if (finalizeImmediately && draftPayload.draftStatus === 'ready') {
      this.store.dispatch(new FinalizeDraft(id));
    }

    this.resetForm();
    return true;
  }

  private applyMode(mode: CaptureMode): void {
    const parentControl = this.form.controls.parent;
    const typeControl = this.form.controls.type;
    const sourceControl = this.form.controls.isFromSharedAccount;
    const paidByControl = this.form.controls.paidByMemberId;
    const dateControl = this.form.controls.bookDate;

    if (mode === 'split') {
      parentControl.setValidators([Validators.required]);
      typeControl.disable({ emitEvent: false });
      sourceControl.disable({ emitEvent: false });
      paidByControl.disable({ emitEvent: false });
      dateControl.disable({ emitEvent: false });
    } else {
      parentControl.clearValidators();
      parentControl.setValue(null, { emitEvent: false });
      this.selectedParent.set(null);
      this.parentSuggestions.set([]);
      typeControl.enable({ emitEvent: false });
      sourceControl.enable({ emitEvent: false });
      dateControl.enable({ emitEvent: false });
      this.applyPaidByValidation(sourceControl.value ?? true);
    }

    parentControl.updateValueAndValidity({ emitEvent: false });
  }

  private applyPaidByValidation(isFromSharedAccount: boolean): void {
    const paidByControl = this.form.controls.paidByMemberId;
    if (!isFromSharedAccount) {
      paidByControl.enable({ emitEvent: false });
      paidByControl.setValidators([Validators.required]);
    } else {
      paidByControl.setValue(null, { emitEvent: false });
      paidByControl.clearValidators();
      if (this.captureMode() !== 'split') {
        paidByControl.enable({ emitEvent: false });
      }
    }
    paidByControl.updateValueAndValidity({ emitEvent: false });
  }

  private resetForm(): void {
    const mode = this.captureMode();
    this.form.reset({
      amount: null,
      title: '',
      categoryId: null,
      notes: null,
      type: 'expense',
      isFromSharedAccount: true,
      paidByMemberId: null,
      bookDate: new Date(),
      parent: mode === 'split' ? this.selectedParent() : null,
    });

    if (mode === 'split') {
      this.form.controls.amount.setErrors(null);
    }
  }

  private focusAmountInput(immediate = false): void {
    const focus = () => {
      const amountInput = this.hostElement.nativeElement.querySelector(
        '.amount-field input'
      ) as HTMLInputElement | null;
      amountInput?.focus();
      amountInput?.select();
    };

    if (immediate) {
      focus();
      return;
    }

    queueMicrotask(focus);
  }

  private focusTitleInput(immediate = false): void {
    const focus = () => {
      const titleInput = this.hostElement.nativeElement.querySelector(
        '.title-field input'
      ) as HTMLInputElement | null;
      titleInput?.focus();
      titleInput?.select();
    };

    if (immediate) {
      focus();
      return;
    }

    queueMicrotask(focus);
  }

  private focusTypeButton(index: number, immediate = false): void {
    const focus = () => {
      const buttons = Array.from(this.hostElement.nativeElement.querySelectorAll(
        '.type-field p-togglebutton[role="button"]'
      )) as HTMLElement[];

      if (buttons.length === 0) {
        return;
      }

      for (const button of buttons) {
        button.tabIndex = -1;
      }

      const targetButton = buttons[index] ?? buttons[0];
      targetButton.tabIndex = 11;
      targetButton?.focus();
    };

    if (immediate) {
      focus();
      return;
    }

    queueMicrotask(focus);
  }

}

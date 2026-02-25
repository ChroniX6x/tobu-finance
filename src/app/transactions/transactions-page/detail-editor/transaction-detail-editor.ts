import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  effect,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Store, select } from '@ngxs/store';
import { DateTime } from 'luxon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TextareaModule } from 'primeng/textarea';
import { TagModule } from 'primeng/tag';
import { ProgressBarModule } from 'primeng/progressbar';
import { DividerModule } from 'primeng/divider';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AccountState } from '@/shared/state/account.state';
import { CategoriesState } from '@/shared/state/categories.state';
import { TransactionPageState } from '../../state/transaction-page.state';
import {
  PatchTransactionOptimistic,
  SelectTransaction,
} from '../../state/transaction-page.actions';
import { TransactionModel, TransactionType } from '../../domain/transaction.model';

interface TypeOption {
  label: string;
  value: TransactionType;
}

@Component({
  selector: 'tbf-transaction-detail-editor',
  templateUrl: './transaction-detail-editor.html',
  styleUrl: './transaction-detail-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    DatePickerModule,
    TextareaModule,
    TagModule,
    ProgressBarModule,
    DividerModule,
    ToastModule,
  ],
})
export class TransactionDetailEditor {
  readonly accountId = input.required<string>();

  private store = inject(Store);
  private fb = inject(FormBuilder);
  private messageService = inject(MessageService);

  protected selectedTx = select(TransactionPageState.selectedTransaction);
  protected entities = select(TransactionPageState.entities);
  protected splitMetaMap = select(TransactionPageState.splitMetaMap);
  protected childrenByParentId = select(TransactionPageState.childrenByParentId);
  protected categories = select(CategoriesState.categories);
  protected account = select(AccountState.account);

  protected saving = signal(false);
  protected form!: FormGroup;

  protected typeOptions: TypeOption[] = [
    { label: 'Ausgabe', value: 'expense' },
    { label: 'Einnahme', value: 'income' },
  ];

  protected categoryOptions = computed(() =>
    this.categories().map((c) => ({ label: c.name, value: c.id }))
  );

  protected memberOptions = computed(() => {
    const acc = this.account();
    if (!acc?.members?.length) return [];
    return acc.members.map((m) => ({ label: m.name, value: m.id }));
  });

  protected isChild = computed(() => !!this.selectedTx()?.parentTransactionId);

  protected parentTx = computed<TransactionModel | null>(() => {
    const tx = this.selectedTx();
    if (!tx?.parentTransactionId) return null;
    return this.entities()[tx.parentTransactionId] ?? null;
  });

  protected splitMeta = computed(() => {
    const tx = this.selectedTx();
    if (!tx || tx.parentTransactionId) return null;
    return this.splitMetaMap()[tx._id] ?? null;
  });

  protected children = computed<TransactionModel[]>(() => {
    const tx = this.selectedTx();
    if (!tx || tx.parentTransactionId) return [];
    return this.childrenByParentId()[tx._id] ?? [];
  });

  protected showPaidBy = computed(() => {
    return this.form?.get('isFromSharedAccount')?.value === false;
  });

  constructor() {
    // Initialize form
    this.form = this.fb.group({
      type: [null, Validators.required],
      amountMinor: [null, [Validators.required, Validators.min(0)]],
      title: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
      notes: [null],
      categoryId: [null],
      isFromSharedAccount: [true, Validators.required],
      paidByMemberId: [null],
      bookDate: [null],
      status: [null, Validators.required],
    });

    // Toggle paidBy validation based on source
    this.form.get('isFromSharedAccount')?.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((shared) => {
        const paidByCtrl = this.form.get('paidByMemberId');
        if (!shared) {
          paidByCtrl?.setValidators(Validators.required);
        } else {
          paidByCtrl?.clearValidators();
          paidByCtrl?.setValue(null);
        }
        paidByCtrl?.updateValueAndValidity();
      });

    // Whenever selected transaction changes, repopulate form
    effect(() => {
      const tx = this.selectedTx();
      if (tx && this.form) {
        this.populateForm(tx);
      }
    });
  }

  private populateForm(tx: TransactionModel): void {
    this.form.patchValue({
      type: tx.type,
      amountMinor: tx.amountMinor / 100,
      title: tx.title,
      notes: tx.notes,
      categoryId: tx.categoryId,
      isFromSharedAccount: tx.isFromSharedAccount,
      paidByMemberId: tx.paidByMemberId,
      bookDate: tx.bookDate ? DateTime.fromISO(tx.bookDate).toJSDate() : null,
      status: tx.status,
    }, { emitEvent: false });

    // Child fields are read-only
    if (tx.parentTransactionId) {
      this.form.get('type')?.disable();
      this.form.get('isFromSharedAccount')?.disable();
      this.form.get('paidByMemberId')?.disable();
      this.form.get('bookDate')?.disable();
    } else {
      this.form.get('type')?.enable();
      this.form.get('isFromSharedAccount')?.enable();
      this.form.get('bookDate')?.enable();
    }
  }

  protected save(): void {
    if (!this.form.valid) {
      this.form.markAllAsTouched();
      return;
    }
    const tx = this.selectedTx();
    if (!tx) return;

    const raw = this.form.getRawValue();
    const patch: Record<string, unknown> = {};

    // Only send changed fields
    const fields = ['type', 'title', 'notes', 'categoryId', 'isFromSharedAccount', 'paidByMemberId', 'status'] as const;
    for (const key of fields) {
      const newVal = raw[key];
      const oldVal = (tx as unknown as Record<string, unknown>)[key];
      if (newVal !== oldVal) {
        patch[key] = newVal;
      }
    }

    // amountMinor: form stores euros (display), backend needs cents
    const amountMinorNew = Math.round((raw['amountMinor'] ?? 0) * 100);
    if (amountMinorNew !== tx.amountMinor) {
      patch['amountMinor'] = amountMinorNew;
    }

    // bookDate: convert Date object to ISO string using luxon
    const rawDate = raw['bookDate'];
    const newBookDate = rawDate instanceof Date
      ? DateTime.fromJSDate(rawDate).toISODate()
      : (rawDate as string | null);
    if (newBookDate !== tx.bookDate) {
      patch['bookDate'] = newBookDate;
    }

    if (!Object.keys(patch).length) {
      this.messageService.add({ severity: 'info', summary: 'Keine Änderungen', life: 2000 });
      return;
    }

    this.saving.set(true);
    this.store.dispatch(new PatchTransactionOptimistic(tx._id, patch as any));
    this.saving.set(false);
    this.messageService.add({ severity: 'success', summary: 'Gespeichert', life: 2000 });
  }

  protected goToParent(): void {
    const parent = this.parentTx();
    if (parent) {
      this.store.dispatch(new SelectTransaction(parent._id));
    }
  }

  protected selectChild(child: TransactionModel): void {
    this.store.dispatch(new SelectTransaction(child._id));
  }

  protected formatAmount(minor: number): string {
    return (minor / 100).toFixed(2);
  }

  protected isFieldInvalid(name: string): boolean {
    const ctrl = this.form.get(name);
    return !!ctrl && ctrl.invalid && ctrl.touched;
  }}

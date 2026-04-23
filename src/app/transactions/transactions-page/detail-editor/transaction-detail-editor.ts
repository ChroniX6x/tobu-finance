import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { Store, select } from '@ngxs/store';
import { DateTime } from 'luxon';
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
import { CreateTransactionOptimistic, PatchTransactionOptimistic, SelectTransaction } from '../../state/transaction-page.actions';
import { CreateTransactionDto, PatchTransactionDto, TransactionModel, TransactionStatus, TransactionType } from '../../domain/transaction.model';
import { disabled, form, FormField, FormRoot, min, minLength, maxLength, required, validate } from '@angular/forms/signals';

interface TypeOption {
  label: string;
  value: TransactionType;
}

interface TxFormModel {
  type: TransactionType | null;
  amountMinor: number | null;  // Euros (display), not cents
  title: string;
  notes: string | null;
  categoryId: string | null;
  isFromSharedAccount: boolean;
  paidByMemberId: string | null;
  bookDate: Date | null;
  status: string | null;
}

const EMPTY_TX_MODEL: TxFormModel = {
  type: null,
  amountMinor: null,
  title: '',
  notes: null,
  categoryId: null,
  isFromSharedAccount: true,
  paidByMemberId: null,
  bookDate: null,
  status: null,
};

function txToFormModel(tx: TransactionModel): TxFormModel {
  return {
    type: tx.type,
    amountMinor: tx.amountMinor / 100,
    title: tx.title,
    notes: tx.notes ?? null,
    categoryId: tx.categoryId ?? null,
    isFromSharedAccount: tx.isFromSharedAccount,
    paidByMemberId: tx.paidByMemberId ?? null,
    bookDate: tx.bookDate ? DateTime.fromISO(tx.bookDate).toJSDate() : null,
    status: tx.status,
  };
}

@Component({
  selector: 'tbf-transaction-detail-editor',
  templateUrl: './transaction-detail-editor.html',
  styleUrl: './transaction-detail-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
  imports: [
    FormField,
    FormRoot,
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

  private readonly store = inject(Store);
  private readonly messageService = inject(MessageService);
  protected readonly selectedTx = select(TransactionPageState.selectedTransaction);
  private readonly selectedId = select(TransactionPageState.selectedId);
  private readonly entities = select(TransactionPageState.entities);
  private readonly splitMetaMap = select(TransactionPageState.splitMetaMap);
  private readonly childrenByParentId = select(TransactionPageState.childrenByParentId);
  private readonly categories = select(CategoriesState.categories);
  private readonly account = select(AccountState.account);

  protected readonly saving = signal(false);
  protected readonly isNew = computed(() => this.selectedId() === '__new__');

  protected readonly typeOptions: TypeOption[] = [
    { label: 'Ausgabe', value: 'expense' },
    { label: 'Einnahme', value: 'income' },
  ];

  protected readonly categoryOptions = computed(() =>
    this.categories().map((c) => ({ label: c.name, value: c._id }))
  );

  protected readonly memberOptions = computed(() => {
    const acc = this.account();
    if (!acc?.members?.length) return [];
    return acc.members.map((m) => ({ label: m.name, value: m.id }));
  });

  protected readonly isChild = computed(() => !!this.selectedTx()?.parentTransactionId);

  protected readonly parentTx = computed<TransactionModel | null>(() => {
    const tx = this.selectedTx();
    if (!tx?.parentTransactionId) return null;
    return this.entities()[tx.parentTransactionId] ?? null;
  });

  protected readonly splitMeta = computed(() => {
    const tx = this.selectedTx();
    if (!tx || tx.parentTransactionId) return null;
    return this.splitMetaMap()[tx._id] ?? null;
  });

  protected readonly children = computed<TransactionModel[]>(() => {
    const tx = this.selectedTx();
    if (!tx || tx.parentTransactionId) return [];
    return this.childrenByParentId()[tx._id] ?? [];
  });

  // linkedSignal: recomputes whenever the selected transaction changes.
  // Manual edits (user typing) are written directly to txModel via [formField].
  // When tx is null (new transaction mode or no selection), pre-fill sensible defaults.
  protected readonly txModel = linkedSignal<TransactionModel | null, TxFormModel>({
    source: this.selectedTx,
    computation: (tx) => tx ? txToFormModel(tx) : {
      type: 'expense' as TransactionType,
      amountMinor: null,
      title: '',
      notes: null,
      categoryId: null,
      isFromSharedAccount: true,
      paidByMemberId: null,
      bookDate: new Date(),
      status: 'booked',
    },
  });

  protected readonly txForm = form(
    this.txModel,
    (p) => {
      required(p.type, { message: 'Pflichtfeld' });
      required(p.amountMinor, { message: 'Pflichtfeld' });
      min(p.amountMinor, 0, { message: 'Muss ≥ 0 sein' });
      required(p.title, { message: 'Pflichtfeld' });
      minLength(p.title, 2, { message: 'Mind. 2 Zeichen' });
      maxLength(p.title, 80, { message: 'Max. 80 Zeichen' });
      required(p.isFromSharedAccount, { message: 'Pflichtfeld' });
      required(p.status, { message: 'Pflichtfeld' });
      validate(p.paidByMemberId, ({ value, valueOf }) => {
        if (valueOf(p.isFromSharedAccount) === false && !value()) {
          return { kind: 'required', message: 'Pflichtfeld bei Privat' };
        }
        return null;
      });
      // Child transactions: inherited fields are read-only
      disabled(p.type, () => this.isChild());
      disabled(p.isFromSharedAccount, () => this.isChild());
      disabled(p.paidByMemberId, () => this.isChild());
      disabled(p.bookDate, () => this.isChild());
    },
    {
      submission: {
        action: async () => this.save(),
      },
    },
  );

  /** Save button is enabled when the form has changes (edit) or is valid (create). */
  protected readonly canSave = computed(
    () => this.isNew() ? this.txForm().valid() : (this.hasChanges() && this.txForm().valid()),
  );

  // Compares current form values against original tx for save-button enabled state
  protected readonly hasChanges = computed(() => {
    const tx = this.selectedTx();
    if (!tx) return false;
    const m = this.txModel();
    const fields = [
      'type', 'title', 'notes', 'categoryId',
      'isFromSharedAccount', 'paidByMemberId', 'status',
    ] as const;
    if (fields.some((k) => m[k] !== (tx[k] ?? null))) return true;
    if (Math.round((m.amountMinor ?? 0) * 100) !== tx.amountMinor) return true;
    const newDate = m.bookDate instanceof Date
      ? DateTime.fromJSDate(m.bookDate).toISODate()
      : m.bookDate;
    const txDate = tx.bookDate ? DateTime.fromISO(tx.bookDate).toISODate() : null;
    return newDate !== txDate;
  });

  protected save(): void {
    if (this.isNew()) {
      this.createNew();
      return;
    }
    const tx = this.selectedTx();
    if (!tx) return;

    const m = this.txModel();
    const patch: PatchTransactionDto = {};

    const fields = [
      'type', 'title', 'notes', 'categoryId',
      'isFromSharedAccount', 'paidByMemberId', 'status',
    ] as const;
    for (const key of fields) {
      const newVal = m[key];
      const oldVal = tx[key] ?? null;
      if (newVal !== oldVal) (patch as Record<string, unknown>)[key] = newVal;
    }

    const amountMinorNew = Math.round((m.amountMinor ?? 0) * 100);
    if (amountMinorNew !== tx.amountMinor) patch.amountMinor = amountMinorNew;

    const rawDate = m.bookDate;
    const newBookDateStr = rawDate instanceof Date
      ? DateTime.fromJSDate(rawDate).toISODate()
      : rawDate;
    const oldBookDateStr = tx.bookDate ? DateTime.fromISO(tx.bookDate).toISODate() : null;
    if (newBookDateStr !== oldBookDateStr) {
      patch.bookDate = newBookDateStr ? `${newBookDateStr}T00:00:00.000Z` : null;
    }

    if (!Object.keys(patch).length) {
      this.messageService.add({ severity: 'info', summary: 'Keine \u00c4nderungen', life: 2000 });
      return;
    }

    this.saving.set(true);
    // The transaction ID is passed as the first argument and will be placed in the URL path
    // (/api/transactions/:id). It is NOT sent in the patch body.
    this.store.dispatch(new PatchTransactionOptimistic(tx._id, patch));
    this.saving.set(false);
    this.messageService.add({ severity: 'success', summary: 'Gespeichert', life: 2000 });
  }

  private createNew(): void {
    // Guard: don't submit invalid forms (user sees nothing if invalid — expand with error display if needed)
    if (!this.txForm().valid()) return;
    const m = this.txModel();
    const bookDateRaw = m.bookDate;
    const isoDate = bookDateRaw instanceof Date ? DateTime.fromJSDate(bookDateRaw).toISODate() : bookDateRaw;
    const bookDate = isoDate ? `${isoDate}T00:00:00.000Z` : null;

    const dto: CreateTransactionDto = {
      accountId: this.accountId(),
      type: m.type ?? 'expense',
      amountMinor: Math.round((m.amountMinor ?? 0) * 100),
      title: m.title,
      notes: m.notes,
      categoryId: m.categoryId,
      isFromSharedAccount: m.isFromSharedAccount,
      paidByMemberId: m.paidByMemberId,
      bookDate: bookDate,
      status: (m.status ?? 'booked') as TransactionStatus,
      parentTransactionId: null,
    };
    this.store.dispatch(new CreateTransactionOptimistic(dto));
    this.messageService.add({ severity: 'success', summary: 'Buchung angelegt', life: 2000 });
  }

  protected goToParent(): void {
    const parent = this.parentTx();
    if (parent) this.store.dispatch(new SelectTransaction(parent._id));
  }

  protected selectChild(child: TransactionModel): void {
    this.store.dispatch(new SelectTransaction(child._id));
  }

  protected formatAmount(minor: number): string {
    return (minor / 100).toFixed(2);
  }
}

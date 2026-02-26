import { ChangeDetectionStrategy, Component, computed, inject, input, signal, effect } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Store, select } from '@ngxs/store';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { DateTime } from 'luxon';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { DatePickerModule } from 'primeng/datepicker';
import { ChipModule } from 'primeng/chip';
import { AccountState } from '@/shared/state/account.state';
import { CategoriesState } from '@/shared/state/categories.state';
import { TransactionPageState } from '../../state/transaction-page.state';
import { TransactionCaptureState } from '../../state/transaction-capture.state';
import {
  LoadTransactions,
  SelectTransaction,
} from '../../state/transaction-page.actions';
import {
  AddDraft,
  ToggleDock,
} from '../../state/transaction-capture.actions';

interface ActiveFilter {
  key: string;
  label: string;
}

interface SourceOption {
  label: string;
  value: string | null;
}

@Component({
  selector: 'tbf-transaction-toolbar',
  templateUrl: './transaction-toolbar.html',
  styleUrl: './transaction-toolbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ButtonModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    SelectModule,
    MultiSelectModule,
    DatePickerModule,
    ChipModule,
  ],
})
export class TransactionToolbar {
  readonly accountId = input.required<string>();

  private store = inject(Store);
  private searchSubject = new Subject<string>();

  protected filters = select(TransactionPageState.filters);
  protected categories = select(CategoriesState.categories);
  protected account = select(AccountState.account);

  // Local filter form state
  protected searchValue = signal('');
  protected selectedCategoryIds = signal<string[]>([]);
  protected selectedSource = signal<string | null>(null);
  protected selectedPaidBy = signal<string | null>(null);
  protected dateRange = signal<Date[]>([]);

  protected sourceOptions: SourceOption[] = [
    { label: 'Alle', value: null },
    { label: 'Gemeinschaftskonto', value: 'shared' },
    { label: 'Privat', value: 'private' },
  ];

  protected membersOptions = computed(() => {
    const acc = this.account();
    if (!acc?.members?.length) return [];
    return [
      { label: 'Alle', value: null },
      ...acc.members.map((m) => ({ label: m.name, value: m.id })),
    ];
  });

  protected categoryOptions = computed(() => [
    { label: 'Nicht kategorisiert', value: '__UNCATEGORIZED__' },
    ...this.categories().map((c) => ({ label: c.name, value: c._id }))
  ]);

  protected activeFilters = computed<ActiveFilter[]>(() => {
    const chips: ActiveFilter[] = [];
    if (this.searchValue()) {
      chips.push({ key: 'q', label: `Suche: ${this.searchValue()}` });
    }
    if (this.selectedCategoryIds().length) {
      const names = this.selectedCategoryIds()
        .map((id) => {
          if (id === '__UNCATEGORIZED__') return 'Nicht kategorisiert';
          return this.categories().find((c) => c._id === id)?.name ?? id;
        })
        .join(', ');
      chips.push({ key: 'categories', label: `Kategorie: ${names}` });
    }
    if (this.selectedSource()) {
      const label = this.sourceOptions.find((s) => s.value === this.selectedSource())?.label ?? '';
      chips.push({ key: 'source', label: `Quelle: ${label}` });
    }
    if (this.selectedPaidBy()) {
      const m = this.account()?.members?.find((m) => m.id === this.selectedPaidBy());
      chips.push({ key: 'paidBy', label: `Bezahlt von: ${m?.name ?? ''}` });
    }
    if (this.dateRange().length === 2) {
      const start = this.dateRange()[0];
      const end = this.dateRange()[1];
      chips.push({ key: 'dateRange', label: `Zeitraum: ${this.formatDateTime(start)} – ${this.formatDateTime(end)}` });
    }
    return chips;
  });

  constructor() {
    this.searchSubject
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((q) => {
        this.dispatchLoad({ q: q || undefined });
      });

    // Search effect
    effect(() => {
      const q = this.searchValue();
      this.searchSubject.next(q);
    });

    // All other filters effect
    effect(() => {
      this.selectedCategoryIds();
      this.selectedSource();
      this.selectedPaidBy();
      this.dateRange();
      this.dispatchLoad();
    });
  }

  protected onCategoryChange(categoryIds: string[]): void {
    this.selectedCategoryIds.set(categoryIds);
  }

  protected removeFilter(key: string): void {
    switch (key) {
      case 'q':
        this.searchValue.set('');
        this.dispatchLoad({ q: undefined });
        break;
      case 'categories':
        this.selectedCategoryIds.set([]);
        this.dispatchLoad();
        break;
      case 'source':
        this.selectedSource.set(null);
        this.dispatchLoad();
        break;
      case 'paidBy':
        this.selectedPaidBy.set(null);
        this.dispatchLoad();
        break;
      case 'dateRange':
        this.dateRange.set([]);
        this.dispatchLoad();
        break;
    }
  }

  protected resetAll(): void {
    this.searchValue.set('');
    this.selectedCategoryIds.set([]);
    this.selectedSource.set(null);
    this.selectedPaidBy.set(null);
    this.dateRange.set([]);
    this.store.dispatch(new LoadTransactions({ accountId: this.accountId(), page: 1 }));
  }

  protected newTransaction(): void {
    this.store.dispatch(new SelectTransaction(null));
    this.store.dispatch([
      new AddDraft({ accountId: this.accountId() }),
      new ToggleDock(true),
    ]);
  }

  private dispatchLoad(extra?: { q?: string }): void {
    if (!this.accountId()) {
      return;
    }
    const range = this.dateRange();
    const monthFrom = range.length >= 1 ? this.toMonthString(range[0]) : undefined;
    const monthTo = range.length === 2 && range[1] ? this.toMonthString(range[1]) : undefined;
    const selectedCats = this.selectedCategoryIds();
    
    // Backend handles __UNCATEGORIZED__ marker and combinations automatically
    const categoryIds = selectedCats.length > 0 ? selectedCats : null;

    this.store.dispatch(
      new LoadTransactions({
        accountId: this.accountId(),
        page: 1,
        monthFrom: monthFrom ?? null,
        monthTo: monthTo ?? null,
        categoryIds,
        ...extra,
      })
    );
  }

  private toMonthString(d: Date): string {
    return DateTime.fromJSDate(d).toFormat('yyyy-MM');
  }

  private formatDateTime(d: Date): string {
    return DateTime.fromJSDate(d).toFormat('dd.MM.yyyy');
  }
}

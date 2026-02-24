import { ChangeDetectionStrategy, Component, computed, inject, input, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Store, select } from '@ngxs/store';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';
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
export class TransactionToolbar implements OnInit, OnDestroy {
  readonly accountId = input.required<string>();

  private store = inject(Store);
  private destroy$ = new Subject<void>();
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

  protected categoryOptions = computed(() =>
    this.categories().map((c) => ({ label: c.name, value: c.id }))
  );

  protected activeFilters = computed<ActiveFilter[]>(() => {
    const chips: ActiveFilter[] = [];
    if (this.searchValue()) {
      chips.push({ key: 'q', label: `Suche: ${this.searchValue()}` });
    }
    if (this.selectedCategoryIds().length) {
      const names = this.selectedCategoryIds()
        .map((id) => this.categories().find((c) => c.id === id)?.name ?? id)
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
      chips.push({ key: 'dateRange', label: `Zeitraum: ${this.formatDate(this.dateRange()[0])} – ${this.formatDate(this.dateRange()[1])}` });
    }
    return chips;
  });

  ngOnInit(): void {
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    ).subscribe((q) => {
      this.dispatchLoad({ q: q || undefined });
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected onSearchInput(value: string): void {
    this.searchValue.set(value);
    this.searchSubject.next(value);
  }

  protected onCategoriesChange(ids: string[]): void {
    this.selectedCategoryIds.set(ids);
    this.dispatchLoad();
  }

  protected onSourceChange(value: string | null): void {
    this.selectedSource.set(value);
    this.dispatchLoad();
  }

  protected onPaidByChange(value: string | null): void {
    this.selectedPaidBy.set(value);
    this.dispatchLoad();
  }

  protected onDateRangeChange(range: Date[]): void {
    this.dateRange.set(range);
    if (range.length === 2 && range[1]) {
      this.dispatchLoad();
    }
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
    const range = this.dateRange();
    const monthFrom = range.length >= 1 ? this.toMonthString(range[0]) : undefined;
    const monthTo = range.length === 2 && range[1] ? this.toMonthString(range[1]) : undefined;

    this.store.dispatch(
      new LoadTransactions({
        accountId: this.accountId(),
        page: 1,
        monthFrom: monthFrom ?? null,
        monthTo: monthTo ?? null,
        ...extra,
      })
    );
  }

  private toMonthString(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  private formatDate(d: Date): string {
    return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
  }
}

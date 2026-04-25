import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Store, select } from '@ngxs/store';
import { CurrencyPipe, DatePipe, NgClass, PercentPipe, SlicePipe } from '@angular/common';
import { DateTime } from 'luxon';

import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { AccordionModule } from 'primeng/accordion';
import { AvatarModule } from 'primeng/avatar';
import { SkeletonModule } from 'primeng/skeleton';
import { DatePickerModule } from 'primeng/datepicker';
import { FormsModule } from '@angular/forms';

import { MonthViewState } from './month-view.state';
import { LoadMonthView } from './month-view.actions';
import { EinzahlungDrawer } from './components/einzahlung-drawer';
import { MonthViewMemberUi } from '@/accounts/domain/month-view.ui-model';

@Component({
  selector: 'tbf-month-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './month-view.html',
  styleUrl: './month-view.scss',
  imports: [
    NgClass,
    CurrencyPipe,
    DatePipe,
    PercentPipe,
    FormsModule,
    ButtonModule,
    ProgressBarModule,
    TagModule,
    TooltipModule,
    AccordionModule,
    AvatarModule,
    SkeletonModule,
    DatePickerModule,
    SlicePipe,
    EinzahlungDrawer,
  ],
})
export class MonthView implements OnInit {
  private readonly store = inject(Store);
  private readonly route = inject(ActivatedRoute);

  protected readonly loading = select(MonthViewState.loading);
  protected readonly error = select(MonthViewState.error);
  protected readonly data = select(MonthViewState.data);
  protected readonly kpis = select(MonthViewState.kpis);
  protected readonly members = select(MonthViewState.members);
  protected readonly categories = select(MonthViewState.categories);
  protected readonly contributionBreakdown = select(MonthViewState.contributionBreakdown);
  protected readonly memberIncomes = select(MonthViewState.memberIncomes);
  protected readonly carryovers = select(MonthViewState.carryovers);
  protected readonly selectedMonth = select(MonthViewState.selectedMonth);

  /** Date object bound to the p-datepicker (view only: month+year) */
  protected pickerDate = new Date();

  protected readonly accountId = computed(
    () => this.route.snapshot.params['accountId'] as string,
  );

  /** Month label for display e.g. "Aug. 2025" */
  protected readonly monthLabel = computed(() => {
    const m = this.selectedMonth();
    if (!m) return '—';
    return DateTime.fromISO(`${m}-01`).setLocale('de').toFormat('MMM. yyyy');
  });

  /** Balance display: totalPaid − totalSpent */
  protected readonly balanceMinor = computed(() => {
    const k = this.kpis();
    if (!k) return null;
    return k.totalPaidMinor - k.totalSpentMinor;
  });

  /**
   * Responsive grid class for member cards:
   * exactly as many columns as members (max 3), stacked on mobile.
   */
  protected readonly memberGridClass = computed(() => {
    const n = this.members().length;
    if (n <= 1) return 'grid-cols-1';
    if (n === 2) return 'grid-cols-1 md:grid-cols-2';
    return 'grid-cols-1 md:grid-cols-3';
  });

  /** Drawer visibility */
  protected readonly drawerVisible = signal(false);
  /** Member for which the payment drawer is opened */
  protected readonly drawerMember = signal<MonthViewMemberUi | null>(null);

  ngOnInit(): void {
    const accountId = this.accountId();
    // Default to current month
    const month = DateTime.utc().toFormat('yyyy-MM');
    this.pickerDate = DateTime.fromISO(`${month}-01`).toJSDate();
    this.store.dispatch(new LoadMonthView(accountId, month));
  }

  protected prevMonth(): void {
    const current = this.selectedMonth();
    if (!current) return;
    const prev = DateTime.fromISO(`${current}-01`).minus({ months: 1 }).toFormat('yyyy-MM');
    this.loadMonth(prev);
  }

  protected nextMonth(): void {
    const current = this.selectedMonth();
    if (!current) return;
    const next = DateTime.fromISO(`${current}-01`).plus({ months: 1 }).toFormat('yyyy-MM');
    this.loadMonth(next);
  }

  protected onPickerMonthSelect(date: Date): void {
    const month = DateTime.fromJSDate(date).toFormat('yyyy-MM');
    this.loadMonth(month);
  }

  private loadMonth(month: string): void {
    this.pickerDate = DateTime.fromISO(`${month}-01`).toJSDate();
    this.store.dispatch(new LoadMonthView(this.accountId(), month));
  }

  /** Cents → EUR major (undefined-safe) */
  protected toEur(minor: number | undefined | null): number {
    return (minor ?? 0) / 100;
  }

  protected categoryStatusSeverity(status: string): 'success' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'ok': return 'success';
      case 'over': return 'danger';
      default: return 'secondary';
    }
  }

  protected categoryStatusLabel(status: string): string {
    switch (status) {
      case 'ok': return 'OK';
      case 'over': return 'Überschritten';
      default: return 'Kein Budget';
    }
  }

  protected memberName(memberId: string): string {
    return this.members().find(m => m.id === memberId)?.name ?? memberId;
  }

  /** Opens the Einzahlung-Drawer pre-filled with the given member */
  protected openDrawer(member: MonthViewMemberUi): void {
    this.drawerMember.set(member);
    this.drawerVisible.set(true);
  }

  /** Called when the drawer emits (saved) — reloads the month view */
  protected onDrawerSaved(): void {
    const month = this.selectedMonth() ?? DateTime.utc().toFormat('yyyy-MM');
    this.store.dispatch(new LoadMonthView(this.accountId(), month));
  }

  /** Called from error-state retry button. */
  protected reload(): void {
    this.ngOnInit();
  }
}


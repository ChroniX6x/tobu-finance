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
import { ChartModule } from 'primeng/chart';
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
    ChartModule,
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
  protected readonly categoryHistory = select(MonthViewState.categoryHistory);

  // ── Category palette (deterministic by index, loops for >7 categories) ──────
  private static readonly CATEGORY_COLORS = [
    { bar: '#14b8a6', dot: '#14b8a6', line: 'rgba(20,184,166,0.9)',   area: 'rgba(20,184,166,0.12)' },  // teal
    { bar: '#eab308', dot: '#eab308', line: 'rgba(234,179,8,0.9)',    area: 'rgba(234,179,8,0.12)'  },  // yellow
    { bar: '#a855f7', dot: '#a855f7', line: 'rgba(168,85,247,0.9)',   area: 'rgba(168,85,247,0.12)' },  // purple
    { bar: '#3b82f6', dot: '#3b82f6', line: 'rgba(59,130,246,0.9)',   area: 'rgba(59,130,246,0.12)' },  // blue
    { bar: '#f97316', dot: '#f97316', line: 'rgba(249,115,22,0.9)',   area: 'rgba(249,115,22,0.12)' },  // orange
    { bar: '#ec4899', dot: '#ec4899', line: 'rgba(236,72,153,0.9)',   area: 'rgba(236,72,153,0.12)' },  // pink
    { bar: '#06b6d4', dot: '#06b6d4', line: 'rgba(6,182,212,0.9)',    area: 'rgba(6,182,212,0.12)'  },  // cyan
  ];

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

  /** Responsive grid class for member cards: exactly as many columns as members (max 3). */
  protected readonly memberGridClass = computed(() => {
    const n = this.members().length;
    if (n <= 1) return 'grid-cols-1';
    if (n === 2) return 'grid-cols-1 md:grid-cols-2';
    return 'grid-cols-1 md:grid-cols-3';
  });

  // ── Category 7 section signals ─────────────────────────────────────────────

  /** Clicked category ID — drives right-column chart; null = total spend */
  protected readonly selectedCategoryId = signal<string | null>(null);

  /** Toggle: show all categories vs. top 5 */
  protected readonly showAllCategories = signal(false);

  /** Slice of categories shown in the left column (top 5 or all) */
  protected readonly visibleCategories = computed(() =>
    this.showAllCategories() ? this.categories() : this.categories().slice(0, 5),
  );

  /** True when there are more categories than the visible slice */
  protected readonly hasMoreCategories = computed(
    () => this.categories().length > 5,
  );

  /** Chart.js data object — recomputed when history or selectedCategoryId changes */
  protected readonly chartData = computed(() => {
    const history = this.categoryHistory();
    const cats = this.categories();
    const selId = this.selectedCategoryId();

    const labels = history.map((h) =>
      DateTime.fromISO(`${h.month}-01`).setLocale('de').toFormat('MMM'),
    );

    if (selId) {
      // Single selected category with optional budget dashed line
      const catIdx = cats.findIndex((c) => c.id === selId);
      const color = MonthView.CATEGORY_COLORS[catIdx >= 0 ? catIdx % MonthView.CATEGORY_COLORS.length : 0];
      const cat = cats.find((c) => c.id === selId);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const datasets: any[] = [
        {
          label: cat?.name ?? '—',
          data: history.map((h) => ((h.spentByCategoryId[selId] ?? 0) / 100)),
          borderColor: color.line,
          backgroundColor: color.area,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: color.dot,
        },
      ];

      // Dashed budget line when a budget is defined for this category
      if (cat?.budgetMinor != null && cat.budgetMinor > 0) {
        datasets.push({
          label: 'Budget',
          data: history.map(() => (cat.budgetMinor ?? 0) / 100),
          borderColor: 'rgba(255,255,255,0.28)',
          borderDash: [5, 4],
          backgroundColor: 'transparent',
          fill: false,
          tension: 0,
          pointRadius: 0,
        });
      }

      return { labels, datasets };
    }

    // Default: total spend across all categories per month (single line)
    return {
      labels,
      datasets: [
        {
          label: 'Gesamtausgaben',
          data: history.map((h) =>
            Object.values(h.spentByCategoryId).reduce((a, b) => a + b, 0) / 100,
          ),
          borderColor: 'rgba(20,184,166,0.9)',
          backgroundColor: 'rgba(20,184,166,0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#14b8a6',
        },
      ],
    };
  });

  /** Static Chart.js options — dark theme, minimal axes */
  protected readonly chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (ctx: any) =>
            `${ctx.dataset.label}: ${Number(ctx.parsed.y).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.06)' },
        ticks: { color: 'rgba(255,255,255,0.50)', font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255,255,255,0.06)' },
        ticks: {
          color: 'rgba(255,255,255,0.50)',
          font: { size: 11 },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          callback: (v: any) => `${v} €`,
        },
      },
    },
  };

  // ── Drawer signals ────────────────────────────────────────────────────────
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

  // ── Phase 9: Beitragslogik-Bereich ────────────────────────────────────────

  /**
   * Task 9.1: Monatsbedarf breakdown by rule type.
   * Shows how the total monthly requirement is composed from
   * base-, additional- and topup-rules.
   * NOTE: carryover is informational context (not part of totalDueMinor calculation).
   */
  protected readonly monthlyRequirementBreakdown = computed(() => {
    const rules = this.contributionBreakdown();
    const base       = rules.filter(r => r.type === 'base').reduce((s, r) => s + r.amountMinor, 0);
    const additional = rules.filter(r => r.type === 'additional').reduce((s, r) => s + r.amountMinor, 0);
    const topup      = rules.filter(r => r.type === 'topup').reduce((s, r) => s + r.amountMinor, 0);
    const carryover  = this.kpis()?.carryoverTotalMinor ?? 0;
    const total      = base + additional + topup;
    return { base, additional, topup, carryover, total };
  });

  /** Task 9.2: Human-readable label for rule type */
  protected ruleTypeLabel(type: string): string {
    switch (type) {
      case 'base':       return 'Basis';
      case 'additional': return 'Zusatz';
      case 'topup':      return 'TopUp';
      default:           return type;
    }
  }

  /** Task 9.2: PrimeNG tag severity for rule type */
  protected ruleTypeSeverity(type: string): 'success' | 'info' | 'warn' | 'secondary' {
    switch (type) {
      case 'base':       return 'success';
      case 'additional': return 'info';
      case 'topup':      return 'warn';
      default:           return 'secondary';
    }
  }

  /** Task 9.2: Human-readable label for distribution mode */
  protected distributionModeLabel(mode: string): string {
    switch (mode) {
      case 'proRataIncome': return 'ProRata (Einkommen)';
      case 'perMember':     return 'Pro Mitglied';
      case 'customSplit':   return 'Individuell';
      default:              return mode;
    }
  }

  // ── Phase 8: Detailtabellen computeds ────────────────────────────────────

  /**
   * Per-member breakdown pivoted by rule type (base / additional / topup).
   * Used in the Contribution-Breakdown accordion table.
   * The totalMinor must equal member.monthlyDueMinor (sanity check).
   */
  protected readonly memberBreakdown = computed(() => {
    const members = this.members();
    const rules = this.contributionBreakdown();
    return members.map(member => {
      const base = rules
        .filter(r => r.type === 'base')
        .reduce((sum, r) => sum + (r.perMember[member.id] ?? 0), 0);
      const additional = rules
        .filter(r => r.type === 'additional')
        .reduce((sum, r) => sum + (r.perMember[member.id] ?? 0), 0);
      const topup = rules
        .filter(r => r.type === 'topup')
        .reduce((sum, r) => sum + (r.perMember[member.id] ?? 0), 0);
      return { memberId: member.id, memberName: member.name, base, additional, topup, totalMinor: member.monthlyDueMinor };
    });
  });

  /**
   * True when at least one active contribution rule uses proRataIncome distribution.
   * Controls visibility of the Income-Basis accordion panel.
   */
  protected readonly hasProRata = computed(() =>
    this.contributionBreakdown().some(r => r.distributionMode === 'proRataIncome'),
  );

  /** Deviation label class for Kategorie-Details table */
  protected deviationClass(spentMinor: number, budgetMinor: number | null): string {
    if (budgetMinor == null) return 'text-muted-color';
    const diff = spentMinor - budgetMinor;
    if (diff > 0) return 'text-red-400 font-semibold';
    if (diff < 0) return 'text-success-600';
    return 'text-color';
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

  /** Returns the color config for a category at a given index in the sorted list */
  protected catColor(index: number) {
    return MonthView.CATEGORY_COLORS[index % MonthView.CATEGORY_COLORS.length];
  }

  /** Toggle selected category; clicking same again deselects → shows total */
  protected selectCategory(catId: string): void {
    this.selectedCategoryId.update((cur) => (cur === catId ? null : catId));
  }

  /** Returns the display name for a category by its ID */
  protected catNameById(catId: string): string {
    return this.categories().find((c) => c.id === catId)?.name ?? catId;
  }
}


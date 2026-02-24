import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { AvatarModule } from 'primeng/avatar';
import { TooltipModule } from 'primeng/tooltip';
import { TimelineModule } from 'primeng/timeline';
import { MessageModule } from 'primeng/message';
import { select, Store } from '@ngxs/store';
import { AccountOverviewState } from '../state/account-overview.state';
import { LoadAccountOverview } from '../state/account-overview.actions';
import { ActivatedRoute } from '@angular/router';
import { AccountMemberUi } from '@/accounts/domain/account-overview.ui-model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'tbf-account-overview',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule, ChartModule, AvatarModule, TooltipModule, TimelineModule, MessageModule],
  templateUrl: './account-overview.html',
  styleUrls: ['./account-overview.scss']
})
export class AccountOverview implements OnInit {

  private store = inject(Store);
  private route = inject(ActivatedRoute);

  currentMember   = computed<AccountMemberUi | undefined>(() => this.members().find((m: AccountMemberUi) => m.id === 'm1' || m.id === '4a7b')); // TODO aktueller User (über AuthService)
  account         = select(AccountOverviewState.account);
  members         = select(AccountOverviewState.members);
  quickStats      = select(AccountOverviewState.quickStats);
  lineChartData   = select(AccountOverviewState.lineChartData);
  doughnutData    = select(AccountOverviewState.doughnutData);
  pieChartData    = select(AccountOverviewState.pieChartData);
  insights        = select(AccountOverviewState.insights);
  timeline        = select(AccountOverviewState.timeline);
  loading         = select(AccountOverviewState.loading);

constructor() {
  this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
    const accountId = params.get('accountId');
    if (accountId) {
      this.store.dispatch(new LoadAccountOverview(accountId));
    }
  });
}

  // ---- Helper: formatiere aus ISO YYYY-MM oder YYYY-MM-DD → z.B. "Aug 2025" ----
  private monthLabel = (iso: string | undefined) => {
    if (!iso) return '—';
    // Wenn nur YYYY-MM kommt, auf den 1. des Monats ergänzen:
    const isoFull = iso.length === 7 ? `${iso}-01` : iso;
    const d = new Date(isoFull);
    return new Intl.DateTimeFormat('de-DE', { month: 'short', year: 'numeric' }).format(d);
  };

  // ---- Header-Anzeigen (berechnet) ----
  currentMonthLabel = computed(() => this.monthLabel(this.account()?.currentMonthIso));
  currentBalanceMajor = computed(() => (this.account()?.currentBalanceMinor ?? 0) / 100);
  forecastMajor = computed(() => (this.account()?.forecastMinor ?? 0) / 100);
  balanceChangePct = computed(() => this.account()?.balanceChangePct ?? 0);
  accountWarning = computed(() => this.account()?.warning);

  // Verlauf Chart
  lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { ticks: { callback: (v: number) => v + ' €' } },
      x: { display: true }
    }
  };

  // Doughnut-Chart (Einnahmen vs Ausgaben)
  doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } }
  };

  // Pie-Chart (Top Kategorien)
  pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } }
  };

  ngOnInit() {
  }
}

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
import { AccountDashboardState } from '../state/account-dashboard.state';
import { LoadAccountDashboard } from '../state/account-dashboard.actions';
import { ActivatedRoute } from '@angular/router';
import { AccountMemberUi } from '@/account-dashboard/domain/account-overview.ui-model';

@Component({
  selector: 'account-dashboard',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule, ChartModule, AvatarModule, TooltipModule, TimelineModule, MessageModule],
  templateUrl: './account-dashboard.html',
})
export class AccountDashboard implements OnInit {

  private store = inject(Store);
  private route = inject(ActivatedRoute);

  currentMember   = computed<AccountMemberUi>(() => this.members().find(m => m.id === 'm1' || m.id === '4a7b')!); // TODO aktueller User (über AuthService)
  account         = select(AccountDashboardState.account);
  members         = select(AccountDashboardState.members);
  quickStats      = select(AccountDashboardState.quickStats);
  lineChartData   = select(AccountDashboardState.lineChartData);
  doughnutData    = select(AccountDashboardState.doughnutData);
  pieChartData    = select(AccountDashboardState.pieChartData);
  insights        = select(AccountDashboardState.insights);
  timeline        = select(AccountDashboardState.timeline);
  loading         = select(AccountDashboardState.loading);

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
    this.route.paramMap.subscribe(params => {
      const accountId = params.get('accountId');
      if (accountId) {
        this.store.dispatch(new LoadAccountDashboard(accountId));
      }
    });
  }
}

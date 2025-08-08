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

@Component({
  selector: 'account-dashboard',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule, ChartModule, AvatarModule, TooltipModule, TimelineModule, MessageModule],
  templateUrl: './account-dashboard.html',
})
export class AccountDashboard implements OnInit {

  private store = inject(Store);
  private route = inject(ActivatedRoute);

  account = select(AccountDashboardState.account);
  members = select(AccountDashboardState.members);
  you = select(AccountDashboardState.you);
  quickStats = select(AccountDashboardState.quickStats);
  months = select(AccountDashboardState.months);

  lineChartData = select(AccountDashboardState.lineChartData);
  doughnutData = select(AccountDashboardState.doughnutData);
  pieChartData = select(AccountDashboardState.pieChartData);

  tasks = select(AccountDashboardState.tasks);
  activity = select(AccountDashboardState.activity);

  currentMonth = computed(() => this.months().at(-1) ?? '—');
  userTasks = computed(() => this.tasks().filter(t => t.memberId === this.you().id));

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

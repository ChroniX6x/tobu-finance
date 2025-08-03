import { Component, OnInit, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import { select, Store } from '@ngxs/store';
import { ChartData } from 'chart.js';
import { DashboardState, LoadDashboardAccounts } from './state/dashboard-state';
import { DashboardAccountModel } from './domain/dashboard-account.model';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';

@Component({
  selector: 'tbf-dashboard',
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
  standalone: true,
  imports: [ChartModule, CommonModule]
})
export class Dashboard implements OnInit {
  private store = inject(Store);
  private router = inject(Router);

  // Signals statt Observable
  accounts = select(DashboardState.accounts);
  loading  = select(DashboardState.loading);

  // Neu: berechnete Chart-Daten pro Account
  accountsWithChart = computed(() =>
    this.accounts().map((acc: DashboardAccountModel) => {
      const history = acc.balanceHistory ?? [];
      const len = history.length;
      const labels = history.map((_, i) =>
        i === len - 1 ? 'Jetzt' : `-${len - 1 - i}M`
      );
      const data: ChartData<'line'> = {
        labels,
        datasets: [
          {
            data: history,
            label: 'Verlauf',
            fill: false,
            // borderColor hier weglassen, ChartModule übernimmt defaults
          }
        ]
      };
      return { ...acc, chartData: data };
    })
  );

  ngOnInit() {
    this.store.dispatch(new LoadDashboardAccounts());
  }

  goToAccount(accountId: string) {
    this.router.navigate(['/dashboard', accountId]);
  }

  goToWizard() {
    this.router.navigate(['/wizard']);
  }
}

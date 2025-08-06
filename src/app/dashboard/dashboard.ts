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
            tension: 0.35
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

  generatePath(data: number[]): string {
    if (!data.length) return '';

    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;

    const stepX = 100 / (data.length - 1);
    const scaleY = 30 / range;

    const points = data.map((val, i) => {
      const x = i * stepX;
      const y = 30 - (val - min) * scaleY;
    return { x, y };
  });

  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cx = (prev.x + curr.x) / 2;
    d += ` Q ${prev.x},${prev.y} ${cx},${(prev.y + curr.y) / 2}`;
  }
  d += ` T ${points.at(-1)!.x},${points.at(-1)!.y}`;
  return d;
}

}

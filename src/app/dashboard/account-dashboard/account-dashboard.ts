import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'tbf-account-overview',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule],
  templateUrl: './account-dashboard.html',
  styleUrls: ['./account-dashboard.scss']
})
export class AccountDashboard {
  account = signal({
    name: 'Gemeinschaftskonto',
    stats: {
      balance: 5672, change: 2.2, forecast: 5800,
      contributions: 250, topUps: 500
    },
    recent: { lastExpense: '01.08.2025', topCats: 'Miete, Einkauf, Freizeit' }
  });

  readonly statKeys = computed(() => {
    const stats = this.account().stats;
    return [
      { label: 'Kontostand', value: stats.balance, suffix: ' €' },
      { label: 'Veränderung', value: stats.change, suffix: ' %' },
      { label: 'Prognose', value: stats.forecast, suffix: ' €' },
      { label: 'Beiträge', value: stats.contributions, suffix: ' €' },
      { label: 'Top-Ups', value: stats.topUps, suffix: ' €' }
    ];
  });

}

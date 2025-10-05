import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '@/environments/environment';
import { ApiAccountOverview } from '@/domain/models/api.types';
import {
  AccountOverviewUi,
  AccountMemberUi,
  QuickStatsUi
} from '@/account-dashboard/domain/account-overview.ui-model';
import { API_BASE_URL } from '@/core/api-base-url.token';

@Injectable({ providedIn: 'root' })
export class AccountOverviewDataService {
  private http = inject(HttpClient);
  private baseUrl = inject(API_BASE_URL);

  getAccountOverview(accountId: string): Observable<AccountOverviewUi> {
    return this.http
      .get<ApiAccountOverview>(`${this.baseUrl}/api/accounts/${accountId}/overview`)
      .pipe(map(api => this.mapToUi(api)));
  }

  private mapToUi(api: ApiAccountOverview): AccountOverviewUi {
    const account = {
      id: api.account.id,
      name: api.account.name ?? '—',
      currentMonthIso: api.account.currentMonth,       // ISO passt
      currentBalanceMinor: api.account.currentBalance, // minor units
      balanceChangePct: api.account.balanceChangePct ?? 0,
      forecastMinor: api.account.forecast,             // minor units
      warning: api.account.warning
    };

    const members: AccountMemberUi[] = (api.members ?? []).map(m => ({
      id: m.id,
      name: m.name ?? '—',
      role: m.role,
      avatar: m.avatar ?? null,
      monthlyDueMinor: m.monthlyDue,       // minor units
      paidAmountMinor: m.paidAmount,       // minor units
      paid: !!m.paid
    }));

    const quickStats: QuickStatsUi = {
      openDuesCount: api.quickStats.openDuesCount ?? 0,
      pendingRecurringCount: api.quickStats.pendingRecurringCount ?? 0,
      extraContributionsCount: api.quickStats.extraContributionsCount ?? 0,
      extraContributionsSumMinor: api.quickStats.extraContributionsSum ?? 0, // minor units
      warningsCount: api.quickStats.warningsCount ?? 0
    };

    const lineChartDataMinor = {
      labelsIso: api.charts.history.labels ?? [],             // ISO
      datasets: [{
        label: 'Kontostand',
        dataMinor: api.charts.history.data ?? [],             // minor units
        fill: true,
        tension: 0.4
      }]
    };

    const doughnutDataMinor = {
      labels: ['Einnahmen', 'Ausgaben'],
      datasets: [{
        dataMinor: [
          api.charts.incomeVsExpense.income ?? 0,             // minor units
          api.charts.incomeVsExpense.expense ?? 0             // minor units
        ]
      }]
    };

    const pieChartDataMinor = {
      labels: (api.charts.topCategories ?? []).map(c => c.name ?? '—'),
      datasets: [{
        dataMinor: (api.charts.topCategories ?? []).map(c => c.sum ?? 0) // minor units
      }]
    };

    const insights = api.insights ?? [];
    const timeline = api.timeline ?? [];

    return {
      account,
      members,
      quickStats,
      lineChartDataMinor,
      doughnutDataMinor,
      pieChartDataMinor,
      insights,
      timeline
    };
  }
}

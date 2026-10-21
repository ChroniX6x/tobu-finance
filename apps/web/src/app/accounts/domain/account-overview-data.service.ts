import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { ApiAccountOverview } from '@/shared/models/api.types';
import {
  AccountOverviewUi,
  AccountMemberUi,
  QuickStatsUi,
} from './account-overview.ui-model';
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
      currentMonthIso: api.account.currentMonth,
      currentBalanceMinor: api.account.currentBalanceMinor,
      balanceChangePct: api.account.balanceChangePct ?? 0,
      forecastMinor: api.account.forecastMinor,
      warning: api.account.warning,
      stalenessDays: api.account.stalenessDays,
      isStale: api.account.isStale,
      missingMonthsIso: api.account.missingMonths,
    };

    const members: AccountMemberUi[] = (api.members ?? []).map(m => ({
      id: m.id,
      name: m.name ?? '—',
      role: m.role,
      avatar: m.avatar ?? null,
      monthlyDueMinor: m.monthlyDue,
      paidAmountMinor: m.paidAmount,
      paid: !!m.paid,
    }));

    const quickStats: QuickStatsUi = {
      openDuesCount: api.quickStats.openDuesCount ?? 0,
      pendingRecurringCount: api.quickStats.pendingRecurringCount ?? 0,
      extraContributionsCount: api.quickStats.extraContributionsCount ?? 0,
      extraContributionsSumMinor: api.quickStats.extraContributionsSumMinor ?? 0,
      warningsCount: api.quickStats.warningsCount ?? 0,
    };

    const lineChartDataMinor = {
      labelsIso: api.charts.history.labels ?? [],
      datasets: [{
        label: 'Kontostand',
        dataMinor: api.charts.history.data ?? [],
        fill: true,
        tension: 0.4,
      }],
    };

    const doughnutDataMinor = {
      labels: ['Einnahmen', 'Ausgaben'],
      datasets: [{
        dataMinor: [
          api.charts.incomeVsExpenseMinor.incomeMinor ?? 0,
          api.charts.incomeVsExpenseMinor.expenseMinor ?? 0,
        ],
      }],
    };

    const pieChartDataMinor = {
      labels: (api.charts.topCategories ?? []).map(c => c.name ?? '—'),
      datasets: [{
        dataMinor: (api.charts.topCategories ?? []).map(c => c.sum ?? 0),
      }],
    };

    return {
      account,
      members,
      quickStats,
      lineChartDataMinor,
      doughnutDataMinor,
      pieChartDataMinor,
      insights: api.insights ?? [],
      timeline: api.timeline ?? [],
    };
  }
}

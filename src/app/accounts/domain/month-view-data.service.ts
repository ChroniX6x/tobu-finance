// domain/month-view-data.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import {
  ApiMonthView,
  ApiMonthViewMember,
  ApiMonthViewCategory,
  ApiMonthViewContributionRule,
  ApiMonthViewMemberIncome,
  ApiMonthViewCarryover,
  ApiMonthViewCategoryHistory,
} from '@/shared/models/api.types';
import {
  MonthViewUi,
  MonthViewMemberUi,
  MonthViewCategoryUi,
  MonthViewContributionRuleUi,
  MonthViewMemberIncomeUi,
  MonthViewCarryoverUi,
  MonthViewCategoryHistoryUi,
} from './month-view.ui-model';
import { API_BASE_URL } from '@/core/api-base-url.token';

@Injectable({ providedIn: 'root' })
export class MonthViewDataService {
  private http = inject(HttpClient);
  private baseUrl = inject(API_BASE_URL);

  getMonthView(accountId: string, month: string): Observable<MonthViewUi> {
    return this.http
      .get<ApiMonthView>(
        `${this.baseUrl}/api/accounts/${accountId}/month-view?month=${month}`,
      )
      .pipe(map((api) => this.mapToUi(api)));
  }

  // ---- Mapping ----

  private mapToUi(api: ApiMonthView): MonthViewUi {
    if (!api?.account || !api?.kpis) {
      throw new Error('Ungültige API-Antwort: Fehlende Pflichtfelder (account/kpis). Bitte Backend-Version prüfen.');
    }
    const nameById = this.buildNameIndex(api.members ?? []);

    return {
      accountId: api.account.id,
      accountName: api.account.name ?? '—',
      monthIso: api.account.monthIso,
      kpis: {
        totalDueMinor: api.kpis.totalDueMinor,
        totalPaidMinor: api.kpis.totalPaidMinor,
        totalSpentMinor: api.kpis.totalSpentMinor,
        carryoverTotalMinor: api.kpis.carryoverTotalMinor,
      },
      members:               (api.members ?? []).map((m) => this.mapMember(m)),
      categories:            (api.categories ?? []).map((c) => this.mapCategory(c)),
      contributionBreakdown: (api.contributionBreakdown ?? []).map((r) => this.mapContributionRule(r)),
      memberIncomes:         (api.memberIncomes ?? []).map((i) => this.mapMemberIncome(i, nameById)),
      carryovers:            (api.carryovers ?? []).map((co) => this.mapCarryover(co, nameById)),
      categoryHistory:       (api.categoryHistory ?? []).map((h) => this.mapCategoryHistory(h)),
    };
  }

  private buildNameIndex(members: ApiMonthViewMember[]): Record<string, string> {
    return Object.fromEntries(members.map((m) => [m.id, m.name ?? '—']));
  }

  private mapMember(m: ApiMonthViewMember): MonthViewMemberUi {
    return {
      id: m.id,
      name: m.name ?? '—',
      avatar: m.avatar,
      role: m.role,
      monthlyDueMinor: m.monthlyDueMinor,
      paidAmountMinor: m.paidAmountMinor,
      openAmountMinor: m.openAmountMinor,
      paid: m.paid,
      carryoverMinor: m.carryoverMinor,
      lastPaymentDate: m.lastPaymentDate ?? null,
      privateAdvancesMinor: m.privateAdvancesMinor ?? 0,
    };
  }

  private mapCategory(c: ApiMonthViewCategory): MonthViewCategoryUi {
    const budgetPct =
      c.budgetMinor !== null && c.budgetMinor > 0
        ? Math.min(100, Math.round((c.spentMinor / c.budgetMinor) * 100))
        : null;
    return {
      id: c.id,
      name: c.name ?? '—',
      spentMinor: c.spentMinor,
      budgetMinor: c.budgetMinor,
      status: c.status,
      budgetPct,
    };
  }

  private mapContributionRule(
    r: ApiMonthViewContributionRule,
  ): MonthViewContributionRuleUi {
    return {
      ruleId: r.ruleId,
      description: r.description ?? '—',
      type: r.type,
      amountMinor: r.amountMinor,
      distributionMode: r.distributionMode,
      perMember: r.perMember,
    };
  }

  private mapMemberIncome(
    i: ApiMonthViewMemberIncome,
    nameById: Record<string, string>,
  ): MonthViewMemberIncomeUi {
    return {
      memberId: i.memberId,
      memberName: nameById[i.memberId] ?? '—',
      amountMinor: i.amountMinor,
      weight: i.weight,
    };
  }

  private mapCarryover(
    co: ApiMonthViewCarryover,
    nameById: Record<string, string>,
  ): MonthViewCarryoverUi {
    return {
      memberId: co.memberId,
      memberName: nameById[co.memberId] ?? '—',
      amountMinor: co.amountMinor,
      reason: co.reason,
    };
  }

  private mapCategoryHistory(h: ApiMonthViewCategoryHistory): MonthViewCategoryHistoryUi {
    return {
      month: h.month,
      spentByCategoryId: h.spentByCategoryId,
    };
  }
}

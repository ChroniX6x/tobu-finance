import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@/core/api-base-url.token';
import {
  AccountPlanningResponse,
  CreateBudgetPayload,
  UpdateBudgetPayload,
  CreateIncomePayload,
  UpdateIncomePayload,
  CreateContributionRulePayload,
  UpdateContributionRulePayload,
} from '../planning.models';

@Injectable({ providedIn: 'root' })
export class PlanningApiService {
  private http = inject(HttpClient);
  private baseUrl = inject(API_BASE_URL);

  // ---- Read ----

  getPlanning(accountId: string, month: string): Observable<AccountPlanningResponse> {
    return this.http.get<AccountPlanningResponse>(
      `${this.baseUrl}/api/accounts/${accountId}/planning`,
      { params: { month } },
    );
  }

  // ---- Budget CRUD ----

  createBudget(payload: CreateBudgetPayload): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/api/category-budgets`, payload);
  }

  updateBudget(budgetId: string, payload: UpdateBudgetPayload): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/api/category-budgets/${budgetId}`, payload);
  }

  deleteBudget(budgetId: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/api/category-budgets/${budgetId}`);
  }

  // ---- Income CRUD ----

  createIncome(payload: CreateIncomePayload): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/api/member-incomes`, payload);
  }

  updateIncome(incomeId: string, payload: UpdateIncomePayload): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/api/member-incomes/${incomeId}`, payload);
  }

  deleteIncome(incomeId: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/api/member-incomes/${incomeId}`);
  }

  // ---- Contribution Rule CRUD ----

  createContributionRule(payload: CreateContributionRulePayload): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/api/contribution-rules`, payload);
  }

  updateContributionRule(ruleId: string, payload: UpdateContributionRulePayload): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/api/contribution-rules/${ruleId}`, payload);
  }

  deleteContributionRule(ruleId: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/api/contribution-rules/${ruleId}`);
  }
}

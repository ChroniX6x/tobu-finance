import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { ApiAccountsSummaryItem } from '@/domain/models/api.types';
import { DashboardAccountModel } from '@/accounts/domain/dashboard-account.model';
import { API_BASE_URL } from '@/core/api-base-url.token';

@Injectable({ providedIn: 'root' })
export class AccountsSummaryDataService {
  private http = inject(HttpClient);
  private baseUrl = inject(API_BASE_URL);

  getAccountsSummary(opts?: {
    months?: number;
  }): Observable<DashboardAccountModel[]> {
    let params = new HttpParams();
    if (opts?.months)   params = params.set('months', String(opts.months));

    return this.http
      .get<ApiAccountsSummaryItem[]>(`${this.baseUrl}/api/accounts/summary`, { params })
      .pipe(
        map(list => list.map(a => ({
          id: a.id,
          name: a.name,
          participantCount: a.memberCount,
          currentBalanceMinor: a.currentBalanceMinor,             // keep minor units
          balanceHistoryMinor: a.balanceHistoryMinor ?? [],       // keep minor units
          currentMonthIso: a.currentMonth,                   // ISO month
          stalenessDays: a.stalenessDays,
          isStale: a.isStale,
          missingMonthsIso: a.missingMonths
        })))
      );
  }
}

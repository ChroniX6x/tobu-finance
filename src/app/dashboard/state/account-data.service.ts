import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { ApiDashboardAccount } from '@/domain/models/api.types';
import { DashboardAccountModel } from '@/dashboard/domain/dashboard-account.model';
import { API_BASE_URL } from '@/core/api-base-url.token';

@Injectable({ providedIn: 'root' })
export class DashboardDataService {
  private http = inject(HttpClient);
  private baseUrl = inject(API_BASE_URL);

  getDashboardAccounts(opts?: {
    userId?: string;
    memberId?: string;
    months?: number;
  }): Observable<DashboardAccountModel[]> {
    let params = new HttpParams();
    if (opts?.userId)   params = params.set('userId', opts.userId);
    if (opts?.memberId) params = params.set('memberId', opts.memberId);
    if (opts?.months)   params = params.set('months', String(opts.months));

    return this.http
      .get<ApiDashboardAccount[]>(`${this.baseUrl}/api/dashboard/accounts`, { params })
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

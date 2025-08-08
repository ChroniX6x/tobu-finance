import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { DashboardAccountModel } from '../domain/dashboard-account.model';

// Entspricht dem aktuellen db.json-Schema:
interface RawAccount {
  id: string;
  name: string;
  memberIds: string[];
  balances: Array<{ month: string; value: number }>;
  // restliche Felder ignoriert, da fürs Dashboard nicht relevant
}

@Injectable({ providedIn: 'root' })
export class AccountDataService {
  private API = 'http://localhost:3000';
  private readonly url = this.API + '/accounts'; // json-server Basis-URL

  /** Liefert Dashboard-DTOs basierend auf RawAccount */
  getDashboardAccounts(): Observable<DashboardAccountModel[]> {
    return this.http.get<RawAccount[]>(this.url).pipe(
      map(rawList =>
        rawList.map(r => {
          const sorted = [...r.balances].sort((a, b) =>
            a.month.localeCompare(b.month)
          );
          return {
            id: r.id,
            name: r.name,
            participantCount: r.memberIds.length,
            currentBalance: sorted.length
              ? sorted[sorted.length - 1].value
              : 0,
            balanceHistory: sorted.map(b => b.value).slice(-5)
          } as DashboardAccountModel;
        })
      )
    );
  }

  constructor(private http: HttpClient) {}
}

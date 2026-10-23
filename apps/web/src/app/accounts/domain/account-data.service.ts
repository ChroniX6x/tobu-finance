import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import type {ApiAccount} from '@tobu/contracts/resources';
import { AccountModel } from '@/shared/models/account.model';
import { API_BASE_URL } from '@/core/api-base-url.token';

@Injectable({ providedIn: 'root' })
export class AccountDataService {
  private http = inject(HttpClient);
  private baseUrl = inject(API_BASE_URL);
  private readonly url = this.baseUrl + '/api/accounts';

  getAccountForId(accountId: string): Observable<AccountModel> {
    return this.http.get<ApiAccount>(`${this.url}/${accountId}`).pipe(map(account => ({
      id: account._id, name: account.name ?? '—', memberIds: account.members.map(m => m.memberId),
      members: [], balances: [], monthlyIncomes: [], monthlyPlannedContributions: [], carryOverBalances: [],
    })));
  }
}

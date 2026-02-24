import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AccountModel } from '@/shared/models/account.model';
import { API_BASE_URL } from '@/core/api-base-url.token';

@Injectable({ providedIn: 'root' })
export class AccountDataService {
  private http = inject(HttpClient);
  private baseUrl = inject(API_BASE_URL);
  private readonly url = this.baseUrl + '/api/accounts';

  getAccountForId(accountId: string): Observable<AccountModel> {
    return this.http.get<AccountModel>(`${this.url}/${accountId}`);
  }
}

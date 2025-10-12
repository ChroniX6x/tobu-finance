import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map } from 'rxjs';
import { AccountModel } from './account.model';
import { API_BASE_URL } from '@/core/api-base-url.token';

@Injectable({ providedIn: 'root' })
export class AccountDataService {
  private http = inject(HttpClient);
  private baseUrl = inject(API_BASE_URL);
  private readonly url = this.baseUrl + '/api/accounts'; // json-server Basis-URL

  // Lädt einen Account + resolved members!
  getAccountForId(accountId: string): Observable<AccountModel> {
    return this.http.get<AccountModel>(`${this.url}/${accountId}`);
  }
}

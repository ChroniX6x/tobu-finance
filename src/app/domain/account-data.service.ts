import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map } from 'rxjs';
import { AccountModel } from './account.model';

@Injectable({ providedIn: 'root' })
export class AccountDataService {
  private API = 'http://localhost:3000';
  private readonly url = this.API + '/accounts'; // json-server Basis-URL

  constructor(private http: HttpClient) {}

  // Lädt einen Account + resolved members!
  getAccountForId(accountId: string): Observable<AccountModel> {
    return this.http.get<AccountModel>(`${this.url}/${accountId}`);
  }
}

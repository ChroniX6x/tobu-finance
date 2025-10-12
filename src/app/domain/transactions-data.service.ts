import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TransactionModel } from './transaction.model';
import { API_BASE_URL } from '@/core/api-base-url.token';

@Injectable({ providedIn: 'root' })
export class TransactionsDataService {
  private http = inject(HttpClient);
  private baseUrl = inject(API_BASE_URL);
  private readonly url = this.baseUrl + '/api/transactions'; // json-server Basis-URL

  getExpensesForAccountId(accountId: string): Observable<TransactionModel[]> {
    return this.http.get<TransactionModel[]>(`${this.url}?accountId=${accountId}`);
  }
}

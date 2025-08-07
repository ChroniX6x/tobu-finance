import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TransactionModel } from './transaction.model';

@Injectable({ providedIn: 'root' })
export class TransactionsDataService {
  private API = 'http://localhost:3000';
  private readonly url = this.API + '/transactions'; // json-server Basis-URL

  constructor(private http: HttpClient) {}

  getExpensesForAccountId(accountId: string): Observable<TransactionModel[]> {
    return this.http.get<TransactionModel[]>(`${this.url}?accountId=${accountId}`);
  }
}

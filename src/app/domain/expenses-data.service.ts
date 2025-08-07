import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ExpenseModel } from './expense.model';

@Injectable({ providedIn: 'root' })
export class ExpensesDataService {
  private API = 'http://localhost:3000';
  private readonly url = this.API + '/expenses'; // json-server Basis-URL

  constructor(private http: HttpClient) {}

  getExpensesForAccountId(accountId: string): Observable<ExpenseModel[]> {
    return this.http.get<ExpenseModel[]>(`${this.url}?accountId=${accountId}`);
  }
}

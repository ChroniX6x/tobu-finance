import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  CreateTransactionDto,
  PatchTransactionDto,
  TransactionModel,
  TransactionsFilters,
  TransactionsPagedResponse,
  TransactionWithChildren,
} from './transaction.model';
import { API_BASE_URL } from '@/core/api-base-url.token';

@Injectable({ providedIn: 'root' })
export class TransactionsApiService {
  private http = inject(HttpClient);
  private baseUrl = inject(API_BASE_URL);
  private readonly url = `${this.baseUrl}/api/transactions`;

  getTransactions(filters: Partial<TransactionsFilters>): Observable<TransactionsPagedResponse> {
    let params = new HttpParams();
    if (filters.accountId) params = params.set('accountId', filters.accountId);
    if (filters.monthFrom) params = params.set('monthFrom', filters.monthFrom);
    if (filters.monthTo) params = params.set('monthTo', filters.monthTo);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.page != null) params = params.set('page', String(filters.page));
    if (filters.pageSize != null) params = params.set('pageSize', String(filters.pageSize));
    if (filters.sort) params = params.set('sort', filters.sort);
    return this.http.get<TransactionsPagedResponse>(this.url, { params });
  }

  createTransaction(dto: CreateTransactionDto): Observable<TransactionModel> {
    return this.http.post<TransactionModel>(this.url, dto);
  }

  patchTransaction(id: string, patch: PatchTransactionDto): Observable<TransactionModel> {
    return this.http.patch<TransactionModel>(`${this.url}/${id}`, patch);
  }

  deleteTransaction(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  /**
   * Für den „Teil von"-Autocomplete: sucht Parents nach Titel.
   * FE berechnet rest = amountMinor - sum(children.amountMinor) aus der Response.
   */
  searchParents(accountId: string, q: string): Observable<TransactionWithChildren[]> {
    let params = new HttpParams()
      .set('accountId', accountId)
      .set('parentTransactionId', 'null')
      .set('q', q);
    return this.http
      .get<TransactionsPagedResponse>(this.url, { params })
      .pipe(map(res => res.items));
  }
}

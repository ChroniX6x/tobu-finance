import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CategoryModel } from './category.model';
import { API_BASE_URL } from '@/core/api-base-url.token';

@Injectable({ providedIn: 'root' })
export class CategoriesDataService {
  private http = inject(HttpClient);
  private baseUrl = inject(API_BASE_URL);
  private readonly url = this.baseUrl + '/api/categories'; // json-server Basis-URL

  getCategoriesForAccountId(accountId: string): Observable<CategoryModel[]> {
    return this.http.get<CategoryModel[]>(`${this.url}?accountId=${accountId}`);
  }
}

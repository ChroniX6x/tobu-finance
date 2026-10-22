import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import type {ApiCategory} from '@tobu/contracts/resources';
import { CategoryModel } from '@/shared/models/category.model';
import { API_BASE_URL } from '@/core/api-base-url.token';

@Injectable({ providedIn: 'root' })
export class CategoriesDataService {
  private http = inject(HttpClient);
  private baseUrl = inject(API_BASE_URL);
  private readonly url = this.baseUrl + '/api/categories';

  getCategoriesForAccountId(accountId: string): Observable<CategoryModel[]> {
    return this.http.get<ApiCategory[]>(`${this.url}?accountId=${accountId}`).pipe(map(items => items.map(c => ({...c, name:c.name ?? '—'}))));
  }
}

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CategoryModel } from './category.model';

@Injectable({ providedIn: 'root' })
export class CategoriesDataService {
  private API = 'http://localhost:3000';
  private readonly url = this.API + '/categories'; // json-server Basis-URL

  constructor(private http: HttpClient) {}

  getCategoriesForAccountId(accountId: string): Observable<CategoryModel[]> {
    return this.http.get<CategoryModel[]>(`${this.url}?accountId=${accountId}`);
  }
}

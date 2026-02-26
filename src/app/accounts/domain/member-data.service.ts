import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { MemberModel } from '@/shared/models/member.model';
import { API_BASE_URL } from '@/core/api-base-url.token';

@Injectable({ providedIn: 'root' })
export class MembersDataService {
  private http = inject(HttpClient);
  private baseUrl = inject(API_BASE_URL);
  private readonly url = this.baseUrl + '/api/members';

  getMembersWithIds(memberIds?: string[] | null): Observable<MemberModel[]> {
    if (!Array.isArray(memberIds) || memberIds.length === 0) return of([]);
    const params = memberIds.map(id => `id=${id}`).join('&');
    return this.http.get<MemberModel[]>(`${this.url}?${params}`);
  }
}

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { MemberModel } from './member.model';

@Injectable({ providedIn: 'root' })
export class MembersDataService {
  private API = 'http://localhost:3000';
  private readonly url = this.API + '/member'; // json-server Basis-URL

  constructor(private http: HttpClient) {}

  getMembersWithIds(memberIds: string[]): Observable<MemberModel[]> {
    if (!memberIds.length) return of([]);
    const params = memberIds.map(id => `id=${id}`).join('&');
    return this.http.get<MemberModel[]>(`${this.url}?${params}`);
  }
}

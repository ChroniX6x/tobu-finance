import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@/core/api-base-url.token';
import {
  AccountMasterDataResponse,
  CreateCategoryPayload,
  CreateMemberPayload,
  SaveAccountMasterDataPayload,
  UpdateCategoryPayload,
  UpdateMemberPayload,
} from '../account-master-data.models';

@Injectable({ providedIn: 'root' })
export class MasterDataApiService {
  private http = inject(HttpClient);
  private baseUrl = inject(API_BASE_URL);

  // ---- Read ----

  getMasterData(accountId: string): Observable<AccountMasterDataResponse> {
    return this.http.get<AccountMasterDataResponse>(
      `${this.baseUrl}/api/accounts/${accountId}/master-data`,
    );
  }

  // ---- Account ----

  patchAccount(accountId: string, payload: SaveAccountMasterDataPayload): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/api/accounts/${accountId}`, payload);
  }

  // ---- Members ----

  createMember(payload: CreateMemberPayload): Observable<{ _id: string }> {
    return this.http.post<{ _id: string }>(`${this.baseUrl}/api/members`, {
      name: payload.name,
      email: payload.email ?? null,
    });
  }

  addMemberToAccount(
    accountId: string,
    body: { memberId: string; role: 'owner' | 'member' },
  ): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/api/accounts/${accountId}/members`, body);
  }

  patchMember(memberId: string, payload: Pick<UpdateMemberPayload, 'name' | 'email'>): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/api/members/${memberId}`, payload);
  }

  /** Role change reuses POST /api/accounts/:id/members – it updates role if member already exists. */
  patchMemberRole(
    accountId: string,
    memberId: string,
    role: 'owner' | 'member',
  ): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/api/accounts/${accountId}/members`, {
      memberId,
      role,
    });
  }

  removeMemberFromAccount(accountId: string, memberId: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/api/accounts/${accountId}/members/${memberId}`);
  }

  // ---- Categories ----

  createCategory(accountId: string, payload: CreateCategoryPayload): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/api/categories`, {
      accountId,
      name: payload.name,
      customSplit: payload.customSplit ?? [],
    });
  }

  patchCategory(categoryId: string, payload: UpdateCategoryPayload): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/api/categories/${categoryId}`, payload);
  }

  deleteCategory(categoryId: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/api/categories/${categoryId}`);
  }
}

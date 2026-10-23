import type {z} from 'zod';
import type {CreateAccount} from '@tobu/contracts/accounts';
import type {CreateMember} from '@tobu/contracts/members';
import type {CreateCategory} from '@tobu/contracts/categories';
import type {CreateMemberIncome} from '@tobu/contracts/member-incomes';
import type {CreateCategoryBudget} from '@tobu/contracts/category-budgets';
import type {UpsertAccountBalance} from '@tobu/contracts/account-balances';
import type {ApiAccount, ApiMember, ApiCategory} from '@tobu/contracts/resources';
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { WizardModel } from '../domain/wizard.model';
import { DateTime } from 'luxon';
import { API_BASE_URL } from '@/core/api-base-url.token';

@Injectable({ providedIn: 'root' })
export class WizardDataService {
  private http = inject(HttpClient);
  private baseUrl = inject(API_BASE_URL);

  async createNewAccount(wizardData: WizardModel): Promise<string> {
    const currentMonth = DateTime.now().toFormat('yyyy-MM');

    try {
      // 1) Mitglieder anlegen → POST /api/members
      const memberMap = new Map<string, string>();
      for (const member of wizardData.members) {
        const response = await firstValueFrom(
          this.http.post<ApiMember>(`${this.baseUrl}/api/members`, {
            name: member.name,
            email: member.email,
            userId: member.userId  // Korrigiert: userId statt userID
          } satisfies z.input<typeof CreateMember>)
        );
        memberMap.set(member.tempId, response._id);
      }

      // 2) Account anlegen mit echten Member-IDs → POST /api/accounts
      const accountBody: z.input<typeof CreateAccount> = {
        name:wizardData.name,
        // Creator ownership needs a reliable user-to-member mapping (AUTH-002).
        // Preserve the API's default member role; list position must not grant ownership.
        members:wizardData.members.map(member => ({memberId:memberMap.get(member.tempId)!})),
      };

      const accountResponse = await firstValueFrom(
        this.http.post<ApiAccount>(`${this.baseUrl}/api/accounts`, accountBody)
      );
      const accountId = accountResponse._id;
      // The current API stores opening balance and incomes in dedicated resources.
      await firstValueFrom(this.http.put(`${this.baseUrl}/api/account-balances`, {
        accountId,month:currentMonth,closingBalanceMinor:Math.round(wizardData.initialValues.accountBalance*100),
      } satisfies z.input<typeof UpsertAccountBalance>));
      for (const initial of wizardData.initialValues.memberInitials) {
        await firstValueFrom(this.http.post(`${this.baseUrl}/api/member-incomes`, {
          accountId,memberId:memberMap.get(initial.memberId)!,amountMinor:Math.round(initial.initialIncome*100),fromMonth:currentMonth+'-01T00:00:00.000Z',
        } satisfies z.input<typeof CreateMemberIncome>));
      }

      // 3) Kategorien anlegen → POST /api/categories mit accountId
      const catMap = new Map<string, string>();
      for (const category of wizardData.categories) {
        const categoryBody: z.input<typeof CreateCategory> = {
          accountId,
          name: category.name
        };

        if (category.customSplit && category.customSplit.length) {
          categoryBody.customSplit = category.customSplit.map(split => ({
            memberId: memberMap.get(split.memberId)!,
            split: split.split
          }));
        }

        const categoryResponse = await firstValueFrom(
          this.http.post<ApiCategory>(`${this.baseUrl}/api/categories`, categoryBody)
        );
        catMap.set(category.tempId, categoryResponse._id);
      }

      // Category budgets replace legacy account.monthlyPlannedContributions.
      for (const initial of wizardData.initialValues.categoryInitials) {
        const amountMinor=Math.round(initial.initialExpenseEst*100);
        if(amountMinor<=0) continue; // No budget configured for this category.
        await firstValueFrom(this.http.post(`${this.baseUrl}/api/category-budgets`, {
          accountId,categoryId:catMap.get(initial.categoryId)!,amountMinor,fromMonth:currentMonth+'-01T00:00:00.000Z',
        } satisfies z.input<typeof CreateCategoryBudget>));
      }

      console.log(`Account ${accountId} erfolgreich angelegt mit Kategorien und Beiträgen.`);
      return accountId;

    } catch (error) {
      console.error('Fehler beim Anlegen des Accounts:', error);
      throw new Error(`Account-Erstellung fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    }
  }
}

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
          this.http.post<{ id: string }>(`${this.baseUrl}/api/members`, {
            name: member.name,
            email: member.email,
            userId: member.userId  // Korrigiert: userId statt userID
          })
        );
        memberMap.set(member.tempId, response.id);
      }

      // 2) Account anlegen mit echten Member-IDs → POST /api/accounts
      const accountBody = {
        name: wizardData.name,
        memberIds: wizardData.members.map(m => memberMap.get(m.tempId)!),
        balances: [
          {
            month: currentMonth,
            balanceMinor: Math.round(wizardData.initialValues.accountBalance * 100) // convert to cents
          }
        ],
        monthlyIncomes: wizardData.initialValues.memberInitials.map(initial => ({
          memberId: memberMap.get(initial.memberId)!,
          amountMinor: Math.round(initial.initialIncome * 100), // convert to cents
          startMonth: currentMonth
        }))
      };

      const accountResponse = await firstValueFrom(
        this.http.post<{ id: string }>(`${this.baseUrl}/api/accounts`, accountBody)
      );
      const accountId = accountResponse.id;

      // 3) Kategorien anlegen → POST /api/categories mit accountId
      const catMap = new Map<string, string>();
      for (const category of wizardData.categories) {
        const categoryBody: any = {
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
          this.http.post<{ id: string }>(`${this.baseUrl}/api/categories`, categoryBody)
        );
        catMap.set(category.tempId, categoryResponse.id);
      }

      // 4) Monthly Planned Contributions aktualisieren → PATCH /api/accounts/{id}
      if (wizardData.initialValues.categoryInitials.length > 0) {
        const plannedContributions = wizardData.initialValues.categoryInitials.map(initial => ({
          categoryId: catMap.get(initial.categoryId)!,
          amountMinor: Math.round(initial.initialExpenseEst * 100), // convert to cents
          startMonth: currentMonth
        }));

        await firstValueFrom(
          this.http.patch(`${this.baseUrl}/api/accounts/${accountId}`, {
            monthlyPlannedContributions: plannedContributions
          })
        );
      }

      console.log(`Account ${accountId} erfolgreich angelegt mit Kategorien und Beiträgen.`);
      return accountId;

    } catch (error) {
      console.error('Fehler beim Anlegen des Accounts:', error);
      throw new Error(`Account-Erstellung fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    }
  }
}

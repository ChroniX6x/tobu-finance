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

  async createNewAccount(wizardData: WizardModel) {

    const currentMonth = DateTime.now().toFormat('yyyy-MM');

    // 1) Mitglieder anlegen → /member
    const memberMap = new Map<string, number>();
    for (const member of wizardData.members) {
      const real = await firstValueFrom(
        this.http.post<{ id: number }>(`${this.baseUrl}/member`, {
          name: member.name,
          email: member.email,
          userID: member.userId
        })
      );
      memberMap.set(member.tempId, real.id);
    }

    // 2) Account anlegen mit echten Member-IDs → /accounts
    const accountBody: any = {
      name: wizardData.name,
      members: wizardData.members.map(m => memberMap.get(m.tempId)),
      balances: [
        { month: currentMonth, value: wizardData.initialValues.accountBalance }
      ],
      monthlyIncomes: wizardData.initialValues.memberInitials.map(initial => ({
        memberId: memberMap.get(initial.memberId),
        amount: initial.initialIncome,
        startMonth: currentMonth
      })),
      // monthlyPlannedContributions wird nach Kategorien angelegt
    };

    const account = await firstValueFrom(
      this.http.post<{ id: number }>(`${this.baseUrl}/accounts`, accountBody)
    );
    const accountId = account.id;

    // 3) Kategorien anlegen → /categories mit accountId
    const catMap = new Map<string, number>();
    for (const category of wizardData.categories) {
      const body: any = {
        accountId,
        name: category.name
      };
      if (category.customSplit && category.customSplit.length) {
        body.customSplit = category.customSplit.map(split => ({
          memberId: memberMap.get(split.memberId),
          split: split.split
        }));
      }
      const realCat = await firstValueFrom(
        this.http.post<{ id: number }>(`${this.baseUrl}/categories`, body)
      );
      catMap.set(category.tempId, realCat.id);
    }

    // 4) Monthly Planned Contributions anlegen → /accounts (embedded) oder separate Verarbeitung
    // Hier als Patch auf den Account, da embedded-Array
    const planned = wizardData.initialValues.categoryInitials.map(initial => ({
      categoryId: catMap.get(initial.categoryId),
      amount: initial.initialExpenseEst,
      startMonth: currentMonth
    }));
    await firstValueFrom(
      this.http.patch(`${this.baseUrl}/accounts/${accountId}`, { monthlyPlannedContributions: planned })
    );

    console.log(`Account ${accountId} erfolgreich angelegt und Kategorien + Beiträge gesetzt.`);
  }
}

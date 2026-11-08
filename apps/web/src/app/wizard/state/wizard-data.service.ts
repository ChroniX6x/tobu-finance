import type { z } from "zod";
import type { CreateAccount } from "@tobu/contracts/accounts";
import type { CreateMember } from "@tobu/contracts/members";
import type { CreateCategory } from "@tobu/contracts/categories";
import type { CreateMemberIncome } from "@tobu/contracts/member-incomes";
import type { CreateCategoryBudget } from "@tobu/contracts/category-budgets";
import type { UpsertAccountBalance } from "@tobu/contracts/account-balances";
import type {
  ApiAccount,
  ApiMember,
  ApiCategory,
} from "@tobu/contracts/resources";
import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpContext } from "@angular/common/http";
import { CREATION_COMMITTED } from "@/core/auth/interceptors/creation.interceptor";
import { firstValueFrom } from "rxjs";
import { WizardModel } from "../domain/wizard.model";
import { currentUtcMonthKey } from "@/shared/utils/calendar-picker";
import { monthKeyToAnchorIso, MonthKeySchema } from "@tobu/contracts/calendar";
import { API_BASE_URL } from "@/core/api-base-url.token";
import { AuthStore } from "@/core/auth/services/auth.store";

@Injectable({ providedIn: "root" })
export class WizardDataService {
  private http = inject(HttpClient);
  private baseUrl = inject(API_BASE_URL);
  private authStore = inject(AuthStore);
  private completedCheckpoint: { key: string; accountId: string } | null = null;

  completeAccountCreation(accountId: string): void {
    if (this.completedCheckpoint?.accountId === accountId) {
      sessionStorage.removeItem(this.completedCheckpoint.key);
      this.completedCheckpoint = null;
    }
  }

  /** The signed-in user; after a refresh without a restored profile the id and e-mail come from the access token. */
  signedInUser(): { id: string; email: string; name?: string } | null {
    const user = this.authStore.user();
    if (user) return user;
    try {
      const payload = this.authStore.getAccessToken()?.split(".")[1];
      if (!payload) return null;
      const claims = JSON.parse(
        atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
      ) as { sub?: string; email?: string };
      return claims.sub && claims.email
        ? { id: claims.sub, email: claims.email }
        : null;
    } catch {
      return null;
    }
  }

  async createNewAccount(wizardData: WizardModel): Promise<string> {
    let currentMonth = currentUtcMonthKey();
    const user = this.signedInUser();
    if (!user) throw new Error("Not signed in");

    // The signed-in user is always part of the new account through their own member (becomes owner on the server).
    // Other members are never linked to a login here.
    const creator = {
      tempId: "__creator__",
      name: user.name?.trim() || user.email,
      email: user.email,
      userId: user.id,
    };
    const members = [
      creator,
      ...wizardData.members
        .filter((member) => !member.userId)
        .map(({ tempId, name, email }) => ({
          tempId,
          name,
          email,
          userId: undefined as string | undefined,
        })),
    ];

    const aliases = new Map([
      ...members.map(
        (member, index) => [member.tempId, "member_" + index] as const,
      ),
      ...wizardData.categories.map(
        (category, index) => [category.tempId, "category_" + index] as const,
      ),
    ]);
    // Temporary UI ids and display labels must not defeat resumption of the same completed steps.
    const plan = JSON.stringify(wizardData, (key, value) => {
      if (key === "member" || key === "category") return undefined;
      if (
        ["tempId", "memberId", "categoryId"].includes(key) &&
        typeof value === "string"
      )
        return aliases.get(value) ?? value;
      if (
        value &&
        !Array.isArray(value) &&
        typeof value === "object" &&
        value.userId
      )
        return { tempId: aliases.get(value.tempId), userId: "__self__" };
      return value;
    });
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify([user.id, plan])),
    );
    const checkpointKey =
      "tobu-wizard:" +
      Array.from(new Uint8Array(digest), (n) =>
        n.toString(16).padStart(2, "0"),
      ).join("");
    const checkpoints: Record<string, string> = JSON.parse(
      sessionStorage.getItem(checkpointKey) ?? "{}",
    );
    if (checkpoints["initialMonth"])
      currentMonth = MonthKeySchema.parse(checkpoints["initialMonth"]);
    else {
      checkpoints["initialMonth"] = currentMonth;
      sessionStorage.setItem(checkpointKey, JSON.stringify(checkpoints));
    }
    const create = async (
      step: string,
      work: (options: { context: HttpContext }) => Promise<{ _id: string }>,
    ): Promise<{ _id: string }> => {
      if (checkpoints[step]) return { _id: checkpoints[step] };
      const checkpoint = (body: unknown) => {
        const id = (body as { _id?: string })?._id;
        if (!id) throw new Error("Missing creation resource id");
        checkpoints[step] = id;
        sessionStorage.setItem(checkpointKey, JSON.stringify(checkpoints));
      };
      const result = await work({
        context: new HttpContext().set(CREATION_COMMITTED, checkpoint),
      });
      // Also handles natural singleton responses which needed no signed proof.
      checkpoint(result);
      return result;
    };
    try {
      // 1) Mitglieder anlegen → POST /api/members
      const memberMap = new Map<string, string>();
      for (const member of members) {
        const response = await create(
          "member:" + aliases.get(member.tempId),
          (options) =>
            firstValueFrom(
              this.http.post<ApiMember>(
                `${this.baseUrl}/api/members`,
                {
                  name: member.name,
                  email: member.email,
                  userId: member.userId,
                } satisfies z.input<typeof CreateMember>,
                options,
              ),
            ),
        );
        memberMap.set(member.tempId, response._id);
      }

      // 2) Account anlegen mit echten Member-IDs → POST /api/accounts
      const accountBody: z.input<typeof CreateAccount> = {
        name: wizardData.name,
        members: members.map((member) => ({
          memberId: memberMap.get(member.tempId)!,
        })),
      };

      const accountResponse = await create("account", (options) =>
        firstValueFrom(
          this.http.post<ApiAccount>(
            `${this.baseUrl}/api/accounts`,
            accountBody,
            options,
          ),
        ),
      );
      const accountId = accountResponse._id;
      // The current API stores opening balance and incomes in dedicated resources.
      await firstValueFrom(
        this.http.put(`${this.baseUrl}/api/account-balances`, {
          accountId,
          month: currentMonth,
          closingBalanceMinor: Math.round(
            wizardData.initialValues.accountBalance * 100,
          ),
        } satisfies z.input<typeof UpsertAccountBalance>),
      );
      for (const initial of wizardData.initialValues.memberInitials) {
        await create("income:" + aliases.get(initial.memberId), (options) =>
          firstValueFrom(
            this.http.post<{ _id: string }>(
              `${this.baseUrl}/api/member-incomes`,
              {
                accountId,
                memberId: memberMap.get(initial.memberId)!,
                amountMinor: Math.round(initial.initialIncome * 100),
                fromMonth: monthKeyToAnchorIso(currentMonth),
              } satisfies z.input<typeof CreateMemberIncome>,
              options,
            ),
          ),
        );
      }

      // 3) Kategorien anlegen → POST /api/categories mit accountId
      const catMap = new Map<string, string>();
      for (const category of wizardData.categories) {
        const categoryBody: z.input<typeof CreateCategory> = {
          accountId,
          name: category.name,
        };

        if (category.customSplit && category.customSplit.length) {
          categoryBody.customSplit = category.customSplit.map((split) => ({
            memberId: memberMap.get(split.memberId)!,
            split: split.split,
          }));
        }

        const categoryResponse = await create(
          "category:" + aliases.get(category.tempId),
          (options) =>
            firstValueFrom(
              this.http.post<ApiCategory>(
                `${this.baseUrl}/api/categories`,
                categoryBody,
                options,
              ),
            ),
        );
        catMap.set(category.tempId, categoryResponse._id);
      }

      // Category budgets replace legacy account.monthlyPlannedContributions.
      for (const initial of wizardData.initialValues.categoryInitials) {
        const amountMinor = Math.round(initial.initialExpenseEst * 100);
        if (amountMinor <= 0) continue; // No budget configured for this category.
        await create("budget:" + aliases.get(initial.categoryId), (options) =>
          firstValueFrom(
            this.http.post<{ _id: string }>(
              `${this.baseUrl}/api/category-budgets`,
              {
                accountId,
                categoryId: catMap.get(initial.categoryId)!,
                amountMinor,
                fromMonth: monthKeyToAnchorIso(currentMonth),
              } satisfies z.input<typeof CreateCategoryBudget>,
              options,
            ),
          ),
        );
      }

      console.log(
        `Account ${accountId} erfolgreich angelegt mit Kategorien und Beiträgen.`,
      );
      this.completedCheckpoint = { key: checkpointKey, accountId };
      return accountId;
    } catch (error) {
      console.error("Fehler beim Anlegen des Accounts:", error);
      throw new Error(
        `Account-Erstellung fehlgeschlagen: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`,
      );
    }
  }
}

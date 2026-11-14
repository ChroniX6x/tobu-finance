import { test, expect } from "./helpers/test-fixture";
import {
  ACCOUNT_ID,
  MEMBER_1_ID,
  mockAccountOverviewRoutes,
} from "./helpers/mocks";
import type { AccountMasterDataResponse } from "@tobu/contracts/master-data";

for (const editor of ["account", "member"] as const) {
  test(`P02 ${editor} editor closes after owner capability is lost`, async ({
    page,
  }) => {
    await mockAccountOverviewRoutes(page);
    let role: "owner" | "member" = "owner";
    const mutations: string[] = [];
    page.on("request", (request) => {
      if (
        new URL(request.url()).pathname.startsWith("/api/") &&
        ["PATCH", "DELETE", "PUT"].includes(request.method())
      )
        mutations.push(request.url());
    });
    await page.route(`**/api/accounts/${ACCOUNT_ID}/master-data`, (route) => {
      const vm: AccountMasterDataResponse = {
        account: {
          _id: ACCOUNT_ID,
          name: "P02 account",
          currency: "EUR",
          memberCount: 1,
          callerRole: role,
          settings: {
            dashboard: { historyMonths: 6, topKCategories: 5 },
            alerts: {
              lowBalanceForecastMinor: null,
              carryoverLargeMinor: null,
              stalenessDays: null,
            },
          },
        },
        members: [
          {
            memberId: MEMBER_1_ID,
            name: "Self",
            email: null,
            avatar: null,
            role,
            hasUserAccount: true,
            canRemoveFromAccount: false,
            canChangeRole: false,
            usageHints: [],
          },
        ],
        categories: [],
        meta: {
          uncategorizedTransactionCount: 0,
          hasSingleMemberInfo: true,
          infoHints: [],
          warningHints: [],
        },
      };
      return route.fulfill({ json: vm });
    });
    await page.goto(`/accounts/${ACCOUNT_ID}/manage/master-data`);
    await expect(
      page.getByRole("heading", { name: "Stammdaten" }),
    ).toBeVisible();
    if (editor === "account") {
      await page
        .locator("tbf-account-master-section")
        .getByRole("button", { name: /Bearbeiten$/ })
        .click();
      await expect(
        page.getByRole("button", { name: /Speichern$/ }),
      ).toBeVisible();
    } else {
      await page.getByRole("button", { name: /Mitglied hinzufügen$/ }).click();
      await expect(page.locator("#mem-name")).toBeVisible();
      await expect(page.getByRole("combobox")).toBeVisible();
    }
    role = "member";
    const loaded = page.waitForResponse(
      (response) => response.url().endsWith("/master-data") && response.ok(),
    );
    // Invoke the existing reload action through the development component; no store state is forged.
    await page.evaluate(() => {
      const component = document.querySelector("tbf-master-data-page")!;
      const debug = (
        window as unknown as {
          ng: { getComponent(element: Element): { retry(): void } };
        }
      ).ng;
      debug.getComponent(component).retry();
    });
    await loaded;
    await expect(
      page.getByRole("button", { name: /Mitglied hinzufügen$/ }),
    ).toHaveCount(0);
    await expect(
      page
        .locator("tbf-account-master-section")
        .getByRole("button", { name: /Bearbeiten$/ }),
    ).toHaveCount(0);
    await expect(page.locator("#mem-name")).not.toBeVisible();
    await expect(page.getByRole("button", { name: /Speichern$/ })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: /Mitglied bearbeiten$/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Kategorie hinzufügen$/ }),
    ).toBeVisible();
    expect(mutations).toEqual([]);
  });
}

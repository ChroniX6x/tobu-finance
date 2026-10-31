/**
 * H06 – CAL-09: event instants are shown in the user's zone and never reinterpreted as BankDates.
 */
import { expect, test } from "./helpers/test-fixture";
import {
  ACCOUNT_ID,
  mockAccountOverview,
  mockAccountOverviewRoutes,
} from "./helpers/mocks";

// 2026-10-31T23:30Z is the local day shown below in each zone (DST offsets of that date).
const CASES = [
  { timezoneId: "Europe/Berlin", label: "01.11." },
  { timezoneId: "Asia/Tokyo", label: "01.11." },
  { timezoneId: "America/New_York", label: "31.10." },
  { timezoneId: "America/Los_Angeles", label: "31.10." },
] as const;

for (const c of CASES) {
  test.describe(`event instant in ${c.timezoneId}`, () => {
    test.use({ timezoneId: c.timezoneId });

    test("timeline shows the local day of the instant (CAL-09)", async ({
      page,
      useMocks,
    }) => {
      await mockAccountOverviewRoutes(page, useMocks);
      await page.route(`**/api/accounts/${ACCOUNT_ID}/overview`, (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ...mockAccountOverview,
            timeline: [
              {
                id: "evt-instant",
                date: "2026-10-31T23:30:00.000Z",
                user: "Caro",
                text: "Instant-Ereignis",
              },
            ],
          }),
        }),
      );
      await page.goto(`/accounts/${ACCOUNT_ID}`);
      const row = page.getByText("Instant-Ereignis");
      await expect(row).toBeVisible();
      await expect(row.locator("xpath=..")).toContainText(c.label);
    });
  });
}

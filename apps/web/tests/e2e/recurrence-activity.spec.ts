import { test, expect } from "./helpers/test-fixture";
import { ACCOUNT_ID, mockAccountOverviewRoutes } from "./helpers/mocks";

test("E07 contract renderer/filter shows a minimized deleted fixture without a domain link", async ({
  page,
  useMocks,
}) => {
  await mockAccountOverviewRoutes(page, useMocks);
  await page.route(`**/api/accounts/${ACCOUNT_ID}/activity?**`, (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: "e".repeat(24),
            accountId: ACCOUNT_ID,
            occurredAt: "2026-11-08T12:00:00.000Z",
            schemaVersion: 1,
            code: "recurrence.deleted",
            actor: {
              kind: "user",
              memberId: null,
              displayName: "<script>actor</script>",
            },
            trigger: { kind: "user_action" },
            subject: null,
            params: null,
            detailsUnavailable: true,
          },
        ],
        nextCursor: null,
      },
    }),
  );
  await page.goto(`/accounts/${ACCOUNT_ID}/activity?code=recurrence.deleted`);
  const entry = page.locator("[data-event-id]");
  await expect(entry).toContainText(
    "Buchungsvorlage gelöscht – Details nicht verfügbar",
  );
  await expect(entry).toContainText("<script>actor</script>");
  await expect(entry.locator("a,script")).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Ereignisart", exact: true }),
  ).toHaveValue("recurrence.deleted");
  await expect(
    page.getByRole("option", {
      name: "Vorlagenvorkommen erzeugt",
      exact: true,
    }),
  ).toHaveCount(1);
});

import { test, expect } from "./helpers/test-fixture";
import { ACCOUNT_ID, mockAccountOverviewRoutes } from "./helpers/mocks";
import { ActivityItemSchema } from "@tobu/contracts/activity";
import type { Locator } from "@playwright/test";

test("activity controls follow semantic light/dark colors and interactive states", async ({
  page,
  useMocks,
}) => {
  await mockAccountOverviewRoutes(page, useMocks);
  await page.route(`**/api/accounts/${ACCOUNT_ID}/activity?**`, (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
  await page.goto(`/accounts/${ACCOUNT_ID}/activity`);
  const input = page.getByLabel("Objekt-ID", { exact: true });
  const select = page.getByRole("combobox", { name: "Akteur", exact: true });
  const button = page.getByRole("button", {
    name: "Filter anwenden",
    exact: true,
  });
  const disabled = page.getByRole("button", {
    name: "Keine weitere Seite verfügbar",
    exact: true,
  });
  await expect(disabled).toBeDisabled();
  const matchesToken = async (
    locator: Locator,
    property: string,
    token: string,
  ) => {
    const colors = await locator.evaluate(
      (element, { property, token }) => {
        const probe = document.createElement("span");
        probe.style.setProperty(property, `var(${token})`);
        element.parentElement!.append(probe);
        const expected = getComputedStyle(probe).getPropertyValue(property);
        probe.remove();
        return {
          actual: getComputedStyle(element).getPropertyValue(property),
          expected,
          defined:
            getComputedStyle(element).getPropertyValue(token).trim() !== "",
        };
      },
      { property, token },
    );
    expect(colors.defined, token).toBe(true);
    expect(colors.actual, property + " uses " + token).toBe(colors.expected);
  };
  const backgrounds: string[] = [];
  for (const dark of [false, true]) {
    await page.evaluate(
      (dark) => document.documentElement.classList.toggle("app-dark", dark),
      dark,
    );
    await page.mouse.move(0, 0);
    await matchesToken(input, "background-color", "--p-form-field-background");
    await matchesToken(input, "color", "--p-form-field-color");
    await matchesToken(select, "background-color", "--p-form-field-background");
    await matchesToken(button, "background-color", "--p-primary-color");
    await matchesToken(button, "color", "--p-primary-contrast-color");
    backgrounds.push(
      await input.evaluate((el) => getComputedStyle(el).backgroundColor),
    );
    await input.hover();
    await matchesToken(
      input,
      "border-top-color",
      "--p-form-field-hover-border-color",
    );
    await input.focus();
    await matchesToken(
      input,
      "border-top-color",
      "--p-form-field-focus-border-color",
    );
    await page
      .getByRole("combobox", { name: "Ereignisse pro Seite", exact: true })
      .focus();
    await page.keyboard.press("Tab");
    await expect(button).toBeFocused();
    await matchesToken(button, "outline-color", "--p-focus-ring-color");
    await button.hover();
    await matchesToken(button, "background-color", "--p-primary-hover-color");
    await matchesToken(disabled, "background-color", "--p-primary-color");
    await matchesToken(disabled, "opacity", "--p-disabled-opacity");
  }
  expect(backgrounds[0]).not.toBe(backgrounds[1]);
});

const event = (n: number) =>
  ActivityItemSchema.parse({
    id: n.toString(16).padStart(24, "0"),
    accountId: ACCOUNT_ID,
    occurredAt: "2026-11-08T12:00:00.000Z",
    schemaVersion: 1,
    code: "transaction.splitChildCreated",
    actor: {
      kind: "user",
      memberId: null,
      displayName: "<img src=x onerror=alert(1)>",
    },
    trigger: { kind: "user_action" },
    subject: {
      kind: "transaction",
      id: "b".repeat(24),
      deleted: n === 25,
      label: "Buchung",
    },
    params: {
      transactionId: "b".repeat(24),
      parentTransactionId: "c".repeat(24),
      type: "expense",
      amountMinor: 1234,
      title: "<script>alert(1)</script>",
    },
    group: { key: "d".repeat(64), source: "batch", scope: "loaded_only" },
  });

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`E06 activity filters, partial loaded group, XSS, keyboard and accessible mobile ${viewport.width}`, async ({
    page,
    useMocks,
  }) => {
    await page.setViewportSize(viewport);
    await mockAccountOverviewRoutes(page, useMocks);
    const requests: URL[] = [];
    await page.route(
      `**/api/accounts/${ACCOUNT_ID}/activity?**`,
      async (route) => {
        const url = new URL(route.request().url());
        requests.push(url);
        const items = url.searchParams.has("actorKind")
          ? []
          : url.searchParams.has("cursor")
            ? Array.from({ length: 5 }, (_, i) => event(5 - i))
            : Array.from({ length: 20 }, (_, i) => event(25 - i));
        await route.fulfill({
          json: {
            items,
            nextCursor:
              url.searchParams.has("actorKind") ||
              url.searchParams.has("cursor")
                ? null
                : "opaque-page-two",
          },
        });
      },
    );
    await page.goto(`/accounts/${ACCOUNT_ID}/activity`);
    await expect(
      page.getByRole("heading", { name: "Kontoaktivitäten", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toContainText(
      "20 Ereignisse geladen",
    );
    const summary = page.locator("summary");
    await expect(summary).toHaveText("20 geladene Ereignisse einer Aktion");
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("Dies ist keine Gesamterfolgsmeldung.", { exact: false }),
    ).toBeVisible();
    const deleted = page.locator("[data-event-id]").first();
    await expect(deleted).toContainText("gelöscht oder nicht mehr verfügbar");
    await expect(deleted.locator("a")).toHaveCount(0);
    await expect(
      page.locator(".activity script, .activity img, .activity [onerror]"),
    ).toHaveCount(0);
    await expect(deleted).toContainText("<script>alert(1)</script>");
    await page
      .getByRole("button", { name: "Weitere Aktivitäten laden", exact: true })
      .click();
    await expect(summary).toHaveText("25 geladene Ereignisse einer Aktion");
    await expect(page.getByRole("status")).toBeFocused();
    expect(
      new Set(
        await page
          .locator("[data-event-id]")
          .evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute("data-event-id")),
          ),
      ).size,
    ).toBe(25);
    await expect(
      page.getByRole("button", { name: "Keine weitere Seite verfügbar" }),
    ).toBeDisabled();
    await page.screenshot({
      path: `../../test-results/e06/activity-${viewport.width}.png`,
      fullPage: true,
    });
    const form = page.getByRole("form", { name: "Aktivitäten filtern" });
    for (const label of [
      "Objekt-ID",
      "Von (einschließlich)",
      "Bis (ausschließlich)",
    ])
      await expect(form.getByLabel(label, { exact: true })).toBeVisible();
    for (const name of [
      "Ereignisart",
      "Akteur",
      "Objektart",
      "Ereignisse pro Seite",
    ])
      await expect(
        form.getByRole("combobox", { name, exact: true }),
      ).toBeVisible();
    const aria = await form.ariaSnapshot();
    expect(aria).toContain('combobox "Akteur"');
    expect(aria).toContain('button "Filter anwenden"');
    await page
      .getByRole("combobox", { name: "Akteur", exact: true })
      .selectOption("system");
    await page.getByRole("button", { name: "Filter anwenden" }).click();
    await expect(
      page.getByText("Keine passenden Aktivitäten vorhanden."),
    ).toBeVisible();
    expect(requests.at(-1)?.searchParams.get("actorKind")).toBe("system");
    expect(
      await page
        .locator(".activity")
        .evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
  });
}

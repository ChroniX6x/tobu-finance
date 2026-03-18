import { expect, test } from './helpers/test-fixture';
import {
  ACCOUNT_ID,
  mockAccountOverview,
  mockAccountOverviewRoutes,
  mockTransactionsPageRoutes,
} from './helpers/mocks';

const url = `/accounts/${ACCOUNT_ID}`;

test.describe('Account overview page', () => {
  test.beforeEach(async ({ page, useMocks }) => {
    await mockAccountOverviewRoutes(page, useMocks);
    await page.goto(url);
  });

  test('shows the account name', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: mockAccountOverview.account.name }),
    ).toBeVisible();
  });

  test('shows the current balance', async ({ page }) => {
    // Wait for the account name heading to confirm the page has loaded
    await expect(page.getByRole('heading', { name: mockAccountOverview.account.name })).toBeVisible();
    // 250000 minor → 2500 EUR, Angular currency:'EUR' with 1.0-0 → "€2,500" (en-US locale)
    await expect(page.getByText(/2[,.]500/).first()).toBeVisible();
  });

  test('shows all members', async ({ page }) => {
    for (const member of mockAccountOverview.members) {
      await expect(page.getByText(member.name).first()).toBeVisible();
    }
  });

  test('marks paid member with check icon', async ({ page }) => {
    // Caro is paid=true → rendered with pi-check class
    const caroBadge = page.locator('div').filter({ hasText: 'Caro' }).filter({ has: page.locator('.pi-check') });
    await expect(caroBadge.first()).toBeVisible();
  });

  test('marks unpaid member with clock icon', async ({ page }) => {
    const tobiBadge = page.locator('div').filter({ hasText: 'Tobi' }).filter({ has: page.locator('.pi-clock') });
    await expect(tobiBadge.first()).toBeVisible();
  });

  test('"Buchungen" tab navigates to transactions page', async ({ page, useMocks }) => {
    // Also set up the transactions-page mocks so navigating to /transactions doesn't
    // trigger an API failure → auth redirect
    await mockTransactionsPageRoutes(page, useMocks);
    await page.getByRole('tab', { name: /Buchungen/i }).click();
    await expect(page).toHaveURL(new RegExp(`/accounts/${ACCOUNT_ID}/transactions`));
  });

  test('"Übersicht" tab is active by default', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /Übersicht/i })).toHaveAttribute('aria-selected', 'true');
  });
});

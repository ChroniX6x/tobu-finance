import { expect, test } from './helpers/test-fixture';
import {
  ACCOUNT_ID,
  mockAccountsListRoutes,
  mockAccountsSummary,
} from './helpers/mocks';

test.describe('Accounts list page', () => {
  test.beforeEach(async ({ page, useMocks }) => {
    await mockAccountsListRoutes(page, useMocks);
    await page.goto('/accounts');
  });

  test('renders the page heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Deine Konten' })).toBeVisible();
  });

  test('shows an account card for each mocked account', async ({ page }) => {
    for (const acc of mockAccountsSummary) {
      await expect(page.getByRole('heading', { name: acc.name, level: 3 })).toBeVisible();
    }
  });

  test('shows the account balance in EUR format', async ({ page }) => {
    // 250000 minor → 2500 EUR; Angular currency pipe in en-US locale: "€2,500.00"
    await expect(page.locator('.text-primary').filter({ hasText: '2,500' }).first()).toBeVisible();
  });

  test('shows participant count for each account', async ({ page }) => {
    // Wait for account cards to be fully rendered before checking participant count
    await expect(page.getByRole('heading', { name: 'E2E Konto', level: 3 })).toBeVisible();
    await expect(page.getByText(/2 Teilnehmer/i)).toBeVisible();
  });

  test('clicking an account card navigates to its overview', async ({ page }) => {
    const card = page.getByRole('heading', { name: mockAccountsSummary[0].name, level: 3 });
    await card.click();
    await expect(page).toHaveURL(new RegExp(`/accounts/${ACCOUNT_ID}`));
  });
});

import {mockTransactionsPageRoutes} from './helpers/mocks';
import { expect, test } from './helpers/test-fixture';

const accountId = '100000000000000000000001';

test.beforeEach(async ({ page, useMocks }) => {
  if (useMocks) {
    await page.route('**/api/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accessToken: 'e2e-token' }),
      });
    });

    await mockTransactionsPageRoutes(page);

    await page.route('**/api/transactions?**', async (route) => {
      const url = new URL(route.request().url());
      const query = (url.searchParams.get('q') ?? '').toLowerCase();

      const parentItem = {
        _id: '400000000000000000000002',
        accountId,
        type: 'expense',
        amountMinor: 12000,
        status: 'booked',
        bookDate: '2026-02-16T00:00:00.000Z',
        month: '2026-02-01T00:00:00.000Z',
        title: 'Aldi Einkauf',
        notes: null,
        categoryId: '300000000000000000000001',
        isFromSharedAccount: false,
        paidByMemberId: '200000000000000000000001',
        parentTransactionId: null,
        children: [
          {
            _id: '400000000000000000000003',
            accountId,
            type: 'expense',
            amountMinor: 3000,
            status: 'booked',
            bookDate: '2026-02-16T00:00:00.000Z',
            month: '2026-02-01T00:00:00.000Z',
            title: 'Bier',
            notes: null,
            categoryId: '300000000000000000000002',
            isFromSharedAccount: false,
            paidByMemberId: '200000000000000000000001',
            parentTransactionId: '400000000000000000000002',
          },
        ],
      };

      const items = query && !parentItem.title.toLowerCase().includes(query) ? [] : [parentItem];

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items,
          total: items.length,
          page: 1,
          pageSize: 50,
        }),
      });
    });

    await page.route('**/api/transactions', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }

      const payload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          _id: '400000000000000000000009',
          accountId,
          type: payload.type ?? 'expense',
          amountMinor: payload.amountMinor ?? 0,
          status: payload.status ?? 'booked',
          bookDate: payload.bookDate ?? '2026-02-16T00:00:00.000Z',
          month: '2026-02-01T00:00:00.000Z',
          title: payload.title ?? 'created',
          notes: payload.notes ?? null,
          categoryId: payload.categoryId ?? null,
          isFromSharedAccount: payload.isFromSharedAccount ?? true,
          paidByMemberId: payload.paidByMemberId ?? null,
          parentTransactionId: payload.parentTransactionId ?? null,
        }),
      });
    });
  }

  await page.goto(`/accounts/${accountId}/transactions`);

  const captureButton = page.locator('.capture-dock-tab .dock-toggle-btn');
  await expect(captureButton).toBeVisible();
  await captureButton.click();

  await expect(page.getByRole('heading', { name: 'Quick Add' })).toBeVisible();
});

test('supports keyboard flow for transaction capture', async ({ page }) => {
  const amount = page.locator('input[id^="amount-input"]');
  const title = page.locator('#title-input');

  await amount.click();
  await amount.fill('12');
  await title.click();
  await expect(title).toBeFocused();

  await title.fill('Brot');
  await page.keyboard.press('Enter');

  await expect(page.getByText('Brot')).toBeVisible();
  await expect(amount).toBeFocused();

  await amount.fill('15');
  await title.fill('Milch');
  await page.keyboard.press('Shift+Enter');

  await expect(page.getByText('Milch')).toBeVisible();
  await expect(amount).toBeFocused();

  await amount.fill('22');
  await title.fill('Wird geloescht');
  await page.keyboard.press('Escape');
  await expect(title).toHaveValue('');

  await page.keyboard.press('Control+s');
  await expect(page.locator('.queue-list .queue-item-title', { hasText: 'Brot' })).toHaveCount(0);
  await expect(page.locator('.queue-list .queue-item-title', { hasText: 'Milch' })).toHaveCount(0);
});

test('tabs naturally through amount → type options → title in DOM order', async ({ page }) => {
  const amount = page.locator('input[id^="amount-input"]');
  const title = page.locator('#title-input');
  // PrimeNG SelectButton renders each option as a p-togglebutton[role="button"].
  // Both are independently tabbable (tabindex=0 by default from ToggleButton source).
  const ausgabe = page.getByRole('button', { name: 'Ausgabe' });
  const einnahme = page.getByRole('button', { name: 'Einnahme' });

  await amount.click();
  await expect(amount).toBeFocused();

  // Tab from amount → first SelectButton option (Ausgabe)
  await page.keyboard.press('Tab');
  await expect(ausgabe).toBeFocused();

  // Tab within SelectButton → second option (Einnahme)
  await page.keyboard.press('Tab');
  await expect(einnahme).toBeFocused();

  // Tab from last SelectButton option → title input
  await page.keyboard.press('Tab');
  await expect(title).toBeFocused();

  // Shift+Tab: title → back into SelectButton (Einnahme)
  await page.keyboard.press('Shift+Tab');
  await expect(einnahme).toBeFocused();

  // Shift+Tab: Einnahme → Ausgabe
  await page.keyboard.press('Shift+Tab');
  await expect(ausgabe).toBeFocused();

  // Shift+Tab: Ausgabe → amount
  await page.keyboard.press('Shift+Tab');
  await expect(amount).toBeFocused();
});

test('supports parent and member autocomplete in capture dock', async ({ page }) => {
  // paid-by is a p-select which renders as a <span role="combobox"> with the inputId – not an <input>
  const paidBySelect = page.locator('[id="paid-by-select"]');
  await paidBySelect.click();
  // After opening the overlay, options should be listed
  await expect(page.getByRole('option', { name: 'Caro' })).toBeVisible();
  await page.keyboard.press('Escape');

  // Switch to split mode to reveal the parent autocomplete input
  await page.getByRole('button', { name: 'Teil' }).click();

  // parent-input is a real <input> inside p-autoComplete
  const parentInput = page.locator('input[id^="parent-input"]');
  await parentInput.click();
  await parentInput.fill('Aldi');

  await expect(page.getByRole('option', { name: /Aldi Einkauf/i })).toBeVisible();
});

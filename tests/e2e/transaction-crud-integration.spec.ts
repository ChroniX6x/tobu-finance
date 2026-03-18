/**
 * Transaction CRUD Integration Tests
 *
 * These tests verify:
 * 1. "Neue Buchung" opens an empty creation form in the detail panel (not the dock)
 * 2. The creation form POSTs to the API with correct data (YYYY-MM-DD date, amountMinor in cents)
 * 3. PATCH sends the transaction ID in the URL path, not the request body
 * 4. PATCH body contains only the changed fields
 *
 * Routes are intercepted to inspect the request payload while returning a valid mock
 * response so the Angular state machine advances normally.
 *
 * To run against a real backend (http://localhost:4000), replace `route.fulfill()`
 * with `route.fallback()` in the interceptors below.
 */

import { expect, test, type Page } from './helpers/test-fixture';
import {
  ACCOUNT_ID,
  mockTransactionsPageRoutes,
  mockTransaction,
} from './helpers/mocks';

const url = `/accounts/${ACCOUNT_ID}/transactions`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function setupRoutes(page: Page, useMocks: boolean) {
  await mockTransactionsPageRoutes(page, useMocks);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Transaction CRUD – API contract', () => {

  // ─── "Neue Buchung" feature ────────────────────────────────────────────────

  test.describe('"Neue Buchung" button', () => {
    test.beforeEach(async ({ page, useMocks }) => {
      await setupRoutes(page, useMocks);
      await page.goto(url);
    });

    test('opens an empty creation form in the detail panel', async ({ page }) => {
      await page.getByRole('button', { name: /Neue Buchung/i }).click();

      // The detail panel shows the "Neue Buchung" heading (confirms isNew() = true)
      await expect(page.getByRole('heading', { name: 'Neue Buchung' })).toBeVisible();

      // The title input is visible and empty
      const titleInput = page.locator('#title');
      await expect(titleInput).toBeVisible();
      await expect(titleInput).toHaveValue('');

      // Click the title field to ensure Angular's OnPush CD has completed p-button initialization
      // (PrimeNG p-button renders its label span in a subsequent CD cycle after creation)
      await titleInput.click();

      // Submit button says "Anlegen" (create mode, not "Speichern" edit mode)
      await expect(page.locator('button:has-text("Anlegen")')).toBeVisible();
    });

    test('does NOT open or interact with the capture dock', async ({ page }) => {
      // Dock should be in collapsed tab state initially
      await expect(page.locator('.capture-dock-tab')).toBeVisible();

      await page.getByRole('button', { name: /Neue Buchung/i }).click();

      // Dock must still be collapsed (no "Quick Add" section)
      await expect(page.getByText('Quick Add')).not.toBeVisible();

      // No draft counter badge on the dock toggle
      await expect(page.locator('.capture-dock-tab')).toBeVisible();
    });
  });

  // ─── Create via detail form ────────────────────────────────────────────────

  test.describe('Creating a transaction via the detail form', () => {
    test('POSTs to /api/transactions with amountMinor in cents', async ({ page, useMocks }) => {
      let postedBody: Record<string, unknown> | null = null;

      await setupRoutes(page, useMocks);
      await page.route('**/api/transactions', async (route) => {
        if (route.request().method() === 'POST') {
          postedBody = route.request().postDataJSON() as Record<string, unknown>;
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ ...mockTransaction, _id: 'created-1', title: postedBody['title'] }),
          });
        } else {
          await route.fallback();
        }
      });

      await page.goto(url);
      await page.getByRole('button', { name: /Neue Buchung/i }).click();
      await expect(page.locator('#title')).toBeVisible();

      // Fill required fields
      await page.locator('#title').fill('Testkauf');
      await page.locator('#amount').click();
      await page.locator('#amount').fill('25');

      const [response] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/transactions') && r.request().method() === 'POST'),
        page.getByRole('button', { name: 'Anlegen' }).click(),
      ]);
      expect(response.status()).toBe(201);

      expect(postedBody).not.toBeNull();
      expect(postedBody!['accountId']).toBe(ACCOUNT_ID);
      // 25 EUR → 2500 Cent
      expect(postedBody!['amountMinor']).toBe(2500);
      expect(postedBody!['title']).toBe('Testkauf');
    });

    test('POSTs bookDate as ISO datetime required by the server', async ({ page, useMocks }) => {
      let postedBody: Record<string, unknown> | null = null;

      await setupRoutes(page, useMocks);
      await page.route('**/api/transactions', async (route) => {
        if (route.request().method() === 'POST') {
          postedBody = route.request().postDataJSON() as Record<string, unknown>;
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ ...mockTransaction, _id: 'created-date', title: 'Datumstest' }),
          });
        } else {
          await route.fallback();
        }
      });

      await page.goto(url);
      await page.getByRole('button', { name: /Neue Buchung/i }).click();
      await expect(page.locator('#title')).toBeVisible();

      await page.locator('#title').fill('Datumstest');
      await page.locator('#amount').click();
      await page.locator('#amount').fill('10');

      const [response] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/transactions') && r.request().method() === 'POST'),
        page.getByRole('button', { name: 'Anlegen' }).click(),
      ]);
      expect(response.status()).toBe(201);

      expect(postedBody).not.toBeNull();
      // Server Zod schema requires ISO datetime format (e.g. 2026-03-01T00:00:00.000Z)
      expect(postedBody!['bookDate']).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
    });

    test('after successful create the editor switches to edit mode for the new transaction', async ({ page, useMocks }) => {
      const newId = 'created-switch';

      await setupRoutes(page, useMocks);
      await page.route('**/api/transactions', async (route) => {
        if (route.request().method() === 'POST') {
          const body = route.request().postDataJSON() as Record<string, unknown>;
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ ...mockTransaction, _id: newId, title: body['title'], amountMinor: body['amountMinor'] }),
          });
        } else {
          await route.fallback();
        }
      });

      await page.goto(url);
      await page.getByRole('button', { name: /Neue Buchung/i }).click();
      await page.locator('#title').fill('Neue Buchung Test');
      await page.locator('#amount').click();
      await page.locator('#amount').fill('15');

      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/transactions') && r.request().method() === 'POST'),
        page.getByRole('button', { name: 'Anlegen' }).click(),
      ]);

      // After creation the editor must switch to "Speichern" (edit mode, not "Anlegen")
      await expect(page.getByRole('button', { name: 'Speichern' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Anlegen' })).not.toBeVisible();
    });
  });

  // ─── PATCH: ID in URL path ─────────────────────────────────────────────────

  test.describe('Editing an existing transaction', () => {
    test('PATCH /api/transactions/:id puts the transaction _id in the URL, not the body', async ({ page, useMocks }) => {
      let patchUrl: string | null = null;
      let patchBody: Record<string, unknown> | null = null;

      await setupRoutes(page, useMocks);
      await page.route(`**/api/transactions/${mockTransaction._id}`, async (route) => {
        if (route.request().method() === 'PATCH') {
          patchUrl = route.request().url();
          patchBody = route.request().postDataJSON() as Record<string, unknown>;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ...mockTransaction, ...(patchBody ?? {}) }),
          });
        } else {
          await route.fallback();
        }
      });

      await page.goto(url);
      await page.getByText(mockTransaction.title).click();

      const titleInput = page.locator('#title');
      await expect(titleInput).toBeVisible();
      await titleInput.clear();
      await titleInput.fill('Neuer Titel');

      const [patchResponse] = await Promise.all([
        page.waitForResponse((r) =>
          r.url().includes(`/api/transactions/${mockTransaction._id}`) && r.request().method() === 'PATCH'
        ),
        page.getByRole('button', { name: 'Speichern' }).click(),
      ]);
      expect(patchResponse.status()).toBe(200);

      expect(patchUrl).toContain(`/api/transactions/${mockTransaction._id}`);
      expect(patchBody!['_id']).toBeUndefined();
      expect(patchBody!['title']).toBe('Neuer Titel');
    });

    test('PATCH body contains only the changed fields', async ({ page, useMocks }) => {
      let patchBody: Record<string, unknown> | null = null;

      await setupRoutes(page, useMocks);
      await page.route(`**/api/transactions/${mockTransaction._id}`, async (route) => {
        if (route.request().method() === 'PATCH') {
          patchBody = route.request().postDataJSON() as Record<string, unknown>;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ...mockTransaction, ...(patchBody ?? {}) }),
          });
        } else {
          await route.fallback();
        }
      });

      await page.goto(url);
      await page.getByText(mockTransaction.title).click();

      const titleInput = page.locator('#title');
      await expect(titleInput).toBeVisible();
      await titleInput.clear();
      await titleInput.fill('Nur Titel geändert');

      const [patchResponse] = await Promise.all([
        page.waitForResponse((r) =>
          r.url().includes(`/api/transactions/${mockTransaction._id}`) && r.request().method() === 'PATCH'
        ),
        page.getByRole('button', { name: 'Speichern' }).click(),
      ]);
      expect(patchResponse.status()).toBe(200);

      expect(patchBody!['title']).toBe('Nur Titel geändert');
      // Unchanged fields must NOT be in the patch body
      expect(patchBody!['amountMinor']).toBeUndefined();
      expect(patchBody!['status']).toBeUndefined();
      expect(patchBody!['_id']).toBeUndefined();
      expect(patchBody!['accountId']).toBeUndefined();
    });
  });

  // ─── Capture dock (separate workflow) ─────────────────────────────────────

  test.describe('Capture dock', () => {
    test('"In Queue" adds a draft that can be finalized', async ({ page, useMocks }) => {
      await setupRoutes(page, useMocks);

      let postFired = false;
      await page.route('**/api/transactions', async (route) => {
        if (route.request().method() === 'POST') {
          postFired = true;
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ ...mockTransaction, _id: 'tx-queue-1', title: 'Queue Test' }),
          });
        } else {
          await route.fallback();
        }
      });

      await page.goto(url);

      // Open dock via collapsed tab
      await page.locator('.capture-dock-tab').getByRole('button', { name: /Capture/i }).click();
      await expect(page.getByText('Quick Add')).toBeVisible();

      await page.locator('#amount-input').click();
      await page.locator('#amount-input').fill('10');
      await page.locator('#title-input').click();
      await page.locator('#title-input').fill('Queue Test');

      await page.getByRole('button', { name: 'In Queue' }).click();

      // Draft appears in queue
      await expect(page.locator('.queue-list').getByText('Queue Test')).toBeVisible();

      // Finalize all
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/transactions') && r.request().method() === 'POST'),
        page.getByRole('button', { name: 'Alle speichern' }).click(),
      ]);

      expect(postFired).toBe(true);
    });

    test('"Direkt speichern" in dock POSTs bookDate in YYYY-MM-DD format', async ({ page, useMocks }) => {
      let capturedBody: Record<string, unknown> | null = null;

      await setupRoutes(page, useMocks);
      await page.route('**/api/transactions', async (route) => {
        if (route.request().method() === 'POST') {
          capturedBody = route.request().postDataJSON() as Record<string, unknown>;
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ ...mockTransaction, _id: 'dock-date-test' }),
          });
        } else {
          await route.fallback();
        }
      });

      await page.goto(url);
      await page.locator('.capture-dock-tab').getByRole('button', { name: /Capture/i }).click();
      await expect(page.getByText('Quick Add')).toBeVisible();

      await page.locator('#amount-input').click();
      await page.locator('#amount-input').fill('42');
      await page.locator('#title-input').click();
      await page.locator('#title-input').fill('Dock Datumstest');

      const [response] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/transactions') && r.request().method() === 'POST'),
        page.getByRole('button', { name: 'Direkt speichern' }).click(),
      ]);
      expect(response.status()).toBe(201);

      expect(capturedBody).not.toBeNull();
      expect(capturedBody!['bookDate']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});

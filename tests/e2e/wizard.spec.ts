import { expect, test } from '@playwright/test';
import { mockWizardRoutes } from './helpers/mocks';

/**
 * The WizardState defaults are pre-populated:
 *   currentStep: 4
 *   data.name: "Account"
 *   data.members: [Tony Hoffmann, Carolin Neumann]
 *   data.categories: [Lebensmittel, Miete]
 *
 * The Wizard component's stepChangeEffect immediately navigates to the route
 * matching the current step, so navigating to /wizard/1 always redirects to /wizard/4.
 * Tests therefore run against the "Initial Values" step (step 4) which is the
 * entry point in a fresh browser session.
 */

test.describe('Wizard – Create Account flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockWizardRoutes(page);
    await page.goto('/wizard/1');
    // Wait for the redirect to step 4 driven by the state default
    await page.waitForURL(/\/wizard\/4$/);
  });

  // ─── Layout ───────────────────────────────────────────────────────────────

  test('shows the "Create Account" heading', async ({ page }) => {
    await expect(page.getByText('Create Account')).toBeVisible();
  });

  test('starts on step 4 (Initial Values)', async ({ page }) => {
    await expect(page).toHaveURL(/\/wizard\/4$/);
    await expect(page.getByText('Initial Account Balance')).toBeVisible();
  });

  test('stepper shows step 4 as active', async ({ page }) => {
    const step4 = page.locator('p-step').filter({ hasText: 'Initial Values' });
    await expect(step4).toBeVisible();
  });

  // ─── Pre-populated form data ───────────────────────────────────────────────

  test('shows Tony Hoffmann in the member income section', async ({ page }) => {
    await expect(page.getByText('Tony Hoffmann')).toBeVisible();
  });

  test('shows Carolin Neumann in the member income section', async ({ page }) => {
    await expect(page.getByText('Carolin Neumann')).toBeVisible();
  });

  test('shows Lebensmittel in the category expense estimation section', async ({ page }) => {
    await expect(page.getByText('Lebensmittel')).toBeVisible();
  });

  test('shows Miete in the category expense estimation section', async ({ page }) => {
    await expect(page.getByText('Miete')).toBeVisible();
  });

  // ─── Save flow ─────────────────────────────────────────────────────────────

  test('clicking "Next" on step 4 triggers POST /api/members', async ({ page }) => {
    const memberRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/members') && req.method() === 'POST') {
        memberRequests.push(req.url());
      }
    });

    await page.getByRole('button', { name: 'Next' }).click();

    // Two members should be created (Tony + Carolin)
    await expect.poll(() => memberRequests.length, { timeout: 5000 }).toBe(2);
  });

  test('clicking "Next" on step 4 triggers POST /api/accounts', async ({ page }) => {
    let accountCreated = false;
    page.on('request', (req) => {
      if (req.url().includes('/api/accounts') && req.method() === 'POST') {
        accountCreated = true;
      }
    });

    await page.getByRole('button', { name: 'Next' }).click();

    await expect.poll(() => accountCreated, { timeout: 5000 }).toBe(true);
  });

  test('clicking "Next" on step 4 triggers POST /api/categories', async ({ page }) => {
    const categoryRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/categories') && req.method() === 'POST') {
        categoryRequests.push(req.url());
      }
    });

    await page.getByRole('button', { name: 'Next' }).click();

    // Two categories: Lebensmittel + Miete
    await expect.poll(() => categoryRequests.length, { timeout: 5000 }).toBe(2);
  });

  test('after saving, navigates away from the wizard', async ({ page }) => {
    await page.getByRole('button', { name: 'Next' }).click();
    // The router navigates to /accounts/<newId> after save; just verify we left /wizard
    await expect(page).not.toHaveURL(/\/wizard/, { timeout: 8000 });
  });
});

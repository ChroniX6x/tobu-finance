import { expect, test, Page } from './helpers/test-fixture';
import { mockWizardRoutes } from './helpers/mocks';

/**
 * The WizardState defaults to step 1 with empty members and categories.
 * The Wizard component's stepChangeEffect navigates to currentStep on init,
 * so /wizard/1 stays at /wizard/1.
 *
 * Save-flow tests navigate through all 4 steps to populate member/category data
 * before triggering the final save on step 4.
 */

/** Navigate through steps 1–3 adding required data, ending at step 4. */
async function navigateToStep4(page: Page): Promise<void> {
  // Step 1: Enter account name
  await page.fill('#account-name', 'Test Account');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.waitForURL(/\/wizard\/2$/);

  // Step 2: Add 2 members (minimum required)
  await page.fill('#name', 'Tony Hoffmann');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('Tony Hoffmann')).toBeVisible();

  await page.fill('#name', 'Carolin Neumann');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('Carolin Neumann')).toBeVisible();

  await page.getByRole('button', { name: 'Next' }).click();
  await page.waitForURL(/\/wizard\/3$/);

  // Step 3: Add 2 categories (minimum required)
  await page.fill('#name', 'Lebensmittel');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('Lebensmittel')).toBeVisible();

  await page.fill('#name', 'Miete');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('Miete')).toBeVisible();

  await page.getByRole('button', { name: 'Next' }).click();
  await page.waitForURL(/\/wizard\/4$/);
}

test.describe('Wizard – Create Account flow', () => {
  test.beforeEach(async ({ page, useMocks }) => {
    await mockWizardRoutes(page, useMocks);
    await page.goto('/wizard/1');
    await page.waitForURL(/\/wizard\/1$/);
  });

  // ─── Layout ───────────────────────────────────────────────────────────────

  test('shows the "Create Account" heading', async ({ page }) => {
    await expect(page.getByText('Create Account')).toBeVisible();
  });

  test('starts on step 1 (Base Information)', async ({ page }) => {
    await expect(page).toHaveURL(/\/wizard\/1$/);
    await expect(page.getByLabel('Account Name')).toBeVisible();
  });

  test('stepper shows step 1 as active', async ({ page }) => {
    const step1 = page.locator('p-step').filter({ hasText: 'Base' });
    await expect(step1).toBeVisible();
  });

  // ─── Step 4 content (reached after navigating through all steps) ──────────

  test('starts on step 4 (Initial Values) after full navigation', async ({ page }) => {
    await navigateToStep4(page);
    await expect(page).toHaveURL(/\/wizard\/4$/);
    await expect(page.getByText('Initial Account Balance')).toBeVisible();
  });

  test('stepper shows step 4 as active after full navigation', async ({ page }) => {
    await navigateToStep4(page);
    const step4 = page.locator('p-step').filter({ hasText: 'Initial Values' });
    await expect(step4).toBeVisible();
  });

  // ─── Step 4 pre-populated form data ───────────────────────────────────────

  test('shows Tony Hoffmann in the member income section', async ({ page }) => {
    await navigateToStep4(page);
    await expect(page.getByText('Tony Hoffmann')).toBeVisible();
  });

  test('shows Carolin Neumann in the member income section', async ({ page }) => {
    await navigateToStep4(page);
    await expect(page.getByText('Carolin Neumann')).toBeVisible();
  });

  test('shows Lebensmittel in the category expense estimation section', async ({ page }) => {
    await navigateToStep4(page);
    await expect(page.getByText('Lebensmittel')).toBeVisible();
  });

  test('shows Miete in the category expense estimation section', async ({ page }) => {
    await navigateToStep4(page);
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

    await navigateToStep4(page);
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

    await navigateToStep4(page);
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

    await navigateToStep4(page);
    await page.getByRole('button', { name: 'Next' }).click();

    // Two categories: Lebensmittel + Miete
    await expect.poll(() => categoryRequests.length, { timeout: 5000 }).toBe(2);
  });

  test('after saving, navigates away from the wizard', async ({ page }) => {
    await navigateToStep4(page);
    await page.getByRole('button', { name: 'Next' }).click();
    // The router navigates to /accounts/<newId> after save; just verify we left /wizard
    await expect(page).not.toHaveURL(/\/wizard/, { timeout: 8000 });
  });
});


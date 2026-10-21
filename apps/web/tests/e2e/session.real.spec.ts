import { expect, test } from '@playwright/test';

// Deliberately no route interception: these checks require a real API and login.
test('restores the real session and loads accounts after a reload', async ({ page }) => {
  const summary = page.waitForResponse(response => response.url().includes('/api/accounts/summary'));
  await page.goto('/accounts');
  expect((await summary).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Deine Konten' })).toBeVisible();

  const refresh = page.waitForResponse(response => response.url().endsWith('/api/auth/refresh'));
  await page.reload();
  expect((await refresh).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Deine Konten' })).toBeVisible();
});

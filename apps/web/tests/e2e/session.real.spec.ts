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

  // Browser sends the refresh cookie automatically to logout through the proxy.
  const cookie = (await page.context().cookies()).find(cookie => cookie.name === 'rt');
  expect(cookie?.path).toBe('/api/auth');
  expect(cookie?.httpOnly).toBe(true);
  const logout = await page.evaluate(async () => (await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })).status);
  expect(logout).toBe(204);
  expect((await page.context().cookies()).filter(cookie => cookie.name === 'rt')).toHaveLength(0);
  const denied = await page.evaluate(async () => (await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })).status);
  expect(denied).toBe(401);
});

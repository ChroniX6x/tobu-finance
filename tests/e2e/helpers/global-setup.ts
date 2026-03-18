import { chromium, type FullConfig } from '@playwright/test';
import fs from 'node:fs';

/**
 * Playwright global setup for the `chromium-real-api` project.
 *
 * Logs in to the real backend and saves the resulting cookies (including the
 * httpOnly refresh-token cookie) to `.playwright-real-auth.json`.
 * The `chromium-real-api` project restores these cookies into every browser
 * context via its `storageState` setting, so `POST /api/auth/refresh` will
 * succeed with the real backend and the app can bootstrap normally.
 *
 * Required environment variables (only for real-api mode):
 *   E2E_EMAIL     — the login e-mail of a test account
 *   E2E_PASSWORD  — the password of that test account
 *
 * Optional:
 *   API_BASE_URL  — defaults to http://localhost:4000
 *
 * If the variables are not set an empty state file is written so that the
 * project can still start; tests will then fail at page load because the
 * auth guard will redirect to /auth/login.
 */

const AUTH_STATE_PATH = '.playwright-real-auth.json';

export default async function globalSetup(_config: FullConfig): Promise<void> {
  const email = process.env['E2E_EMAIL'];
  const password = process.env['E2E_PASSWORD'];

  if (!email || !password) {
    fs.writeFileSync(AUTH_STATE_PATH, JSON.stringify({ cookies: [], origins: [] }));
    console.warn(
      '[global-setup] E2E_EMAIL / E2E_PASSWORD are not set.\n' +
      '              The chromium-real-api project will run without a valid session.\n' +
      '              Set both env vars to enable real-server testing with auth.',
    );
    return;
  }

  const apiBaseUrl = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

  const browser = await chromium.launch();
  const context = await browser.newContext();

  const response = await context.request.post(`${apiBaseUrl}/api/auth/login`, {
    data: { email, password },
  });

  if (!response.ok()) {
    await browser.close();
    throw new Error(
      `[global-setup] Login failed (${response.status()}): ${await response.text()}`,
    );
  }

  // Persist all cookies (the httpOnly refresh-token cookie is included here)
  // and any localStorage the app may have written during the login response.
  await context.storageState({ path: AUTH_STATE_PATH });
  await browser.close();

  console.log(`[global-setup] Real session saved → ${AUTH_STATE_PATH}`);
}

import { request } from '@playwright/test';
import { resolve } from 'node:path';

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
 * Invoked only by the real-api-setup project. Missing configuration fails early.
 */

const AUTH_STATE_PATH = resolve(__dirname, '../../../.playwright-real-auth.json');

export default async function initializeRealAuth(): Promise<void> {
  const email = process.env['E2E_EMAIL'];
  const password = process.env['E2E_PASSWORD'];

  if (!email || !password) {
    throw new Error('Real-API tests require E2E_EMAIL and E2E_PASSWORD for an isolated test user.');
  }

  const apiBaseUrl = process.env['API_BASE_URL'] ?? 'http://localhost:4000';

  const context = await request.newContext();

  try {
  const response = await context.post(`${apiBaseUrl}/api/auth/login`, {
    data: { email, password },
  });

  if (!response.ok()) {
    throw new Error(
      `[global-setup] Login failed (${response.status()}): ${await response.text()}`,
    );
  }

  // Persist all cookies (the httpOnly refresh-token cookie is included here)
  // for the subsequent browser session.
  await context.storageState({ path: AUTH_STATE_PATH });
  } finally {
    await context.dispose();
  }

  console.log(`[global-setup] Real session saved → ${AUTH_STATE_PATH}`);
}

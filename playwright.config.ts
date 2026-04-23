import { defineConfig, devices } from '@playwright/test';

const REAL_AUTH_STATE = '.playwright-real-auth.json';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  globalSetup: './tests/e2e/helpers/global-setup.ts',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-real-api',
      use: {
        ...devices['Desktop Chrome'],
        useMocks: false,
        // Restores the httpOnly refresh-token cookie written by global-setup.
        // The app's APP_INITIALIZER calls POST /api/auth/refresh with
        // withCredentials:true — the restored cookie makes the real backend
        // issue a real access token, so no auth mock is needed.
        storageState: REAL_AUTH_STATE,
      },
    },
  ],
  webServer: {
    command: 'npx ng serve --port 4200 --host 127.0.0.1',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
    timeout: 180000,
  },
});

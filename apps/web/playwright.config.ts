import { defineConfig, devices } from '@playwright/test';
import type { TestOptions } from './tests/e2e/helpers/test-fixture';
import { resolve } from 'node:path';

const webRoot = __dirname;
const REAL_AUTH_STATE = resolve(webRoot, '.playwright-real-auth.json');

export default defineConfig<TestOptions>({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...(process.env['PLAYWRIGHT_CHANNEL'] ? { channel: process.env['PLAYWRIGHT_CHANNEL'] } : {}),
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: ['**/*.real.spec.ts', '**/*.setup.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'real-api-setup',
      testMatch: '**/auth.setup.ts',
    },
    {
      name: 'chromium-real-api',
      testMatch: '**/*.real.spec.ts',
      dependencies: ['real-api-setup'],
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
    command: `"${process.execPath}" "${require.resolve('@angular/cli/bin/ng.js')}" serve --port 4200 --host 127.0.0.1`,
    cwd: webRoot,
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
    timeout: 180000,
  },
});

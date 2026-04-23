import { test as base, expect } from '@playwright/test';
export type { Page } from '@playwright/test';

export type TestOptions = {
  /**
   * When `true` (default), all API calls are intercepted with mock responses.
   *
   * When `false`, only the `api/auth/refresh` endpoint is mocked so the app
   * can bootstrap through the auth guard; every other API call is forwarded to
   * the real server at `API_BASE_URL` (default http://localhost:4000).
   *
   * Switch modes by running a different Playwright project:
   *   npx playwright test                            # mocked (chromium project)
   *   npx playwright test --project=chromium-real-api  # real server
   */
  useMocks: boolean;
};

export const test = base.extend<TestOptions>({
  useMocks: [true, { option: true }],
});

export { expect };

import { test as base, expect } from '@playwright/test';
export type { Page } from '@playwright/test';

export type TestOptions = {
  /**
   * When `true` (default), all API calls are intercepted with mock responses.
   *
   * When `false`, helper mocks are disabled. Real API tests live in *.real.spec.ts
   * and use a real refresh-cookie session, without route interception.
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

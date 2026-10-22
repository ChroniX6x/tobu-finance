import { test as base, expect } from "@playwright/test";
import { assertResponse, findEndpoint } from "@tobu/contracts/endpoints";
import { installMockGuard } from "./mock-guard";
export type { Page } from "@playwright/test";

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
  page: async ({ page, useMocks }, use) => {
    const pending: Promise<void>[] = [];
    const errors: string[] = [];
    // Registered first: specific mocks added by tests take precedence.
    // Fail closed instead of forwarding forgotten mocks to Vite/the real API.
    if (useMocks)
      await installMockGuard(page, (message) => errors.push(message));
    page.on("response", (response) => {
      const request = response.request();
      const path = new URL(response.url()).pathname;
      // Proxy/network failures remain separately tracked; every successful API JSON response is checked.
      if (!response.ok() || !findEndpoint(request.method(), path)) return;
      pending.push(
        (async () => {
          try {
            const body =
              response.status() === 204 ? undefined : await response.json();
            assertResponse(request.method(), path, response.status(), body);
            const endpoint = findEndpoint(request.method(), path)!;
            if (endpoint.body) endpoint.body.parse(request.postDataJSON());
          } catch (error) {
            errors.push(`${request.method()} ${path}: ${String(error)}`);
          }
        })(),
      );
    });
    await use(page);
    await Promise.all(pending);
    expect(errors, "HTTP contract violations (including test mocks)").toEqual(
      [],
    );
  },
});

export { expect };

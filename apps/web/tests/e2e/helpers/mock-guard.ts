import type { Page } from "@playwright/test";

export async function installMockGuard(
  page: Page,
  report: (message: string) => void,
): Promise<void> {
  await page.route("**/api/**", async (route) => {
    report(
      `Unmocked API request: ${route.request().method()} ${new URL(route.request().url()).pathname}`,
    );
    await route.abort("blockedbyclient");
  });
}

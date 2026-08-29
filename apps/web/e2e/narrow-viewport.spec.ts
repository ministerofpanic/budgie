import { test, expect } from "@playwright/test";

const pages = ["/", "/sign-in", "/sign-up"];

for (const path of pages) {
  test(`${path} has no horizontal overflow on a narrow viewport`, async ({ page }) => {
    await page.goto(path);

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
}

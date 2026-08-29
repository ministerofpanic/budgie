import { test, expect, type CDPSession, type Page } from "@playwright/test";

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

const addVirtualAuthenticator = async (page: Page): Promise<CDPSession> => {
  const client = await page.context().newCDPSession(page);
  await client.send("WebAuthn.enable");
  await client.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return client;
};

test("the budget grid and register have no horizontal overflow on a narrow viewport", async ({
  page,
}) => {
  await addVirtualAuthenticator(page);
  const email = `budgie-narrow-${Date.now()}-${crypto.randomUUID()}@example.test`;
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Narrow Viewport");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Create account with a passkey" }).click();
  await expect(page).toHaveURL(/\/account\/passkeys/);

  await page.goto("/budget");
  const budgetOverflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(budgetOverflow.scrollWidth).toBeLessThanOrEqual(budgetOverflow.clientWidth);

  await page.getByRole("link", { name: "Current Account" }).click();
  await expect(page).toHaveURL(/\/accounts\//);
  const registerOverflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(registerOverflow.scrollWidth).toBeLessThanOrEqual(registerOverflow.clientWidth);
});

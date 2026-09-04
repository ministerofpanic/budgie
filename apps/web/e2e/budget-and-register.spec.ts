import { test, expect, type CDPSession, type Page } from "@playwright/test";

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

const signUpFreshUser = async (page: Page, name: string) => {
  await addVirtualAuthenticator(page);
  const email = `budgie-${Date.now()}-${crypto.randomUUID()}@example.test`;
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Create account with a passkey" }).click();
  await expect(page).toHaveURL(/\/account\/passkeys/);
};

test("a full month can be budgeted and spent", async ({ page }) => {
  await signUpFreshUser(page, "Budget User");

  // A brand new account gets a default budget with one account and an
  // Inflow category, created lazily on first visit to the grid.
  await page.goto("/budget");
  await expect(page.getByText("Ready to assign", { exact: true })).toBeVisible();

  await page.getByPlaceholder("New group").fill("Everyday");
  await page.getByRole("button", { name: "Add group" }).click();
  await expect(page.getByText("Everyday")).toBeVisible();

  await page.getByPlaceholder("New category").fill("Groceries");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Groceries")).toBeVisible();

  const groceriesRow = page.locator("p", { hasText: "Groceries" }).locator("..");
  const assignField = groceriesRow.getByRole("textbox").first();
  await assignField.fill("100.00");
  await assignField.blur();
  await expect(page.getByText("£100.00", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Accounts" }).click();
  await page.getByRole("menuitem", { name: "Current Account" }).click();
  await expect(page).toHaveURL(/\/accounts\//);

  await page.getByRole("button", { name: "Add transaction" }).click();
  await page.getByLabel("Payee").fill("Supermarket");
  await page.getByLabel("Outflow").fill("23.50");
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Everyday: Groceries" }).click();
  await page.getByRole("button", { name: "Add transaction" }).click();

  await expect(page.getByText("Supermarket")).toBeVisible();
  await expect(page.getByText("-£23.50").first()).toBeVisible();

  await page.goto("/budget");
  await expect(page.getByText("£76.50", { exact: true })).toBeVisible();
});

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

test("a category target tracks underfunded and on-track state", async ({ page }) => {
  await signUpFreshUser(page, "Target User");

  await page.goto("/budget");
  await page.getByPlaceholder("New group").fill("Everyday");
  await page.getByRole("button", { name: "Add group" }).click();
  await expect(page.getByText("Everyday")).toBeVisible();

  await page.getByPlaceholder("New category").fill("Groceries");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Groceries")).toBeVisible();

  const groceriesRow = page.locator("p", { hasText: "Groceries" }).locator("../..");
  await groceriesRow.getByRole("button").last().click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await groceriesRow.getByPlaceholder("Amount").fill("50.00");
  await groceriesRow.getByRole("button", { name: "Save" }).click();

  await expect(groceriesRow.getByText("£50.00 to go")).toBeVisible();

  const assignField = groceriesRow.getByRole("textbox").first();
  await assignField.fill("50.00");
  await assignField.blur();

  await expect(groceriesRow.getByText(/on track/i)).toBeVisible();

  await groceriesRow.getByRole("button", { name: "Clear" }).click();
  await expect(groceriesRow.getByText(/on track/i)).not.toBeVisible();
});

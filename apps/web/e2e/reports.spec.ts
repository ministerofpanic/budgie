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

test("reports reconcile with the transactions that produced them", async ({ page }) => {
  await signUpFreshUser(page, "Report User");

  await page.goto("/budget");
  await page.getByPlaceholder("New group").fill("Everyday");
  await page.getByRole("button", { name: "Add group" }).click();
  await expect(page.getByText("Everyday")).toBeVisible();

  await page.getByPlaceholder("New category").fill("Groceries");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Groceries")).toBeVisible();

  await page.getByRole("link", { name: "Current Account" }).click();
  await expect(page).toHaveURL(/\/accounts\//);

  await page.getByRole("button", { name: "Add transaction" }).click();
  await page.getByLabel("Payee").fill("Employer");
  await page.getByLabel("Inflow").fill("200.00");
  await page.locator("select").first().selectOption({ label: "Internal: Inflow: Ready to Assign" });
  await page.getByRole("button", { name: "Add transaction" }).click();
  await expect(page.getByText("Employer")).toBeVisible();

  await page.getByRole("button", { name: "Add transaction" }).click();
  await page.getByLabel("Payee").fill("Supermarket");
  await page.getByLabel("Outflow").fill("23.50");
  await page.locator("select").first().selectOption({ label: "Everyday: Groceries" });
  await page.getByRole("button", { name: "Add transaction" }).click();
  await expect(page.getByText("Supermarket")).toBeVisible();

  await page.goto("/reports");

  // Income vs expenditure ties exactly back to the two transactions just
  // entered - a spot-check that a report never drifts from the ledger.
  await expect(page.getByText("£200.00", { exact: true })).toBeVisible();
  await expect(page.getByText("£23.50", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("£176.50", { exact: true })).toBeVisible();

  // Spending by category attributes the whole spend to Groceries.
  const groceriesRow = page.locator("span", { hasText: "Groceries" }).locator("..");
  await expect(groceriesRow.getByText("£23.50")).toBeVisible();

  // Net worth this month is income minus expenditure - the same £176.50.
  await expect(page.getByText("Latest: £176.50")).toBeVisible();
});

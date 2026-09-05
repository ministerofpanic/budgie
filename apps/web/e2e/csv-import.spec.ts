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

const csv =
  "Date,Payee,Memo,Amount\n2026-08-05,Supermarket,weekly shop,-45.23\n2026-08-10,Employer,salary,2500.00\n";

const openImport = async (page: Page) => {
  await page.getByRole("button", { name: "More account actions" }).click();
  await page.getByRole("menuitem", { name: "Import" }).click();
};

const uploadCsv = async (page: Page) => {
  await page.locator('input[type="file"]').setInputFiles({
    name: "statement.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await expect(page.getByText("Date column")).toBeVisible();
  await page.getByLabel("Memo column").selectOption({ label: "Memo" });
  await page.getByLabel("Amount column").selectOption({ label: "Amount" });
};

test("the same CSV imports twice and produces no duplicates", async ({ page }) => {
  await signUpFreshUser(page, "Import User");
  await page.goto("/budget");
  await page.getByRole("button", { name: "Accounts" }).click();
  await page.getByRole("menuitem", { name: "Current Account" }).click();
  await openImport(page);
  await expect(page).toHaveURL(/\/import$/);

  await uploadCsv(page);
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByText("2 to create, 0 duplicates, 0 couldn't be parsed.")).toBeVisible();

  await page.getByRole("button", { name: "Import 2 transactions" }).click();
  await expect(page.getByText("Imported 2 transactions (0 skipped).")).toBeVisible();

  await page.getByRole("link", { name: "Back to register" }).click();
  await expect(page.getByText("Supermarket")).toBeVisible();
  await expect(page.getByText("Employer")).toBeVisible();

  // Re-upload the same file: every row should now be a duplicate.
  await openImport(page);
  await uploadCsv(page);
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByText("0 to create, 2 duplicates, 0 couldn't be parsed.")).toBeVisible();

  const importButton = page.getByRole("button", { name: /^Import \d+ transactions$/ });
  await expect(importButton).toBeDisabled();
});

test("undoing an import batch removes the transactions it created", async ({ page }) => {
  await signUpFreshUser(page, "Undo User");
  await page.goto("/budget");
  await page.getByRole("button", { name: "Accounts" }).click();
  await page.getByRole("menuitem", { name: "Current Account" }).click();
  await openImport(page);

  await uploadCsv(page);
  await page.getByRole("button", { name: "Preview" }).click();
  await page.getByRole("button", { name: "Import 2 transactions" }).click();
  await expect(page.getByText("Imported 2 transactions (0 skipped).")).toBeVisible();

  await expect(page.getByText("statement.csv", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();

  await page.getByRole("link", { name: "Back to register" }).click();
  await expect(page.getByText("No transactions yet.")).toBeVisible();
});

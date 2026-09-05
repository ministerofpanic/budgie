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

// 30 transactions, one per day, each +£10.00, so running balance is
// predictable: row N (1-indexed, oldest first) has balance £(10*N).00.
// Row 15 gets a unique payee so it can be searched for.
const rowCount = 30;
const csvRows = Array.from({ length: rowCount }, (_, i) => {
  const day = String(i + 1).padStart(2, "0");
  const payee = i === 14 ? "UniqueSearchTarget" : "Everyday Payee";
  return `2026-01-${day},${payee},row ${String(i + 1)},10.00`;
});
const csv = `Date,Payee,Memo,Amount\n${csvRows.join("\n")}\n`;

const openImport = async (page: Page) => {
  await page.getByRole("button", { name: "More account actions" }).click();
  await page.getByRole("menuitem", { name: "Import" }).click();
};

test("register pagination and search", async ({ page }) => {
  await signUpFreshUser(page, "Pagination User");
  await page.goto("/budget");
  await page.getByRole("button", { name: "Accounts" }).click();
  await page.getByRole("menuitem", { name: "Current Account" }).click();
  await expect(page).toHaveURL(/\/accounts\//);

  await openImport(page);
  await page.locator('input[type="file"]').setInputFiles({
    name: "statement.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await expect(page.getByText("Date column")).toBeVisible();
  await page.getByLabel("Memo column").selectOption({ label: "Memo" });
  await page.getByLabel("Amount column").selectOption({ label: "Amount" });
  await page.getByRole("button", { name: "Preview" }).click();
  await page.getByRole("button", { name: `Import ${rowCount} transactions` }).click();
  await expect(page.getByText(`Imported ${rowCount} transactions (0 skipped).`)).toBeVisible();
  await page.getByRole("link", { name: "Back to register" }).click();

  // Default page size is 50, so all 30 fit on one page - switch to 25 to
  // force a second page.
  await page.getByRole("combobox").filter({ hasText: "50" }).click();
  await page.getByRole("option", { name: "25", exact: true }).click();
  await expect(page).toHaveURL(/pageSize=25/);
  await expect(page.getByText("Page 1 of 2 (30 transactions)")).toBeVisible();

  // Page 1, newest-first: row 30 (2026-01-30) is the newest transaction, so
  // *its own row* - not just any row on the page - must show balance £300.00.
  await expect(page.getByRole("button").filter({ hasText: "2026-01-30" })).toContainText("£300.00");

  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText("Page 2 of 2 (30 transactions)")).toBeVisible();
  // Page 2 holds the oldest 5 rows - row 1 (2026-01-01) is the very first
  // transaction, so its own row must show balance £10.00.
  await expect(page.getByRole("button").filter({ hasText: "2026-01-01" })).toContainText("£10.00");

  // Search narrows to the one uniquely-named payee, resetting to page 1.
  await page.getByPlaceholder("Search payee, memo, category, amount…").fill("UniqueSearchTarget");
  await page.waitForURL(/q=UniqueSearchTarget/);
  await expect(page.getByText("Page 1 of 1 (1 transaction)")).toBeVisible();
  await expect(page.getByText("UniqueSearchTarget")).toBeVisible();
  await expect(page.getByText("Everyday Payee")).not.toBeVisible();

  // Amount search matches regardless of the shared payee/memo text.
  await page.getByPlaceholder("Search payee, memo, category, amount…").fill("10.00");
  await page.waitForURL(/q=10\.00/);
  await expect(page.getByText("Page 1 of 2 (30 transactions)")).toBeVisible();
});

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

const openImport = async (page: Page) => {
  await page.getByRole("button", { name: "More account actions" }).click();
  await page.getByRole("menuitem", { name: "Import" }).click();
};

const importCsv = async (page: Page, csv: string, rowCount: number) => {
  await openImport(page);
  await page.locator('input[type="file"]').setInputFiles({
    name: `statement-${Date.now()}.csv`,
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
};

test("import auto-categorizes a payee from its history, leaves a new payee uncategorized", async ({
  page,
}) => {
  await addVirtualAuthenticator(page);
  const email = `budgie-repro-autocat-${Date.now()}@example.test`;
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Repro AutoCat");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Create account with a passkey" }).click();
  await expect(page).toHaveURL(/\/account\/passkeys/, { timeout: 15_000 });

  await page.goto("/budget");
  await page.getByPlaceholder("New group").fill("Everyday");
  await page.getByRole("button", { name: "Add group" }).click();
  await page.getByPlaceholder("New category").fill("Groceries");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Groceries")).toBeVisible();

  await page.getByRole("button", { name: "Accounts" }).click();
  await page.getByRole("menuitem", { name: "Current Account" }).click();

  // First import: Supermarket, no history yet - lands uncategorized.
  await importCsv(page, "Date,Payee,Memo,Amount\n2026-08-05,Supermarket,weekly shop,-45.23\n", 1);
  await expect(page.getByText("Uncategorised").first()).toBeVisible();

  // Categorize it by hand, like a real user would.
  await page.getByText("Supermarket").click();
  await page.locator("form").getByRole("combobox").click();
  await page.getByRole("option", { name: "Everyday: Groceries" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator("form")).toHaveCount(0);

  // Second import: another Supermarket row should auto-categorize from
  // that history; a brand-new payee in the same batch should not.
  await importCsv(
    page,
    "Date,Payee,Memo,Amount\n2026-08-12,Supermarket,another shop,-12.00\n2026-08-13,Brand New Payee,first time,-5.00\n",
    2,
  );

  // The register sorts newest-first, so the just-imported (2026-08-12) row
  // isn't necessarily the first/last Supermarket match by simple ordering -
  // the manually categorized 2026-08-05 row would always show "Groceries"
  // regardless of whether auto-categorization works, so match on this row's
  // own unique date (memo isn't shown in the register list) instead of
  // relying on ordering assumptions.
  const supermarketRow = page.getByRole("button").filter({ hasText: "2026-08-12" });
  await expect(supermarketRow).toContainText("Groceries");

  const newPayeeRow = page.getByRole("button").filter({ hasText: "2026-08-13" });
  await expect(newPayeeRow).toContainText("Uncategorised");
});

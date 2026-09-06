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

test("backdated import retreats firstMonth and becomes navigable/categorizable", async ({
  page,
}) => {
  await addVirtualAuthenticator(page);
  const email = `budgie-repro-firstmonth-${Date.now()}@example.test`;
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Repro FirstMonth");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Create account with a passkey" }).click();
  await expect(page).toHaveURL(/\/account\/passkeys/, { timeout: 15_000 });

  await page.goto("/budget");
  await page.getByPlaceholder("New group").fill("Everyday");
  await page.getByRole("button", { name: "Add group" }).click();
  await page.getByPlaceholder("New category").fill("Groceries");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Groceries")).toBeVisible();

  // Previous month should be disabled - fresh budget, nothing before it yet.
  await expect(page.getByRole("button", { name: "Previous month" })).toBeDisabled();

  await page.getByRole("button", { name: "Accounts" }).click();
  await page.getByRole("menuitem", { name: "Current Account" }).click();

  await openImport(page);
  const csv = "Date,Payee,Memo,Amount\n2022-03-15,Supermarket,old shop,-23.50\n";
  await page.locator('input[type="file"]').setInputFiles({
    name: "old-statement.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await expect(page.getByText("Date column")).toBeVisible();
  await page.getByLabel("Memo column").selectOption({ label: "Memo" });
  await page.getByLabel("Amount column").selectOption({ label: "Amount" });
  await page.getByRole("button", { name: "Preview" }).click();
  await page.getByRole("button", { name: "Import 1 transactions" }).click();
  await expect(page.getByText("Imported 1 transactions (0 skipped).")).toBeVisible();

  // Categorize the imported transaction.
  await page.getByRole("link", { name: "Back to register" }).click();
  await page.getByText("Supermarket").click();
  await page.locator("form").getByRole("combobox").click();
  await page.getByRole("option", { name: "Everyday: Groceries" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  // Wait for the edit form to actually close (the save round-trip to
  // complete) before navigating away, rather than racing it.
  await expect(page.locator("form")).toHaveCount(0);

  await page.goto("/budget?month=2022-03");
  await expect(page.getByText("2022-03", { exact: true })).toBeVisible();
  const row = page.locator("p", { hasText: "Groceries" }).locator("../..");
  // No assignment was ever made for March 2022 (the £100 assignment above
  // was for the current month) - a real, un-covered overspend is correct,
  // so both Activity and Available read -£23.50.
  await expect(row.getByText("-£23.50").first()).toBeVisible();
  await expect(row.getByText("-£23.50")).toHaveCount(2);

  // 2022-03 is exactly the retreated firstMonth (the imported transaction's
  // month), so this is now correctly the new boundary - Previous stays
  // disabled here, not because navigation is broken, but because there's
  // genuinely nothing earlier.
  await expect(page.getByRole("button", { name: "Previous month" })).toBeDisabled();

  // Confirm the retreat actually widened things: the month *between* the
  // budget's original creation month and here is now reachable, proving
  // this isn't just the single imported month becoming a new dead end.
  await page.goto("/budget?month=2022-04");
  await expect(page.getByRole("link", { name: "Previous month" })).toBeVisible();
});

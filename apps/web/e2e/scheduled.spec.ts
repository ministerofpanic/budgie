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

const todayIso = (): string => new Date().toISOString().slice(0, 10);

test("a scheduled transaction auto-enters on its due date and advances", async ({ page }) => {
  await signUpFreshUser(page, "Schedule User");

  await page.goto("/budget");
  await page.getByPlaceholder("New group").fill("Everyday");
  await page.getByRole("button", { name: "Add group" }).click();
  await page.getByPlaceholder("New category").fill("Rent");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Rent")).toBeVisible();

  await page.goto("/scheduled");
  await expect(page.getByText("Nothing scheduled yet.")).toBeVisible();

  await page.getByPlaceholder("Payee").fill("Landlord");
  await page.getByLabel("Outflow").fill("900.00");
  await page.locator("select").nth(1).selectOption({ label: "Everyday: Rent" });
  await page.locator("input[type=date]").fill(todayIso());
  await page.getByRole("button", { name: "Add scheduled transaction" }).click();

  await expect(page.getByText("Landlord")).toBeVisible();
  await expect(page.getByText("-£900.00")).toBeVisible();

  // Reloading the page is the auto-entry trigger: the schedule is due today,
  // so it should have entered a real transaction and rolled its next date
  // forward by a month, leaving the schedule itself still present.
  await page.reload();
  await expect(page.getByText("Landlord")).toBeVisible();

  await page.goto("/budget");
  await page.getByRole("button", { name: "Accounts" }).click();
  await page.getByRole("menuitem", { name: "Current Account" }).click();
  await expect(page.getByText("Landlord")).toBeVisible();
  await expect(page.getByText("-£900.00").first()).toBeVisible();
});

test("skipping a scheduled transaction advances it without entering anything", async ({ page }) => {
  await signUpFreshUser(page, "Skip User");

  await page.goto("/budget");
  await page.getByPlaceholder("New group").fill("Everyday");
  await page.getByRole("button", { name: "Add group" }).click();
  await page.getByPlaceholder("New category").fill("Gym");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Gym")).toBeVisible();

  await page.goto("/scheduled");
  await page.getByPlaceholder("Payee").fill("Gym membership");
  await page.getByLabel("Outflow").fill("30.00");
  await page.locator("select").nth(1).selectOption({ label: "Everyday: Gym" });
  const future = new Date();
  future.setUTCDate(future.getUTCDate() + 10);
  await page.locator("input[type=date]").fill(future.toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Add scheduled transaction" }).click();
  await expect(page.getByText("Gym membership")).toBeVisible();

  const originalNextDate = future.toISOString().slice(0, 10);
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByText(originalNextDate)).not.toBeVisible();

  await page.goto("/budget");
  await page.getByRole("button", { name: "Accounts" }).click();
  await page.getByRole("menuitem", { name: "Current Account" }).click();
  await expect(page.getByText("Gym membership")).not.toBeVisible();
});

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

test("reconciling creates an adjustment and locks cleared transactions", async ({ page }) => {
  await signUpFreshUser(page, "Reconcile User");
  await page.goto("/budget");
  await page.getByRole("link", { name: "Current Account" }).click();

  // Add a transaction and mark it cleared.
  await page.getByRole("button", { name: "Add transaction" }).click();
  await page.getByLabel("Payee").fill("Cafe");
  await page.getByLabel("Outflow").fill("10.00");
  await page.getByLabel("Cleared").check();
  await page.getByRole("button", { name: "Add transaction" }).click();
  await expect(page.getByText("Cafe")).toBeVisible();

  // Real-world balance is 5 lower than what's cleared (-10.00): reconcile
  // against -15.00, which should create a -5.00 adjustment.
  await page.getByRole("button", { name: "Reconcile" }).click();
  await page.getByLabel("Real-world balance").fill("-15.00");
  await page.getByRole("button", { name: "Reconcile", exact: true }).click();
  await expect(page.getByText(/Created a -£5\.00 adjustment/)).toBeVisible();

  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("🔒 reconciled").first()).toBeVisible();

  // A reconciled row can no longer be edited. The DAL enforces this
  // server-side too (verified separately) - this checks the UI honours it.
  await page.getByText("Cafe").click();
  await expect(page.getByLabel("Payee")).toHaveCount(0);
});

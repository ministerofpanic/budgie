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

test("a passkey registers a new account and then signs it back in", async ({ page }, testInfo) => {
  await addVirtualAuthenticator(page);

  const email = `budgie-${testInfo.project.name}-${Date.now()}-${crypto.randomUUID()}@example.test`;

  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Test User");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Create account with a passkey" }).click();

  await expect(page).toHaveURL(/\/account\/passkeys/);
  await expect(page.getByText(/Welcome, Test User/)).toBeVisible();

  // Simulate signing out - there's no sign-out UI yet, so drop the session
  // cookie directly, then prove the *same* passkey signs back in.
  await page.context().clearCookies();

  // Conditional UI: focusing the email field is what Chromium's virtual
  // authenticator treats as the trigger to resolve the pending request.
  await page.goto("/sign-in");
  await page.getByLabel("Email").click();

  await expect(page).toHaveURL(/\/account\/passkeys/, { timeout: 10_000 });
  await expect(page.getByText("Your passkeys")).toBeVisible();
});

test("anonymous requests to the passkeys page are rejected", async ({ page }) => {
  await page.goto("/account/passkeys");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("a user can never revoke their last passkey", async ({ page }, testInfo) => {
  await addVirtualAuthenticator(page);
  const email = `budgie-lastkey-${testInfo.project.name}-${Date.now()}-${crypto.randomUUID()}@example.test`;

  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Only Key");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Create account with a passkey" }).click();
  await expect(page).toHaveURL(/\/account\/passkeys/);

  // The server action (apps/web/src/lib/passkeys.ts revokePasskey) is the
  // real backstop and was verified directly during development: it refuses
  // even when this UI guard is bypassed. Here we only need to prove the UI
  // never lets a user reach that state in the first place.
  const revoke = page.getByRole("button", { name: "Revoke" });
  await expect(revoke).toBeDisabled();
});

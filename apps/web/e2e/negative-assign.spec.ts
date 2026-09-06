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

test("negative assignment is rejected, and the field resets across months", async ({ page }) => {
  await addVirtualAuthenticator(page);
  const email = `budgie-repro-negassign-${Date.now()}@example.test`;
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Repro NegAssign");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Create account with a passkey" }).click();
  await expect(page).toHaveURL(/\/account\/passkeys/, { timeout: 15_000 });

  // A fresh budget's firstMonth is the current month, so stay at or after
  // "today" throughout - no fixed past month, to avoid the (deliberate)
  // firstMonth clamp silently redirecting these checks onto the same month.
  await page.goto("/budget");
  await page.getByPlaceholder("New group").fill("Everyday");
  await page.getByRole("button", { name: "Add group" }).click();
  await page.getByPlaceholder("New category").fill("Web Services");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Web Services")).toBeVisible();

  const assignField = page.getByLabel("Assigned for Web Services");

  // Typing a negative amount is rejected with an explanatory error, not
  // silently accepted.
  await assignField.fill("-3000.00");
  await assignField.blur();
  await expect(page.getByText("Can't assign below £0 - reduce it to zero instead")).toBeVisible();
  // The rejected value stays visible so the user can correct it - it just
  // must not have persisted server-side despite being shown.
  await page.reload();
  await expect(page.getByLabel("Assigned for Web Services")).toHaveValue("0.00");

  // A *valid* assignment this month...
  await assignField.fill("50.00");
  await assignField.blur();
  await expect(page.getByText("£50.00").first()).toBeVisible();

  // ...must not leak into next month's field via stale client state (the
  // AssignInput's value used to be seeded once and never reset on
  // navigation, so it kept showing whatever was last typed).
  await page.getByRole("link", { name: "Next month" }).click();
  await expect(page.getByLabel("Assigned for Web Services")).toHaveValue("0.00");

  // ...and going back, this month's real assignment is still there.
  await page.getByRole("link", { name: "Previous month" }).click();
  await expect(page.getByLabel("Assigned for Web Services")).toHaveValue("50.00");
});

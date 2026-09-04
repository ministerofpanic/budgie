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

const createInvite = async (page: Page, role: "editor" | "viewer"): Promise<string> => {
  await page.goto("/sharing");
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: role }).click();
  await page.getByRole("button", { name: "Create invite link" }).click();
  const linkText = await page.getByText(/\/invite\//).textContent();
  const match = linkText?.match(/\/invite\/([\w-]+)/);
  if (!match) throw new Error("Invite link not found on page");
  return match[1]!;
};

test("an editor can mutate the shared budget but cannot manage members", async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  await signUpFreshUser(ownerPage, "Owner User");
  await ownerPage.goto("/budget");
  const token = await createInvite(ownerPage, "editor");

  const editorContext = await browser.newContext();
  const editorPage = await editorContext.newPage();
  await signUpFreshUser(editorPage, "Editor User");
  await editorPage.goto(`/invite/${token}`);
  await expect(editorPage).toHaveURL(/\/budget/);

  await editorPage.getByPlaceholder("New group").fill("Everyday");
  await editorPage.getByRole("button", { name: "Add group" }).click();
  await expect(editorPage.getByText("Everyday")).toBeVisible();

  await editorPage.goto("/sharing");
  await expect(editorPage.getByText("Owner User")).toBeVisible();
  await expect(editorPage.getByRole("button", { name: "Remove" })).toHaveCount(0);
  await expect(editorPage.getByRole("button", { name: "Create invite link" })).toHaveCount(0);

  await ownerContext.close();
  await editorContext.close();
});

test("a viewer cannot mutate the shared budget", async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  await signUpFreshUser(ownerPage, "Owner User");
  await ownerPage.goto("/budget");
  const token = await createInvite(ownerPage, "viewer");

  const viewerContext = await browser.newContext();
  const viewerPage = await viewerContext.newPage();
  await signUpFreshUser(viewerPage, "Viewer User");
  await viewerPage.goto(`/invite/${token}`);
  await expect(viewerPage).toHaveURL(/\/budget/);

  await viewerPage.getByPlaceholder("New group").fill("ShouldNotExist");
  await viewerPage.getByRole("button", { name: "Add group" }).click();

  await viewerPage.goto("/budget");
  await expect(viewerPage.getByText("ShouldNotExist")).not.toBeVisible();

  await ownerContext.close();
  await viewerContext.close();
});

test("a non-member never sees another user's budget", async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  await signUpFreshUser(ownerPage, "Private Owner");
  await ownerPage.goto("/budget");
  await ownerPage.getByPlaceholder("New group").fill("OwnerOnlyGroup");
  await ownerPage.getByRole("button", { name: "Add group" }).click();
  await expect(ownerPage.getByText("OwnerOnlyGroup")).toBeVisible();

  const strangerContext = await browser.newContext();
  const strangerPage = await strangerContext.newPage();
  await signUpFreshUser(strangerPage, "Unrelated Stranger");
  await strangerPage.goto("/budget");
  await expect(strangerPage.getByText("OwnerOnlyGroup")).not.toBeVisible();

  await ownerContext.close();
  await strangerContext.close();
});

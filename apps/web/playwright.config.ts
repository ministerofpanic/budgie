import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    // Not the dev server: React Strict Mode double-invokes effects there,
    // which fires the conditional sign-in's WebAuthn request twice and
    // corrupts the single-challenge cookie the passkey plugin keeps.
    command: "pnpm build && pnpm start",
    url: process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000",
    reuseExistingServer: !process.env["CI"],
    timeout: 60_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // A narrow, real-phone viewport, but still Chromium: WebAuthn's virtual
    // authenticator is only available over Chromium's CDP.
    {
      name: "mobile-narrow",
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 667 } },
    },
  ],
});

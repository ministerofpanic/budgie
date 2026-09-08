# Budgie 🐦

**Budgeting you actually own.**

Budgie is a self-hosted, zero-based budgeting app: give every pound a job
before you spend it, share a budget with the people you live your life with,
and keep your financial data on infrastructure you control - not a
subscription to a cloud service that can change its terms, get acquired, or
disappear.

## Features

- **Zero-based budgeting.** Assign every pound to a category before you
  spend it, with automatic rollover and proper credit-card handling
  (spending on a card moves budgeted money into its payment category,
  the way it should work).
- **Real bank sync.** Connect UK/EU bank accounts via Open Banking and pull
  transactions in automatically - no manual entry required.
- **Multi-currency accounts.** Hold accounts in a different currency to your
  budget's home currency, with exchange rates fetched and editable per
  transaction.
- **Works offline.** Installable as an app on your phone or desktop, keeps
  working with no connection, and syncs safely once you're back online -
  including detecting when someone else changed something while you were
  offline, rather than silently overwriting it.
- **Passkey sign-in.** No passwords to leak, ever. Falls back to a magic
  link by email for devices that don't support passkeys.
- **Shared budgets.** Invite the people you budget with, with owner/editor/
  viewer roles.
- **Your data is never locked in.** Import and export via CSV at any time.
- **Reports that matter.** Spending by category, income vs. expenditure,
  net worth over time, and Age of Money - a real measure of financial
  cushion, not just a balance.

No payment wall, anywhere in the product.

## Getting started

You'll need a Postgres database - [Neon](https://neon.tech) has a free tier
that works well.

```sh
pnpm install
cp .env.example .env
# fill in DATABASE_URL and BETTER_AUTH_SECRET in .env
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and sign up with a
passkey. Bank sync (GoCardless) and magic-link email (Resend) are optional -
the app runs fully without them, you'll just be limited to passkey sign-in
and manual/CSV transaction entry until you add those keys.

## Deploying

Runs on [Netlify](https://netlify.com)'s free tier. Set the package
directory to `apps/web` with the base directory at the repo root; see
`.env.example` for the environment variables to set.

## Development

See `CLAUDE.md` for the project's technical conventions, architecture
decisions, and workflow if you're contributing or poking around the code.

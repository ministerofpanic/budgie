# Budgie - working notes for Claude

Self-hosted YNAB clone. Zero-based budgeting, shared between people, passkey
sign-in, no payment or subscription features anywhere in the product.

## Workflow

- **WIP limit 1.** One item from `ACTIVE.md` at a time. Scope it fully before
  writing code.
- **Done means done.** Implemented, tested, `pnpm lint && pnpm format:check &&
pnpm typecheck && pnpm test && pnpm build` all green, and checked against the
  real dependency (live Neon, live deploy) where one is involved.
- **Rigor-verification.** After writing a test that asserts subtle behaviour,
  break the implementation deliberately, confirm the test fails for the right
  reason, then restore it.
- **Introspect before coding.** Query the live database / read the real API
  response. Do not code against what a doc claims.
- When an item is finished, move it out of `ACTIVE.md` and pull the next one
  from `BACKLOG.md`.

## Conventions

- **Money is integer pence.** Never floats. All parsing, formatting and
  splitting goes through `@budgie/core/money`. `Pence` is a branded type - a
  raw `number` will not type-check.
- **Errors are values.** `Result<T, E>` from `@budgie/core/result` for anything
  a user can cause. Throw only for programmer error (see `allocate`).
- `type` over `interface`, always. Composition over inheritance. No classes.
- Strict TypeScript, including `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`. Both bite; they are on deliberately.
- **Exact version pins only.** Every third-party version lives once, in the
  `catalog:` block of `pnpm-workspace.yaml`. Packages reference `"catalog:"`.
  Never write a `^` or `~` range.
- `minimumReleaseAge: 7200` holds new releases for ~5 days. If an install is
  refused because a version is too new, pin the newest one that clears the
  window - do not add it to `minimumReleaseAgeExclude`.
- oxlint and oxfmt, never ESLint or Prettier. Prefer oxc/voidzero tooling
  generally (Vite, Vitest, Rolldown, tsdown) over equivalents from other
  toolchains.
- pnpm only.

## Layout

| Path              | What                                                   |
| ----------------- | ------------------------------------------------------ |
| `apps/web`        | Next.js App Router app - the only deployable           |
| `packages/core`   | Result + money primitives, pure and dependency-free    |
| `packages/db`     | Drizzle schema and client                              |
| `packages/budget` | pure budget engine (Ready to Assign, rollover), no I/O |

Internal packages are consumed as TypeScript source (no build step), so
`apps/web/next.config.ts` lists them in `transpilePackages`. Add new ones there.

## Decisions already made

- **Turborepo monorepo**, single Netlify deployable.
- **Credit cards are in v1**, with YNAB's payment-category behaviour: spending
  on a credit card moves budgeted money into that card's payment category.
- **Hand-rolled `Result`**, no `neverthrow`.
- **Passkeys first, magic link as the fallback.** Better Auth + its passkey
  plugin, Drizzle adapter. No passwords. Sign-up and sign-in always also
  offer "Email me a link instead" (Better Auth's `magic-link` plugin, sent
  via Resend) for devices/browsers without WebAuthn support - some Android
  in-app browsers included. Passkeys stay the recommended path and the
  sign-up flow still pushes for a second one for recovery; a magic-link
  account can add a passkey later from `/account/passkeys` if the device
  it's next opened on supports one.
- **Domain: `budgie.mikeholloway.co.uk`.** Passkeys bind to the relying party
  ID, so `PASSKEY_RP_ID` is `localhost` in dev and `budgie.mikeholloway.co.uk`
  in production. Passkeys registered on a `*.netlify.app` preview will not work
  on the real domain, and vice versa.
- **One home currency per budget**, GBP default, used for categories, Ready
  to Assign, and reporting. Individual **accounts** may hold a different
  currency - the budget engine only ever sees home-currency amounts
  (conversion happens at the DAL boundary, in `loadBudgetInput`); the
  register and account balances always show native currency. Exchange
  rates are fetched from Frankfurter.app (free, keyless) and stored per
  transaction, always user-editable.
- **Shared budgets** via `budget_member` with owner / editor / viewer roles.
  Every query is scoped by membership in the data-access layer, never in page
  code.
- **PWA with offline browsing**, scoped to the budget grid and account
  register. `apps/web/src/app/sw.ts` (Serwist) caches the app shell;
  `apps/web/src/lib/offline/` mirrors the whole budget into IndexedDB
  (`idb`) whenever online and swaps in a client-rendered offline view
  (`components/offline/`, driven by `OfflineGate` in the app layout) when
  the browser goes offline, using the same `@budgie/budget` engine
  functions the server uses. Offline edits queue in an outbox and replay
  on reconnect via the existing Server Actions; `updateTransaction`,
  `deleteTransactionWithConflictCheck`, and `setAssigned` carry an
  optional `expectedUpdatedAt` optimistic-concurrency guard for this path
  (a normal online single-device save omits it and is unaffected). A
  conflicted replay surfaces in a "Resolve conflicts" banner rather than
  silently overwriting someone else's edit. Reports, Scheduled, Sharing,
  CSV import, and bank linking are deliberately online-only for now.
  Production builds run webpack (`next build --webpack`), since Serwist's
  webpack plugin doesn't yet support Turbopack; dev still uses Turbopack
  (`disable` is set accordingly in `next.config.ts`).

## Environment

Copy `.env.example` to `.env`. Neon pooled connection string, Better Auth
secret, and the passkey relying-party settings.

**CI uses a dedicated Neon branch** (`ci`, off the `budgie-us` project's
`main` branch), not production - the `DATABASE_URL` GitHub Actions secret
points at it. e2e tests create real, permanent rows, so this keeps that
data out of production. Re-run migrations against the `ci` branch
(`DATABASE_URL=<ci-branch-url> pnpm db:migrate` from `packages/db`) after
adding a new migration, same as any other branch.

## Notes from the scaffold session

- TypeScript is 7.x, the native compiler. Fast, and no issues with Next 16.
- shadcn components were hand-written to match new-york v4 because the
  scaffolding environment could not reach `ui.shadcn.com`. Locally, use
  `pnpm dlx shadcn add <component> --cwd apps/web` as normal.
- Narrow-viewport rendering has not been verified yet - headless Chrome clamped
  the window width. Check it properly once Playwright is in (phase 03).

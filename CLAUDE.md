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
- **Passkeys only.** Better Auth + its passkey plugin, Drizzle adapter. No
  passwords, no email fallback. Recovery is "register a second passkey", so the
  sign-up flow must push for that.
- **Domain: `budgie.mikeholloway.co.uk`.** Passkeys bind to the relying party
  ID, so `PASSKEY_RP_ID` is `localhost` in dev and `budgie.mikeholloway.co.uk`
  in production. Passkeys registered on a `*.netlify.app` preview will not work
  on the real domain, and vice versa.
- **Single currency per budget**, GBP default. No multi-currency.
- **Shared budgets** via `budget_member` with owner / editor / viewer roles.
  Every query is scoped by membership in the data-access layer, never in page
  code.

## Environment

Copy `.env.example` to `.env`. Neon pooled connection string, Better Auth
secret, and the passkey relying-party settings.

## Notes from the scaffold session

- TypeScript is 7.x, the native compiler. Fast, and no issues with Next 16.
- shadcn components were hand-written to match new-york v4 because the
  scaffolding environment could not reach `ui.shadcn.com`. Locally, use
  `pnpm dlx shadcn add <component> --cwd apps/web` as normal.
- Narrow-viewport rendering has not been verified yet - headless Chrome clamped
  the window width. Check it properly once Playwright is in (phase 03).

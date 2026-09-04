# Budgie

Budgeting you actually own. A self-hosted YNAB-style budget: zero-based,
shared between people, passkey sign-in, no payment wall anywhere.

## Layout

| Path            | What it is                                               |
| --------------- | -------------------------------------------------------- |
| `apps/web`      | Next.js app (App Router), the only deployable            |
| `packages/core` | Result type and money primitives - pure, dependency-free |

## Getting started

```sh
pnpm install
cp .env.example .env
pnpm dev
```

## Commands

| Command          | Does                                          |
| ---------------- | --------------------------------------------- |
| `pnpm dev`       | Next dev server                               |
| `pnpm build`     | Turbo build across the workspace              |
| `pnpm typecheck` | `tsc --noEmit` per package                    |
| `pnpm test`      | Vitest per package                            |
| `pnpm lint`      | oxlint                                        |
| `pnpm format`    | oxfmt (write) / `pnpm format:check` to verify |

## Conventions

- **Money is integer pence.** Never floats. `@budgie/core/money` is the only
  place amounts are parsed, formatted, or split.
- **Errors are values.** `Result<T, E>` from `@budgie/core/result`, not throws,
  for anything a user can cause.
- **Types over interfaces**, composition over inheritance, no classes.
- **Exact version pins only.** Third-party versions live in the `catalog:` block
  in `pnpm-workspace.yaml`, so a version appears once in the whole repo.
- **Supply chain:** `minimumReleaseAge` holds new releases for ~5 days before
  they can be installed.

## Deploying

Netlify, from git. Set the package directory to `apps/web`; the base directory
stays at the repo root so pnpm workspaces resolve. `apps/web/netlify.toml`
carries the build command and publish directory. The Next.js adapter is
deliberately unpinned - Netlify tracks it per build.

Environment variables required in Netlify: see `.env.example`.

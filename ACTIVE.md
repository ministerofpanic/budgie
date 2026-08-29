# Active

One item at a time. Finish it completely before pulling the next from `BACKLOG.md`.

---

## Phase 02 - Schema and migrations on Neon

**Goal:** the full data model exists in Drizzle, migrations apply cleanly to a
real Neon database, and the live schema is verified by introspection rather than
assumed.

**Prerequisite:** a Neon project on the free tier and its pooled connection
string in `.env` as `DATABASE_URL`.

### Steps

1. Create `packages/db` (`@budgie/db`), add it to `transpilePackages` in
   `apps/web/next.config.ts`. Pin `drizzle-orm`, `drizzle-kit` and
   `@neondatabase/serverless` into the catalog in `pnpm-workspace.yaml`.
2. Client: `drizzle-orm/neon-http` over the pooled connection string. Fail loudly
   at startup if `DATABASE_URL` is missing.
3. Schema, in `packages/db/src/schema/`:
   - Better Auth's tables (`user`, `session`, `account`, `verification`,
     `passkey`) - generate these with the Better Auth CLI in phase 03 rather than
     hand-writing them, so leave a gap here.
   - `budget` - name, currency (default `GBP`), first month, timestamps.
   - `budget_member` - budget, user, role (`owner` / `editor` / `viewer`),
     unique on (budget, user).
   - `budget_invite` - budget, token hash, role, expiry, created by, accepted at.
   - `account` - budget, name, type (`current` / `savings` / `cash` / `credit` /
     `tracking`), on-budget flag, closed flag, sort order.
   - `category_group` and `category` - budget, name, sort order, hidden flag.
     One system group holds the internal categories (credit card payments,
     inflow).
   - `category_month` - category, month (first of month as a date), assigned
     pence. Unique on (category, month). **Only the assigned amount is stored.**
     Activity and available are always derived.
   - `payee` - budget, name, unique per budget. A transfer payee points at an
     account.
   - `transaction` - budget, account, date, payee, category (null when split),
     amount pence, memo, cleared, reconciled, transfer pair id, import hash,
     scheduled-transaction origin.
   - `transaction_split` - parent transaction, category, amount pence, memo.
   - `target` - category, type (`monthly` / `by-date` / `refill` / `spending`),
     amount pence, due date, cadence.
   - `scheduled_transaction` - the transaction template plus frequency, next
     date, last entered date.
   - `import_batch` - budget, account, filename, imported at, row count, so an
     import can be undone wholesale.
4. Money columns: `integer` pence, `not null`. No numerics, no floats.
5. Indexes: every foreign key; `(budget_id, date)` on transaction;
   `(category_id, month)` on category_month; a unique partial index on
   `(account_id, import_hash)` so re-importing the same CSV cannot duplicate.
6. Generate the migration with drizzle-kit, commit the SQL, apply it to Neon.
7. **Verify by introspection:** pull the live schema back and diff it against the
   Drizzle definitions. Check the constraints and indexes actually landed, not
   just the tables.
8. Seed script (`packages/db/src/seed.ts`) producing one budget with a realistic
   UK category set, two accounts and a month of transactions, for developing the
   UI against.

### Done when

- `pnpm drizzle-kit generate` produces no pending diff against the live database.
- The seed script runs twice without violating a constraint.
- `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`
  are all green.

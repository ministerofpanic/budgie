# Backlog

Ordered. Pull the top item into `ACTIVE.md` when the current one is finished.

---

## Phase 07 - Targets, reports, scheduled transactions

- Target types: monthly, by-date, refill up to, spending cap. Progress and
  "underfunded this month" surfaced on the budget grid.
- Reports: spending by category over a period, income vs expenditure, net worth
  over time. Figures must reconcile exactly against the ledger.
- Scheduled transactions: frequency rules, upcoming list, auto-entry on the due
  date, skip and edit-this-occurrence.

**Done when** a scheduled transaction enters itself on its due date and every
report ties back to the transactions it claims to summarise.

---

## Phase 08 - Sharing, deploy, hardening

- Invite by single-use link, accept flow, member list, role changes, removal.
- Permission checks proven by tests: a viewer cannot mutate, an editor cannot
  remove members, a non-member sees nothing.
- Netlify: connect the repo, package directory `apps/web`, base directory the
  repo root, env vars set, custom domain `budgie.mikeholloway.co.uk` with DNS.
- Live verification: two accounts sharing one budget on the real domain, neither
  able to see the other's separate budgets.

---

## Later, not v1

- Open Banking / bank feeds (TrueLayer or similar) instead of CSV.
- Multi-currency.
- Age of Money, or an equivalent honest metric.
- Export to YNAB-compatible CSV.
- PWA offline entry with sync on reconnect.

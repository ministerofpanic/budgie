# Backlog

Ordered. Pull the top item into `ACTIVE.md` when the current one is finished.

---

## Phase 05 - Budget and register UI

- Monthly budget grid: group / category / assigned / activity / available, month
  navigation, inline assign with keyboard entry.
- Ready to Assign header that is honest about being negative.
- Account register: date, payee, category, memo, outflow, inflow, cleared,
  running balance. Inline edit, multi-select, split transactions.
- Category and group management: create, rename, reorder, hide, delete with
  reassignment.
- Mobile first. The budget grid and the register both have to be usable on a
  phone with no mouse - that is the point of the whole thing.

**Done when** a full month can be budgeted and spent on a phone.

---

## Phase 06 - CSV import and reconcile

- Upload, sniff delimiter and date format, map columns, remember the mapping per
  account for next time.
- Duplicate detection by import hash (date + amount + payee + account) with the
  unique partial index as the backstop.
- Preview screen showing what will be created, what looks like a duplicate, and
  what could not be parsed. Commit or discard as a batch; undo a whole batch.
- Reconciliation: enter the real-world balance, tick off cleared transactions,
  create an adjustment transaction for any difference, lock reconciled rows.

**Done when** the same real bank CSV imports twice and produces no duplicates.

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

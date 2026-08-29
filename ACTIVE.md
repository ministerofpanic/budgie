# Active

One item at a time. Finish it completely before pulling the next from `BACKLOG.md`.

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

# Active

One item at a time. Finish it completely before pulling the next from `BACKLOG.md`.

---

## Phase 04 - Budget engine

`packages/budget`, pure functions over plain data. No DB imports, no classes.

- Ready to Assign = inflows to on-budget accounts up to and including this month,
  minus everything assigned up to and including this month, minus last month's
  cash overspending.
- Available per category = assigned + activity + carried-in balance. Positive
  balances roll forward. Negative _cash_ balances do not - they reduce next
  month's Ready to Assign.
- Credit cards: spending on a credit account moves that amount from the spending
  category into the card's payment category. Overspending on a credit card
  behaves differently from cash overspending - the debt increases and the payment
  category goes negative. Get this right; it is the fiddliest rule in the product.
- Transfers between on-budget accounts are neither income nor spending.
- Any month must be computable from the start of the budget without stored
  snapshots.
- Rigor-verification on every rule: break it, watch the test fail correctly,
  restore it.

**Done when** the rule set passes its tests, including a multi-month scenario
with overspend, rollover, credit card spending and a payment.

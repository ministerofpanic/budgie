# Active

One item at a time. Finish it completely before pulling the next from `BACKLOG.md`.

---

## Phase 08 - Sharing, deploy, hardening

- Invite by single-use link, accept flow, member list, role changes, removal.
- Permission checks proven by tests: a viewer cannot mutate, an editor cannot
  remove members, a non-member sees nothing.
- Netlify: connect the repo, package directory `apps/web`, base directory the
  repo root, env vars set, custom domain `budgie.mikeholloway.co.uk` with DNS.
- Live verification: two accounts sharing one budget on the real domain, neither
  able to see the other's separate budgets.

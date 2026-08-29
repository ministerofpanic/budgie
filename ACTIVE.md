# Active

One item at a time. Finish it completely before pulling the next from `BACKLOG.md`.

---

## Phase 03 - Passkey auth

Better Auth with the passkey plugin and the Drizzle adapter.

- Generate Better Auth's tables with its own CLI; do not hand-write them.
- Server config: `rpID` and `rpName` from env, `origin` from `NEXT_PUBLIC_APP_URL`.
- Sign-up: create user, register first passkey, then immediately prompt to add a
  second one. Losing the only passkey means losing the account.
- Sign-in with conditional UI (`autocomplete="username webauthn"`, `autoFill: true`).
- Passkey management: list, name by device, rename, revoke. Never let a user
  revoke their last passkey.
- Route protection in the data-access layer, not in page components.
- Add Playwright, drive registration and sign-in with its virtual authenticator
  (CDP `WebAuthn.addVirtualAuthenticator`).
- **Also here:** verify narrow-viewport rendering properly with Playwright device
  emulation - it was never confirmed during the scaffold.

**Done when** a passkey registers and signs in end-to-end in CI, and anonymous
requests to protected routes are rejected.

# ADR 0011 — Staging mirrors production behind one shared password

**Status:** Accepted · 2026-11-18
**Related:** [0008](0008-staging-runs-its-own-assets-apis-and-real-integrations.md), [0010](0010-production-updates-use-an-approved-github-app-token.md)

## Context

ADR 0008 gated staging writes behind an emailed six-digit code for allowlisted testers, and gave
the hunt on staging its own promo ID and coupon prefix. Neither was ever configured: Preview had no
tester list and no staging promo, so staging sign-in and the hunt did not work at all. Only
developers use staging, and its purpose is to exercise the same build and the same integrations
that production will run before the promote workflow (ADR 0010) moves it live.

## Decision

1. **One shared password gates staging.** `rrhs-staging-access.js` shows a modal on every staging
   tab without a current session. `api/v1/staging-auth.js` exchanges `RRHS_STAGING_PASSWORD` for
   an eight-hour session signed with `RRHS_STAGING_SESSION_SECRET` and the password, so changing
   either ends every session. Wrong passwords are delayed. Both values exist only in Vercel
   Preview; the password never appears in source.
2. **Server checks are unchanged in shape.** `requirePreviewAccess()` in
   `api/_lib/staging-auth.cjs` still guards every Preview write; only the way a session is issued
   changed. Production does not use it.
3. **Staging mirrors production's hunt configuration.** The Production variables
   `RRHS_HUNT_DATABASE_URL`, `RRHS_HUNT_SECRET`, `RRHS_HUNT_RELAY_SECRET` and
   `RRHS_HUNT_PROMO_ID` have Preview added as a target, so both deployments use identical
   values. There is no separate staging promo and no test coupon prefix.
4. **The hunt switch stays per deployment.** Preview has its own `RRHS_HUNT_ENABLED=true`;
   Production's stays `false` until launch.
5. Everything else in ADR 0008 still holds: staging loads its own assets and APIs, never falls
   back to production, rewrites only allowlisted iframes, and exposes
   `RRHS_DEPLOYMENT.snapshot()`.

## Consequences

- A staging claim is a real claim: it uses the production promotion, creates a real single-use
  coupon, sends the real email, and counts against the same hunt totals. Nothing marks it as a
  test. Automated tests still never claim, email or create coupons.
- Anyone with the password can use staging writes against the live store. The password must stay
  with developers, and should be changed when someone leaves.
- A shared password has no per-person audit trail, unlike the emailed code.
- `/api/v1/environment` reports `stagingAccess` from the password and session secret.

## Alternatives considered

- **Keep ADR 0008's emailed code for allowlisted testers.** Rejected by the owner: more setup than
  a developer-only staging needs, and it was never configured.
- **No gate at all.** Rejected: staging tabs can create real coupons and orders, and the staging
  URL is public.
- **A separate staging promo and code prefix.** Dropped so staging behaves exactly like
  production; the trade-off is that test claims are indistinguishable from real ones.
- **Deleting the hunt variables.** Considered and rejected: the hunt cannot run anywhere without
  its database and promo ID.

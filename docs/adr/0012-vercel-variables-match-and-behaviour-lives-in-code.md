# ADR 0012 — Vercel variables match in every environment; behaviour lives in code

**Status:** Accepted · 2026-11-18
**Related:** [0010](0010-production-updates-use-an-approved-github-app-token.md), [0011](0011-staging-mirrors-production-behind-one-shared-password.md)

## Context

ADR 0011 left the hunt's on/off switch as a per-environment Vercel variable
(`RRHS_HUNT_ENABLED`, `true` in Preview and `false` in Production), and a Preview-only
`RRHS_HUNT_EXPIRES_AT` was added to reopen the hunt on staging. Some variables were Preview-only,
and one key existed as two separate entries. Promoting a tested `main` therefore did not reproduce
what was tested: production's behaviour depended on variables the promote never touches. The
owner wants staging and production to differ only in the code they run, so the promote workflow
is the single way behaviour reaches production.

## Decision

1. **Every Vercel variable is one entry targeting both Production and Preview, with one value.**
   No Preview-only or Production-only variables, no per-branch variables, no duplicate entries.
   A variable that production does not use (such as `RRHS_STAGING_PASSWORD`) is still present
   there and ignored.
2. **Behaviour that should change between releases lives in code.** The hunt's `enabled`,
   `startsAt` and `expiresAt` are in `easter-hunt/config.js`. `RRHS_HUNT_ENABLED`,
   `RRHS_HUNT_STARTS_AT` and `RRHS_HUNT_EXPIRES_AT` were removed from Vercel and from the code.
   Merging to `main` changes staging; promoting changes production.
3. **Vercel holds only secrets and identifiers**: credentials, URLs, the promo ID and similar.
4. `ops/scripts/vercel-env-parity.mjs` (`npm run check:vercel-env`) reads keys and targets
   through the logged-in Vercel CLI, never values, and fails on any variable that breaks rule 1.
   It needs Vercel credentials, so it runs locally after any variable change, not in CI.
5. The environment itself is still detected at runtime (`api/_lib/deployment.cjs`), so code can
   behave differently on staging, such as the password gate, without a variable.
6. ADR 0011 stays in force except its point 4, which this replaces.

## Consequences

- What staging runs is what production will run after a promote, including whether the hunt is
  open and until when. Turning the hunt on in `main` means the next promote turns it on for every
  shopper.
- Turning the hunt off quickly now needs a commit, a merge and a promote, instead of a variable
  change and redeploy.
- Tests vary the hunt config in memory through `tools/hunt-config-override.cjs`.
- Production deployments carry staging-only secrets they never read.

## Alternatives considered

- **Keep per-environment switches in Vercel (ADR 0011 point 4).** Rejected: production's behaviour
  would not be what staging tested.
- **Separate Preview values for secrets.** Rejected with ADR 0011; staging mirrors production.
- **Run the parity check in CI.** Not possible without putting a Vercel token in GitHub Actions;
  deferred.

# ADR 0007 — The dragon hunt runs as an automatic staging-only preview

**Status:** Superseded by 0008 · 2026-11-17
**Related:** [0001](0001-staging-is-a-per-tab-mode-on-the-live-store.md), [0002](0002-staging-tabs-load-staging-scripts-and-call-production-apis.md), [0003](0003-main-is-staging-and-a-workflow-promotes-to-production.md)

## Context

The dragon hunt had a browser development mode controlled by `?hunt-dev=on` and the public
`rrhsHunt.dev()` and `rrhsHunt.reset()` console helpers. That made the preview easy to change from
any storefront tab, including production. The current hunt work needs to remain visible for review
in staging while the rest of `main` is promoted to production.

ADR 0003 promotes all of `main` at once. Holding hunt commits on a separate branch would make every
later promotion a manual commit-selection exercise and would leave staging behind after a promote.

## Decision

1. `easter-hunt/boot.js` starts the hunt only when it is loaded from
   `https://rrhscoop-staging.vercel.app` in a tab that ADR 0001 marked as staging. Production does
   not start the hunt, regardless of its query string or the production API switch.
2. Staging starts the preview automatically. There is no public console helper, URL switch, reset
   button or off button.
3. Preview claims use `sessionStorage`, return fake codes and create no coupon. Closing the staging
   tab clears the preview state.
4. Production-hosted iframe embeds accept the preview state only from their staging parent tab, so
   the hunt can cover iframe content without enabling it in an ordinary production tab.
5. The code is promoted normally with the rest of `main`; the environment gate, rather than a
   divergent release branch, keeps the visible hunt on staging.

## Consequences

- The staging storefront shows the hunt without setup. The production storefront does not.
- The old `?hunt-dev` parameter and `rrhsHunt` console API do nothing because they no longer exist.
- Browser code cannot be made tamper-proof against someone who deliberately rewrites a page in
  DevTools. Server-side claim rules remain the authority, fake preview codes never work at checkout,
  and the supported controls no longer expose a way to change hunt mode.
- Turning the real hunt back on in production requires a code and decision change; changing
  `RRHS_HUNT_ENABLED` alone no longer mounts its browser interface.

## Alternatives considered

- **Keep console and query-string controls but use them only in staging.** Rejected because the
  preview should be automatic and should not expose edit controls in the browser.
- **Keep hunt commits off `production`.** Rejected because ADR 0003 promotes the whole `main`
  branch, so every later release would require temporarily reverting and then restoring the hunt.
- **Create a second hunt API for staging.** Rejected because the preview needs no real claims or
  coupons; a session-only fake backend is safer and requires no staging secrets.

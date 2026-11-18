# ADR 0008 — Staging runs its own assets and APIs with real integrations

**Status:** Accepted · 2026-11-17
**Related:** [0001](0001-staging-is-a-per-tab-mode-on-the-live-store.md), [0004](0004-one-vercel-project-with-public-previews.md), [0005](0005-staging-tabs-keep-a-visible-header-flag.md), [0007](0007-dragon-hunt-runs-as-an-automatic-staging-only-preview.md)

## Context

Staging loaded code from `main`, but called production APIs and left Ecwid-pasted iframe URLs on the production deployment. Dragon Hunt used a fake browser backend, so it could not validate the real coupon and email path. The query parameter selected an environment but did not authenticate a tester.

## Decision

1. `rrhs-deployment.js` derives the real frontend, asset and API environment from the script that loaded. Staging never silently sends a failed request to production.
2. `rrhs-iframe-router.js` rewrites only allowlisted RRHS iframe paths, including dynamically inserted frames, and preserves paths, queries and fragments. It never rewrites checkout, authentication, payment or third-party frames.
3. Staging APIs use the same real Ecwid store and hunt database as production, but Preview has its own configuration, promo ID and `RRHS_HUNT_CODE_PREFIX`. The recommended prefix is `RRHS-TEST-DRAGON-`.
4. Preview write routes require a signed, eight-hour tester session issued after email verification. Testers are managed with `RRHS_STAGING_TESTERS`; reusable credentials never enter browser source.
5. Dragon Hunt visibility follows `RRHS_HUNT_ENABLED` in each deployment. Staging can be enabled while production stays disabled. Claims remain deliberate user actions and automated tests use fixtures.
6. `window.RRHS_DEPLOYMENT.snapshot()` exposes only safe environment, commit, routing and failure information.

## Consequences

- Preview needs the documented Vercel variables before real staging claims work.
- Both deployments touch the same live store and hunt database. A staging promo ID and test prefix make test coupons distinguishable, but tests still create real data.
- Pasted Ecwid iframes can make an initial production request before the external loader can rewrite them. Full pre-load isolation requires replacing the live Ecwid embed markup, which is outside this repository change.
- Staging host protection alone is insufficient because the frontend runs on the public store domain; server authorization protects sensitive writes.

## Alternatives considered

- **A second Ecwid store or database.** Rejected by the one-store constraint and because it would not validate the real integration.
- **Continue using production APIs.** Rejected because backend changes could not be staged.
- **Client-side flags or a shared browser password.** Rejected because public JavaScript and storage are not authentication.
- **Mock all staging writes.** Rejected because intentional manual staging tests must exercise real coupons and mail.

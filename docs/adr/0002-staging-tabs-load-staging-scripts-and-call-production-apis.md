# ADR 0002 — Staging tabs load staging scripts and call production APIs

**Status:** Superseded by 0008 · 2026-11-17
**Related:** [0001](0001-staging-is-a-per-tab-mode-on-the-live-store.md), [0004](0004-one-vercel-project-with-public-previews.md)

## Context

The Ecwid store embeds one script, the production loader at `https://rrhscoop-assets.vercel.app/`
(Vercel serves `index.js` there), and that cannot be changed per visitor. For staging to test new
code, a staging tab (ADR 0001) has to end up running scripts from the staging deployment.

The API routes under `api/` need secrets (Ecwid token, HAC vault key, the hunt switch and its
database). The first staging plan was a second Vercel project, which would have needed its own
copy of every one of them.

## Decision

1. **The production `index.js` hands staging tabs off.** If the tab is in staging
   (`?rrhs_env=staging` or the stored flag) and the loader did not itself come from
   `STAGING_ORIGIN`, it loads `STAGING_ORIGIN/index.js` and stops. The staging loader then loads
   every other script from the staging deployment, because each script finds its asset base from
   its own URL.
2. **If the staging deployment cannot be reached, the tab falls back to production scripts**, and
   the staging notice says so.
3. **Staging scripts call the production APIs.** The staging loader sets
   `window.RRHS_API_ORIGIN` to `https://rrhscoop-assets.vercel.app`, and the four API callers
   use it when set: `easter-hunt/boot.js`, `easter-hunt/hunt.js`,
   `custom-visuals/rrhs-by-the-numbers.js` and `check-out-page/rrhscoop-checkout.js`.
   **New code that calls this repo's API must do the same.**
4. `STAGING_ORIGIN` in `index.js` and the staging hosts in `vercel.json` must change together.

## Consequences

- The staging deployment needs no env vars or secrets of its own.
- Staging cannot test changes to the API routes themselves; they run in production only after a
  promote (ADR 0003). An API change needs a different test path, or a separate decision.
- Hunt claims, stats and the HAC vault in a staging tab use production data.
- **Changing the hand-off reaches staging tabs only after a promote**, because the store always
  runs production's `index.js` first.
- The iframe embeds (hero, FAQ, CFA, teachers and so on) have their URLs written into Ecwid's
  page content as `rrhscoop-assets.vercel.app`, so they stay on production in a staging tab.
- Verified on 2026-11-17 on the live store: a staging tab loaded scripts from
  `rrhscoop-staging.vercel.app` and its hunt and stats calls went to production with `200`; a
  new tab loaded only production scripts.

## Alternatives considered

- **Give the staging deployment its own env vars.** Rejected for now: every secret would need a
  second copy to keep in sync, for no testing benefit while staging only changes scripts.
- **Proxy `/api/*` on the staging host to production with a `vercel.json` rewrite.** Not tried:
  Vercel may serve a matching file or function before it applies a rewrite, in which case the
  rewrite would never fire for the existing routes. Setting the API origin in the browser is
  simple and certain.

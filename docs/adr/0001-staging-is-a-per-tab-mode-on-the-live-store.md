# ADR 0001 — Staging is a per-tab mode on the live store, started from a domain we control

**Status:** Accepted · 2026-11-17
**Related:** [0002](0002-staging-tabs-load-staging-scripts-and-call-production-apis.md), [0003](0003-main-is-staging-and-a-workflow-promotes-to-production.md)

## Context

The storefront is an Ecwid (Lightspeed) instant site at `rrhscoop.roundrockisd.org`. Ecwid
serves the page; this repo only provides the scripts and styles it loads. Ecwid allows **one
storefront URL**, so there is no second Ecwid site to use as staging.

The store also answers at `rrhscoop.company.site`, Ecwid's default address. It sends a `302` to
`rrhscoop.roundrockisd.org`, keeping the path and query string. The first idea was to treat a
visit that came through that redirect as staging.

## Decision

1. **Staging is a mode of a browser tab on the real store**, not a separate site.
2. **A tab enters staging only through the `?rrhs_env=staging` marker.** The usual way in is
   the staging domain, `https://rrhscoop-staging.vercel.app`, whose root redirects to
   `https://rrhscoop.roundrockisd.org/?rrhs_env=staging` (the `redirects` in `vercel.json`).
   The same rule is already in place for `rrhscoop-staging.roundrockisd.org`, for when the
   district adds its DNS record.
3. **The mode lasts for the tab.** `rrhs-env.js` stores it in `sessionStorage`. Later pages in
   that tab stay on staging; a new tab on the store starts as production, even in the same
   browser and account. `?rrhs_env=prod` ends staging in the current tab.
4. `rrhs-env.js` loads first, sets `window.RRHS_ENVIRONMENT` and `<html data-rrhs-env>`, and
   shows a one-time notice in a staging tab saying which host its scripts came from.

## Consequences

- Staging runs against the real store, catalog and checkout. Anything tested there that places
  an order places a real one.
- Only someone who knows the staging domain or the marker reaches staging. Customers cannot
  land in it by accident.
- Everything Ecwid renders (the page, products, the iframe URLs written into Ecwid's page
  content) is the same in both modes. Only what this repo loads changes (ADR 0002).

## Alternatives considered

- **Detect the `rrhscoop.company.site` redirect in the browser.** Built, tested and removed the
  same day. Browsers hide where a cross-site redirect came from: `document.referrer` is empty
  and the navigation entry's `redirectCount` is 0. The only signal is timing: after the redirect,
  Chromium reported the navigation's `fetchStart` at about 450 ms instead of about 0. But any
  cross-site redirect looks the same, including `http://` to `https://` and email click-tracking
  links, so real customers could have landed in staging. Safari and Firefox were never checked.
- **Detect it on the server instead.** Not possible: a `302` adds no header saying where the
  visitor came from, and a typed URL sends no referrer, so a server sees the same blank arrival.
- **Move `rrhscoop.roundrockisd.org` to Vercel.** Rejected: it points at Ecwid's server
  (52.207.8.155). Moving it would take the store offline, and Vercel cannot pass requests
  through to Ecwid, because Ecwid's other address (`rrhscoop.company.site`) redirects straight
  back.
- **A separate Ecwid store for staging.** Not available on one storefront URL, and it would not
  share the real catalog.

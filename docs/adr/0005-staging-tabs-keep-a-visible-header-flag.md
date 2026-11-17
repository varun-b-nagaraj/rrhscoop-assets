# ADR 0005 — Staging tabs keep a visible flag in the storefront header

**Status:** Accepted · 2026-11-17
**Related:** [0001](0001-staging-is-a-per-tab-mode-on-the-live-store.md), [0002](0002-staging-tabs-load-staging-scripts-and-call-production-apis.md)

## Context

ADR 0001 gives a staging tab a one-time notice, but that notice disappears after it is dismissed.
Staging uses the real storefront, catalog, checkout and production APIs, so the page otherwise looks
like production. A tester can return to the tab later and forget which scripts it is running.

## Decision

`custom-visuals/rrhscoop-visuals.js` adds a compact `Staging` flag beside the RRHS CO-OP identity
in the left side of the storefront header whenever `window.RRHS_ENVIRONMENT` is `staging`. The
flag is persistent, text-based and non-interactive. Production does not render it.

## Consequences

- A staging tab remains identifiable after the one-time notice is dismissed and across storefront
  navigation.
- The flag uses the existing maroon and paper colors, and it shrinks on narrow screens so it does
  not crowd the mobile header.
- The flag identifies the scripts in use. It does not imply that the catalog, checkout or APIs are
  isolated from production.

## Alternatives considered

- **Keep only the one-time notice.** Rejected because it leaves no persistent indication after the
  tester dismisses it.
- **Use a full-width staging banner.** Rejected because it would take permanent vertical space from
  the live storefront and compete with store navigation.
- **Change the whole header color.** Rejected because text makes the environment explicit and does
  not rely on color alone.

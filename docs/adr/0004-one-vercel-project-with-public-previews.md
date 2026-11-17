# ADR 0004 — One Vercel project, with the staging domain on `main` and previews public

**Status:** Accepted · 2026-11-17
**Related:** [0002](0002-staging-tabs-load-staging-scripts-and-call-production-apis.md), [0003](0003-main-is-staging-and-a-workflow-promotes-to-production.md)

## Context

ADR 0003 needs two deployments: `production` for the store and `main` for staging. On Vercel
that can be two projects or one project with a branch domain. On the Hobby plan, deployments
other than production are behind Vercel Authentication by default ("all except custom
domains"), which redirects every request to a Vercel login. The store loads staging scripts
from a plain `<script>` tag, which cannot pass that login.

## Decision

1. **One project, `rrhscoop-assets`**, in the `vbn3009s-projects` scope, connected to
   `varun-b-nagaraj/rrhscoop-assets` on GitHub.
2. **Production Branch is `production`.** It serves `rrhscoop-assets.vercel.app`, the address the
   store loads, with "Auto-assign Custom Production Domains" on.
3. **`rrhscoop-staging.vercel.app` is a project domain attached to the `main` branch.**
4. **Vercel Authentication is off for the project** (`ssoProtection: null`, set 2026-11-17), so
   the staging domain and every preview URL are public, as production already is.

## Consequences

- Every preview deployment URL and its `/api/*` routes are public. They run with the project's
  Preview env vars, which as of 2026-11-17 include the Ecwid API token, HAC login and receipts
  secret. The secrets stay on the server, so this does not reveal them, but anyone can call a
  preview's API routes just as they can call production's. Staging does not need these vars
  (ADR 0002), so they could be limited to Production; that has not been done.
- When `rrhscoop-staging.roundrockisd.org` gets a district DNS record, add it to this project on
  the `main` branch and update `STAGING_ORIGIN` (ADR 0002). Its redirect is already in
  `vercel.json`.
- Production protection was never on and is unchanged.

## Alternatives considered

- **A second project for staging.** Tried and deleted. Vercel named it `rrhscoop-assets-o7et`,
  so its domain did not match the code; renaming the project did not change the domain; and it
  needed its own copy of every setting. Its one advantage was that staging would have been that
  project's production, and so public without changing protection.
- **Keep protection and use a bypass token.** Rejected: the token would have to be in the
  production `index.js`, which anyone can read, so it would protect nothing.
- **A protection exception for the one domain.** A paid Vercel add-on; not pursued.

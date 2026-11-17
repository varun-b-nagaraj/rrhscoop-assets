# ADR index

Every decision in this repo, oldest first. These files *are* the record. **Every decision gets an
ADR, in the same commit as the change** ([ADR 0000](0000-every-decision-gets-an-adr.md)).

## Conventions

- **Files are `NNNN-short-slug.md`.** Numbers are never reused. A gap means that number was never
  written, not that a decision was deleted; list any gap below.
- **Line 1 is `# ADR NNNN — Title`. Line 3 is `**Status:** …`**, one of `Accepted`, `Proposed` or
  `Superseded by NNNN`, followed by ` · YYYY-MM-DD`. The check reads this line, so keep the
  format exact.
- **Sections:** `## Context`, `## Decision`, `## Consequences`, and `## Alternatives considered`
  whenever anything else was weighed. What else was considered, and why it lost, is the point.
- **To change a decision, supersede it.** Write a new ADR and set the old one's status to
  `Superseded by NNNN`. The old file stays.
- **Name real files in backticks.** An Accepted ADR that names a repo file in backticks (for
  example `index.js`) fails the check if that file is gone, so a deleted feature cannot leave a
  decision describing it.
- `ops/scripts/adr-index-check.sh` checks all of this. `npm test` runs it.

## Gaps — never written

None.

## All decisions

| # | Decision | Status |
|---|---|---|
| 0000 | [Every decision gets an ADR](0000-every-decision-gets-an-adr.md) | Accepted |
| 0001 | [Staging is a per-tab mode on the live store, started from a domain we control](0001-staging-is-a-per-tab-mode-on-the-live-store.md) | Accepted |
| 0002 | [Staging tabs load staging scripts and call production APIs](0002-staging-tabs-load-staging-scripts-and-call-production-apis.md) | Superseded by 0008 |
| 0003 | [`main` is staging; a workflow promotes it to the `production` branch](0003-main-is-staging-and-a-workflow-promotes-to-production.md) | Superseded by 0009 |
| 0004 | [One Vercel project, with the staging domain on `main` and previews public](0004-one-vercel-project-with-public-previews.md) | Accepted |
| 0005 | [Staging tabs keep a visible flag in the storefront header](0005-staging-tabs-keep-a-visible-header-flag.md) | Accepted |
| 0006 | [The hunt discovery uses a dragon pop without an expanding ring](0006-hunt-discovery-uses-a-dragon-pop-without-a-ring.md) | Accepted |
| 0007 | [The dragon hunt runs as an automatic staging-only preview](0007-dragon-hunt-runs-as-an-automatic-staging-only-preview.md) | Superseded by 0008 |
| 0008 | [Staging runs its own assets and APIs with real integrations](0008-staging-runs-its-own-assets-apis-and-real-integrations.md) | Accepted |
| 0009 | [Two-level branch and release governance](0009-two-level-branch-and-release-governance.md) | Accepted |

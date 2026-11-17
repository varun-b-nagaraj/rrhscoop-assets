# ADR 0000 — Every decision gets an ADR

**Status:** Accepted · 2026-11-17
**Related:** [0001](0001-staging-is-a-per-tab-mode-on-the-live-store.md), [0002](0002-staging-tabs-load-staging-scripts-and-call-production-apis.md), [0003](0003-main-is-staging-and-a-workflow-promotes-to-production.md), [0004](0004-one-vercel-project-with-public-previews.md)

## Context

Until now this repo kept its decisions in the README, code comments and commit messages. That
worked while changes were small, but the staging setup (ADRs 0001–0004) went through four
designs in one day: detecting the company.site redirect, a `staging` branch, a second Vercel
project, and finally `main` as staging. Each was dropped for a specific reason, and none of those
reasons was written down anywhere a later reader would find them. The next person to ask "why
not just detect the redirect?" would have had to rediscover the answer.

The framework is copied from the kaya5-app repo, which has used it for more than 150 decisions.

## Decision

1. **Every decision gets an ADR, from now on.** A decision is anything a later reader could
   reasonably ask "why is it like this?" about: architecture, infrastructure and hosting,
   branching and release process, data handling, security settings, third-party services, and
   anything that rules out an obvious alternative. A change that only follows an existing ADR
   does not need a new one.
2. **The ADR lands in the same commit as the change it records**, not later.
3. **Files are `docs/adr/NNNN-short-slug.md`**, numbered in order from 0000. Numbers are never
   reused. A gap means the number was never written, and the index says so.
4. **Every ADR follows this shape:**
   - `# ADR NNNN — Title` on line 1.
   - `**Status:** Accepted · YYYY-MM-DD` on line 3. Status is one of `Accepted`, `Proposed` or
     `Superseded by NNNN`.
   - An optional `**Related:**` line linking other ADRs.
   - `## Context`, `## Decision`, `## Consequences`, and, when anything else was considered,
     `## Alternatives considered`. The alternatives section is often the most useful part.
     An ADR that records only what was already obvious is not worth the file.
5. **Decisions are not edited away.** To change one, write a new ADR and mark the old one
   `Superseded by NNNN`. The old file stays, because its reasoning is often why the new one
   looks the way it does. Small corrections that do not change the decision can be made in place
   with a dated note.
6. **Every ADR is listed in [the index](README.md)** with its status.
7. **`ops/scripts/adr-index-check.sh` enforces 3, 4 and 6** and also fails when an Accepted ADR
   names a repo file in backticks that does not exist. `npm test` runs it
   (`test/adr-index.test.js`), so it runs before every commit under the repo workflow and before
   every promote to production (ADR 0003).

## Consequences

- A decision with no ADR is treated as not yet made. Agents working in this repo write the ADR as
  part of the change (`AGENTS.md`).
- Deleting or renaming a file that an Accepted ADR names fails the tests. Either update the ADR or
  supersede it. This is deliberate: an ADR that describes code that is gone is worse than none,
  because the next reader will believe it.
- Decisions made before 2026-11-17 (the anti-flicker cloak, the shared runtime, the hunt
  design and so on) are not back-filled. Write an ADR for one when it is next changed.

## Alternatives considered

- **Keep using the README and commit messages.** Rejected: the README describes how things are,
  not what else was tried, and commit messages are hard to find by topic.
- **ADRs without a check.** Rejected: kaya5-app's index drifted from its files before it had the
  check, and decisions there were made twice because one could not be found.

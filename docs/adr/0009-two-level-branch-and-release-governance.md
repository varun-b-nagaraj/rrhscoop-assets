# ADR 0009 — Two-level branch and release governance

**Status:** Superseded by 0010 · 2026-11-18
**Related:** [0003](0003-main-is-staging-and-a-workflow-promotes-to-production.md), [0004](0004-one-vercel-project-with-public-previews.md)

## Context

`main` and `production` had no GitHub protection. The promotion workflow checked mutable `main`, lacked an approval gate, and did not verify either deployment.

## Decision

1. Feature branches reach `main` through pull requests checked by `.github/workflows/ci.yml` and owned through `.github/CODEOWNERS`.
2. `.github/workflows/promote-to-production.yml` accepts an exact commit SHA, repeats repository checks, verifies the staging deployment, waits for the protected `Production` environment, fast-forwards `production`, and verifies production.
3. Both branches need the rules documented in `docs/developer-handoff.md`. Settings are applied manually after review because workflow files cannot safely grant their own permissions.
4. Promotion never force-pushes and concurrent promotions queue.

## Consequences

- A successful pull request does not authorize production.
- Branch rules and a `Production` environment reviewer must be configured before the policy is enforceable.
- `GITHUB_TOKEN` cannot be assumed to bypass branch protection. The production ruleset must explicitly permit the GitHub Actions integration, or maintainers must use a narrowly scoped protected-environment credential.

## Alternatives considered

- **Automatic production deployment after merge.** Rejected because staging review and explicit approval are required.
- **Give every developer direct push access.** Rejected because it bypasses review and CI.
- **Force-push production during rollback.** Rejected because rollback is a new forward commit on `main`, then a normal promotion.

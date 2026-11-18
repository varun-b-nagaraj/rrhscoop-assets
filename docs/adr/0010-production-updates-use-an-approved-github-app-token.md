# ADR 0010 — Production updates use an approved GitHub App token

**Status:** Accepted · 2026-11-18
**Related:** [0003](0003-main-is-staging-and-a-workflow-promotes-to-production.md), [0009](0009-two-level-branch-and-release-governance.md)

## Context

GitHub permits a manual workflow to target a selected branch or tag after its workflow file exists
on the default branch. A check for `refs/heads/main` inside the workflow is useful, but an
unreviewed branch could change that check. The repository's default `GITHUB_TOKEN` is read-only,
and a protected `production` branch should not depend on a general Actions identity being allowed
to bypass its rules.

## Decision

1. `.github/workflows/promote-to-production.yml` rejects a dispatch whose runtime ref is not
   `refs/heads/main`, checks a full commit SHA, and requires that SHA to equal the current `main`
   tip.
2. Validation uses no production environment or write credential. It repeats Level 1 tests and
   read-only staging checks.
3. The `promote` job uses the reviewer-protected `Production` environment. Only that job can read
   `PRODUCTION_APP_ID` and `PRODUCTION_APP_PRIVATE_KEY` and mint a one-hour installation token.
4. The GitHub App is installed only on this repository with Repository Contents and Workflows
   read/write and no Administration or Actions permission. Workflows is needed because GitHub
   refuses an App push that moves a branch over commits changing `.github/workflows`. Two
   rulesets target `production`: one blocks deletion, force pushes and non-linear history with
   no bypass actors; the other restricts updates and names the App as its only Always bypass
   actor. Splitting them keeps the App unable to rewrite `production`, because a bypass actor
   skips every rule in its own ruleset.
5. Immediately before the push, the approved job fetches both branches again, requires the
   validated SHA to still equal the current `main` tip, and requires `production` to be its
   ancestor. The push contains no force option.
6. Before approval is requested, a read-only readiness step requires production to be serving
   and, once it has `/api/v1/environment`, to report production with Ecwid and email configured.
7. Production deployment verification runs afterward in a separate read-only job without the App
   credential.

## Consequences

- A feature-branch dispatch cannot obtain the App credential because the environment permits only
  `main`, and its ordinary token cannot update the app-restricted `production` branch.
- The in-workflow main-ref check, environment policy, ruleset, reviewer approval, short-lived App
  token and fast-forward check are separate controls. Removing one does not silently grant a
  feature branch production access.
- Production promotion remains blocked until the App, environment secrets and ruleset bypass are
  configured manually.
- Workflows write lets the App token change workflow files on unprotected branches during its
  one-hour life. It is minted only inside the approved job, and `main` and `production` stay
  protected from it.

## Alternatives considered

- **Writable `GITHUB_TOKEN`.** Rejected because it is a repository-wide workflow identity and does
  not provide a dedicated, narrowly scoped production actor.
- **A fine-grained personal access token.** Rejected as the primary design because it is tied to a
  person and has a longer-lived credential lifecycle. It is an emergency fallback only.
- **Environment branch restriction alone.** Rejected because defense in depth is required and a
  workflow ref check by itself can be changed on an unreviewed branch.

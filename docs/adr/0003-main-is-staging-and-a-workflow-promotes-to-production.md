# ADR 0003 — `main` is staging; a workflow promotes it to the `production` branch

**Status:** Accepted · 2026-11-17
**Related:** [0002](0002-staging-tabs-load-staging-scripts-and-call-production-apis.md), [0004](0004-one-vercel-project-with-public-previews.md)

## Context

Before staging existed, every push to `main` deployed straight to the live store. With staging
(ADRs 0001 and 0002), changes need somewhere to land first and a deliberate step to go live. The
owner works on `main` and wanted it to stay that way.

## Decision

1. **`main` is staging.** Every change is committed and pushed to `main`, which deploys to
   `rrhscoop-staging.vercel.app` (ADR 0004).
2. **`production` is what the store runs.** The production deployment
   (`rrhscoop-assets.vercel.app`) builds the `production` branch. Nobody commits to it.
3. **The "Promote to production" GitHub Action is the only way to change `production`.** It is
   run by hand from the Actions tab (`.github/workflows/promote-to-production.yml`). It checks out
   `main`, runs `npm ci` and `npm test`, then fast-forwards `production` to `main`. It refuses if
   `production` has commits `main` does not, and does nothing if they already match.
4. A fix that somehow lands on `production` directly must be merged back into `main` before the
   next promote, or the workflow will refuse.

## Consequences

- A push to `main` never changes the live store on its own.
- Promotion is all of `main` at once. To hold one change back, it must stay off `main` (a
  short-lived branch) until it is ready.
- The old `staging` branch was deleted on 2026-11-17; it was fully contained in `main`.
- The workflow had not been run as of 2026-11-17. It uses Node 24 on GitHub (the owner's machine
  runs Node 26), and its push needs Actions to have write permission on the repo.
- Neither branch has branch protection, so the rule in 2 is enforced only by habit and
  `AGENTS.md`.

## Alternatives considered

- **A `staging` branch that is promoted into `main`.** Built first, then dropped: Vercel's
  separate staging project could not be pointed at a `staging` branch from the screens the owner
  had, and the owner wanted to stay on `main`.
- **Two Vercel projects, one per branch.** Tried: the second project was created, renamed
  `rrhscoop-staging`, then deleted. Its auto-generated domain did not match the code, and it
  duplicated the project's settings. See ADR 0004.
- **Promote by git tag** (as in kaya5-app ADR 0016). Not chosen: Vercel deploys branches, not
  tags, so a tag would still need a workflow to move a branch. Moving the branch directly is one
  step fewer.

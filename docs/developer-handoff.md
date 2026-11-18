# RRHS CO-OP developer handoff

## What runs where

Ecwid serves `https://rrhscoop.roundrockisd.org` and includes the production `index.js`. A tab opened through `https://rrhscoop-staging.vercel.app` receives `?rrhs_env=staging`; `rrhs-env.js` keeps that choice in `sessionStorage`, so a new tab starts in production. The production loader hands that tab to the staging loader. `main` is staging and `production` is live.

`rrhs-deployment.js` is the source of truth after loading. In DevTools, run `RRHS_DEPLOYMENT.snapshot()` to see the requested and actual frontend environment, asset/API origins, deployed commit, iframe rewrite count, configuration readiness and failures. It never includes tokens, credentials or student data. A staging flag appears next to the logo only when staging assets actually loaded.

## Repository map

- `index.js`, `rrhs-env.js`, `rrhs-deployment.js`: loader, per-tab selection and diagnostics.
- `rrhs-iframe-router.js`, `iframes/`: hosted custom pages and routing.
- `api/v1/`, `api/_lib/`: Vercel APIs and shared server authorization.
- `easter-hunt/`: Dragon Hunt browser, rules, database and integrations.
- `teacher-preorders/`, `check-out-page/`: faculty preorder and checkout behavior.
- `test/`, `test/browser/`: Node and safe Playwright checks.
- `.github/workflows/`: pull-request CI and manual production promotion.
- `docs/adr/`: decisions and rejected alternatives.

## Iframe routing

Ecwid-pasted embeds currently name the production host. The router changes only known `/iframes/` paths to the active asset origin and watches later DOM insertions. It preserves query strings and fragments. Add a new path to `ALLOWED_PATH` only after reviewing it; checkout, sign-in, payments and third-party frames must stay outside the allowlist.

Whenever possible, generate new iframe URLs from `RRHS_DEPLOYMENT.assetUrl()` instead of relying on rewriting. Repository embed templates are reference copies: changing them does not update content already pasted into Ecwid. Because Ecwid renders that markup before the external loader runs, an initial production iframe request can occur in a staging tab. Avoid claiming pre-load isolation until the live embeds are replaced with environment-aware markup.

## APIs and environment variables

Browser calls use the active deployment’s `/api/v1/` origin. Never fall back from staging to production. GET routes may be public where the existing feature requires it; Preview POST routes with sensitive effects require the staging Bearer session from the password gate.

Vercel Preview must have the same real integration credentials needed by the feature:

- Ecwid: `RRHS_ECWID_STORE_ID`, `RRHS_ECWID_API_TOKEN` and optional `RRHS_ECWID_API_BASE`.
- Email: `RRHS_CFA_VERIFICATION_URL`, `RRHS_CFA_VERIFICATION_SECRET`, `RRHS_HUNT_RELAY_SECRET`.
- Hunt: `RRHS_HUNT_DATABASE_URL`, `RRHS_HUNT_SECRET` and `RRHS_HUNT_PROMO_ID`. The hunt's on/off switch and dates are in `easter-hunt/config.js`, not Vercel (ADR 0012).
- Staging access: the shared `RRHS_STAGING_PASSWORD` (8+ characters) and a random 32+ character `RRHS_STAGING_SESSION_SECRET`.
- Feature-specific routes may also need `RRHS_HAC_VAULT_KEY`, `DISCOUNT_URL_SHARED_SECRET`, or `RRHS_CHAT_BEARER_TOKEN`.

Every Vercel variable is one entry targeting both Production and Preview, with one value (ADR 0012). Add new variables to both at once, and run `npm run check:vercel-env` afterwards. Behaviour that should differ between staging and production belongs in code, not in a variable. Do not copy values into source or logs. `/api/v1/environment` reports only readiness booleans. Missing Preview credentials fail clearly and never redirect to production.

Share the staging password only with developers. Sessions last at most eight hours. Changing `RRHS_STAGING_PASSWORD` or `RRHS_STAGING_SESSION_SECRET` (then redeploying staging) ends every current session immediately.

## Adding a custom page or API

For a page, put assets under `iframes/<name>/`, use relative same-origin requests, add its path to the router allowlist and add routing tests. Update the Ecwid embed only with explicit approval.

For an API, keep secrets server-side, preserve explicit request/response contracts, use `RRHS_DEPLOYMENT.fetch()` in the parent page, and call `requirePreviewAccess()` before Preview writes. An iframe that writes must receive the short-lived session through an exact-origin `postMessage`; never put it in a URL. Add success, missing-configuration and unauthorized tests without contacting live services.

## Branch and access rules to configure manually

No rules were enabled during this change. The repository owner should create rulesets after review.

For `main`: require pull requests, one owner approval through CODEOWNERS, the `CI / checks` status, resolved conversations, no force pushes and no deletion. Give student developers Write access, not Admin. If the plan supports a bypass actor, limit direct pushes to the repository owner/admin role. GitHub rulesets cannot reliably distinguish one owner from every future admin, so keep other developers non-admin rather than weakening the rule.

For `production`, create two active branch rulesets that each target only `refs/heads/production`. **Production — no rewrites** has Restrict deletions, Block force pushes and Require linear history, with **no bypass actors**, so even the App can only fast-forward. **Production — app-only updates** has Restrict updates, with one bypass actor: the dedicated RRHS production GitHub App, bypass mode **Always**. A bypass actor skips every rule in its ruleset, which is why the two are separate. Do not require pull requests or status checks on this branch because the approved workflow performs the direct fast-forward. Do not add repository roles, administrators, teams, users, GitHub Actions, or `GITHUB_TOKEN` as bypass actors on either ruleset.

Create the GitHub App under the owner account, install it only on `rrhscoop-assets`, and grant only repository **Contents: Read and write** and **Workflows: Read and write** (Metadata read is implicit). Workflows is required because GitHub refuses an App push that moves a branch over commits changing `.github/workflows`. It does not need Administration, Actions, Pull requests, Issues, Secrets, Environments or organization permissions. Store its ID as `PRODUCTION_APP_ID` and private key as `PRODUCTION_APP_PRIVATE_KEY`, both as secrets in the protected `Production` environment, not repository secrets. Keep that environment restricted to `main`, require `varun-b-nagaraj`, and keep administrator bypass disabled.

The repository `GITHUB_TOKEN` remains read-only. It is intentionally unable to update `production`; the approved job mints a one-hour App installation token after approval. A fine-grained personal token with Contents read/write, access only to this repository, and the same ruleset bypass is an emergency fallback, but the GitHub App is preferred because it is not tied to a student or maintainer account.

Grant a developer repository Write access, have them branch from `main`, and revoke access from Settings → Collaborators when they leave. Do not grant Admin just to allow a direct push.

## Normal workflow

1. `git switch main && git pull --ff-only`, then create `feature/<name>` or `fix/<name>`.
2. Run `npm ci`, `npm run lint`, `npm run check:secrets`, `npm run check:config`, `npm test`, and `npm run test:browser`.
3. Push the feature branch and open a pull request to `main`. The owner reviews and CI must pass.
4. After merge, wait for Vercel’s staging deployment. Open the staging URL, enter the staging password, and inspect `RRHS_DEPLOYMENT.snapshot()`.
5. For a deliberate Dragon Hunt integration test, find a dragon, claim with a designated test student account, verify the email, and test the code in checkout without completing an order. This creates a real single-use Ecwid coupon from the production promotion and counts against the real hunt. Do not delete it automatically.
6. To release, copy the exact tested SHA from `main`, run “Promote to production,” enter that full SHA, and approve the protected `Production` job. A green PR alone is not release approval.

Automated smoke tests only read public deployment state and assets. They never claim a dragon, send mail, create a coupon, change inventory or place an order.

## Verification

Staging:

1. Open `https://rrhscoop-staging.vercel.app` in a new tab and verify the compact STAGING flag.
2. Enter the staging password. In DevTools verify `RRHS_DEPLOYMENT.snapshot().frontendEnvironment === 'staging'`, both origins are the staging host, `stagingAssetsLoaded` is true, and `fellBackToProduction` is false.
3. Inspect custom iframe `src` values. Allowlisted RRHS frames must use staging; checkout/auth/third-party frames must be unchanged.
4. Compare the snapshot commit SHA with `git rev-parse main`. Confirm required configuration booleans are true.
5. Only with approval for a real write, run the Dragon Hunt flow described above.

Production after an approved promotion:

1. Open a new unmarked storefront tab. There must be no STAGING flag or tester dialog.
2. Verify the snapshot says production and uses `https://rrhscoop-assets.vercel.app` for assets and APIs, with no fallback.
3. Confirm Dragon Hunt matches `enabled` and the dates in the promoted `easter-hunt/config.js`.
4. Check the environment endpoint commit matches the promoted SHA and browse normal custom pages and checkout without placing an order.

## Rollback and troubleshooting

Never move `production` backward or force-push it. Revert the faulty commit on a feature branch, merge the revert through `main`, verify staging, then promote the new revert commit normally. Vercel also retains old deployments for emergency diagnosis, but branch history remains the release record.

- Wrong flag or origin: inspect the snapshot and loader failures; use `?rrhs_env=prod` to end staging in that tab.
- Staging write returns 401: sign in again. A 503 means Preview access or feature credentials are missing.
- Iframe stays on production: confirm its path is allowlisted and the router loaded. A production request before rewrite is the known Ecwid paste-in limitation.
- Staging commit mismatch: wait for the `main` deployment; promotion intentionally refuses a different SHA.
- Promotion cannot push: confirm the dedicated App is installed on this repository, has Contents and Workflows read/write, and is the only Always bypass actor on the app-only updates ruleset. Do not force-push or disable protection.
- Suspected exposed credential: rotate it at the provider, remove it from source, and review history. Removal alone does not revoke it.

The legacy assistant credential that was previously embedded in browser/server defaults was removed. Rotate that upstream credential before re-enabling the currently disabled assistant; source removal does not revoke the old value.

Future developer checklist: read current ADRs; branch from `main`; keep secrets out of source; add tests before writes; use centralized origins; document decisions; verify staging; get owner approval; promote an exact SHA; never force-push either protected branch.

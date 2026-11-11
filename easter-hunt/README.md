# Hidden package hunt

The current implementation is a **local development preview**, as requested. It is not a live promotion. No Ecwid coupons are created, no student emails are sent, and no production database is changed. Preview names are fictional (`Dragon`), verification is simulated, and the UI labels these facts.

## Run the preview

With Node 18+:

```sh
node tools/easter-hunt-preview.cjs
```

Open <http://127.0.0.1:4173>. In DevTools, run `window.RRHSOVERIDE = true`. Follow **Find the package**, then find the small package beside **Inventory Intelligence**. Enter your S-number **including the s**, such as `s151579`. The preview simulates delivery to `s151579@student.roundrockisd.org`. It reveals the simulated percentage, never a discount code.

## DevTools gate and introduction

Normal visitors see no hunt UI while `HUNT_ENABLED` is false. Enable the development presentation in your current tab:

```js
window.RRHSOVERIDE = true;
```

The exact flag spelling is `RRHSOVERIDE`. It applies immediately, persists in session storage for that tab, and is forwarded to the site's hosted content frames with origin/source checks. No console reload is required. It enables the presentation on the hosted storefront too, while the production claim API stays closed. A hosted override shows an explicitly labeled example count until a live backend is available; it never manufactures a successful live claim.

The header counter appears immediately before Ecwid's search control. It shows the total found across the hunt, with remaining rewards and an explanation on hover or keyboard focus. On local standalone pages without the storefront header, it appears at the top right for testing.

Three seconds after enabling the presentation, a large SVG magnifying glass scans across the dimmed page. Its clear lens reveals the actual page beneath it, then settles on a package. Clicking or keyboard-activating that package expands the light into an introduction modal. The demonstration package consumes no reward. Skip and Escape dismiss it; reduced motion uses a static introduction. Existing open dialogs defer the automatic introduction. It plays once per tab; selecting the counter replays it.

```js
window.RRHS_HUNT_INTRO.replay(); // Replay after the experience has loaded.
window.RRHSOVERIDE = false;     // Remove the counter, packages, intro and spotlight.
```

Root-page claim dialogs handle discoveries from trusted hosted iframes so dialogs cover the full website rather than the iframe's tall document.

The local management page has all twelve egg records, remaining prize quantities, claims, a redacted audit, pause/resume, egg enable/disable, simulated email failures/retries, reset, and a minimal JSON export. The email links render the same HTML/plain-text template added to the district Apps Script. Preview email contains no usable code.

Only one egg is interactive in the storefront preview. With `DEV_ALL_EGGS_ENABLED` false, the local server also starts and resets with the other eleven eggs disabled. Other locations are registered for future integration. Availability polls every 15 seconds and refreshes on window focus. Closing before submission consumes nothing. All simulator state lives in one Node process and resets on restart; its atomicity and rate limits are **not suitable for multiple production instances**. Reset also clears idempotency records, claims, and rate limits.

## Plain boolean gates

Edit `easter-hunt/config.js`:

```js
HUNT_ENABLED: false,
DEV_PREVIEW_ENABLED: true,
DEV_ALL_EGGS_ENABLED: false,
```

Keep `HUNT_ENABLED` false. The `RRHSOVERIDE` DevTools flag gates all preview UI, including local pages. `DEV_PREVIEW_ENABLED` permits the loopback preview server; set it false to close that server too. `DEV_ALL_EGGS_ENABLED` temporarily reveals all twelve placements locally for review; keep it false to leave only Inventory Intelligence available. These are plaintext code switches, not `.env` settings.

The deployed `/api/v1/easter-hunt` returns disabled availability and rejects all claim requests. Changing the browser boolean cannot enable live issuance. There is deliberately no “flip this boolean to launch” instruction while checkout enforcement and identity ownership remain unresolved.

The exclusive deadline is `2026-11-14T00:00:00-06:00`, which includes all of Friday, November 13's 11:59 PM minute in America/Chicago. UI/email copy says Friday, November 13, 2026, at 11:59 PM Central. The scheduled start is Monday, November 9 at midnight Central.

## What was reused and inspected

- This repository serves plain JavaScript, CSS, HTML, Ecwid storefront customizations, and Vercel CommonJS API handlers. No frontend framework or package dependency was added.
- Existing maroon/paper/cream tokens, Spectral and Playfair Display typography, and the shared runtime observer are reused. A native dialog supplies top-layer modal behavior; keyboard trapping, focus return, Escape, reduced motion, and short package/confetti/count-up animations are included.
- Existing `discount-url.js` calculates an optional surcharge. It is unchanged. Checkout, teacher preorders, dispatch, receipts, and order status sending are unchanged.
- Existing email functions use MailApp/GmailApp from the district account. `buildEasterEggRewardEmail` reuses `cfaEmail_` rather than replacing receipt or preorder templates. It returns HTML and plain text and never sends by itself. Email uses a static layout because email clients commonly strip animation and scripts.
- There is no database, schema migration mechanism, or admin authentication interface in this assets repository. The sibling `barcode-pass-verification` app has its own SQLite/Postgres adapter, schema and authenticated admin routes; those were inspected, not modified or connected to this promotion.
- `easter-hunt/directory.js` implements the sibling app's existing timestamp/HMAC request protocol. It accepts an address only after the directory confirms an exact match. It has no public route and is **not called by the mock preview**.
- A read-only check against the configured Ecwid store succeeded for profile and coupon metadata. `pricesIncludeTax` was false. No coupons, orders, settings, directory records or mailboxes were changed by that check.

## Checkout blocker before live launch

Ecwid's documented [create-coupon fields](https://docs.ecwid.com/api-reference/rest-api/discounts/discount-coupons/create-discount-coupon) include percentage/fixed amount, `SINGLE` use, expiration, and catalog restrictions. They do not expose a cap on the portion of subtotal eligible for a percentage discount. `totalLimit` is a **minimum**, not the requested cap. A regular 35% coupon or an $8.75 flat coupon would both violate the rules for some carts. Neither is issued here.

The [server-calculated discount hook](https://docs.ecwid.com/discounts-and-tips/add-discounts-to-the-store/discounts-calculated-on-your-server) supports an absolute discount computed from eligible merchandise:

```text
round_to_cents(percentage × min(eligible merchandise subtotal, $25))
```

That hook is the candidate for exact checkout math. It needs Ecwid's `customize_cart_calculation` scope and must share the existing `discountUrl` endpoint with surcharges. Ecwid allows checkout without that discount if the hook misses its five-second deadline. Native [coupon behavior](https://support.ecwid.com/hc/en-us/articles/207806525-Setting-up-discount-coupons) allows only one coupon per order, but linking a custom discount to a native single-use coupon without double-discounting, replay races, or bypasses still requires sandbox validation. Do not use a browser-only cart adjustment or issue a zero-value marker coupon without confirming its behavior.

Before live launch, implement and validate:

1. A supported Ecwid single-use authorization/code mechanism for the dynamic capped amount, exact merchandise eligibility, expired/replayed carts, simultaneous checkout, and no coupon stacking. Confirm store timezone is America/Chicago. No live issuance code is enabled or supplied in this development iteration.
2. An authorized student directory lookup followed by proof of access to that exact school mailbox (OTP or district SSO). A matching S-number and a directory name **do not prove that the person entering it owns the identity**. Never return a directory name or existence result to an unverified browser.
3. Durable Postgres tables and an atomic transaction for configuration, eggs, prize units, verified claims, idempotency, coupon issuance, email jobs, redemption and audit. Use keyed hashes for student uniqueness, encrypted short-lived fulfillment data, database uniqueness constraints, cryptographic draws, and transactional outbox retries. No migration is included or applied to another app's database for this mock-only iteration.
4. Distributed request/OTP limits, recovery for reserved claims, authenticated staff management in the actual admin application, minimal reports, and operational failure notifications. The local management page is a developer tool, not production admin authorization.
5. Signature-validated/idempotent Ecwid webhook handling or authenticated order reconciliation for redemption, plus tested asynchronous delivery using the existing verified district sender. Never allocate a second reward on retry. No redemption or real delivery worker exists in this preview.
6. Integration and database concurrency tests in a sandbox. Current tests cover the simulator and disabled production API, not live checkout, real mailbox verification, or distributed claims.

## Apps Script setup

**Nothing special is required for this local preview.** Do not create a new trigger or send test student emails. The preview renderer reads the Apps Script template locally without Gmail/MailApp bindings.

For the later live identity integration:

- Reuse `/Downloads/barcode-pass-verification/public/integrations/student-directory.gs` and its existing deployed directory web app if authorized. Keep that project separate from the combined teacher email project: both define `doPost`, so pasting both entrypoints together would break routing.
- Enable the **People API advanced service** in that directory project and the corresponding Google Cloud API if needed. Run as an authorized district account with access to student domain profiles/contacts; the district may need to allow directory visibility. A personal Gmail account cannot supply the school directory.
- Set Script property `DIRECTORY_SECRET` to a random secret of at least 32 characters. Put the **same secret** in server-only `STUDENT_DIRECTORY_SECRET`, and the deployed `/exec` URL in `STUDENT_DIRECTORY_URL`. These variables are only for the optional future directory adapter, not feature flags. No directory secret is read by the browser or required by the preview.
- Deploy an updated web app version after any directory code change. Keep its HMAC check and timestamp window. Avoid using the directory endpoint as a public student lookup interface. The copied directory script's first-match behavior also needs review for ambiguous profiles across pages before live use.
- `buildEasterEggRewardEmail` is already added to the combined `apps-script/teacher-preorder-verification.gs`. When deploying future live fulfillment, keep that function with the existing `cfaEmail_` helper and verified sender configuration. Saving it alone adds no trigger and sends nothing. Existing minute jobs remain unchanged. A signed, idempotent queue/send route still needs implementation; do not expose a public arbitrary-recipient sending action.

## Files

| Files | Purpose |
| --- | --- |
| `easter-hunt/config.js` | Plain booleans, deadline, twelve unique location IDs |
| `easter-hunt/service.js` | Isolated mock claim engine, prize draw, rates, idempotency, management |
| `easter-hunt/boot.js`, `hunt.js`, `hunt.css`, `experience.js` | DevTools gate, iframe bridge, header counter, spotlight introduction, reusable egg, accessible modals, availability refresh |
| `easter-hunt/directory.js` | Private signed directory adapter for later verified integration |
| `easter-hunt/email-preview.js` | Render the existing Apps Script template without sending |
| `api/v1/easter-hunt.js` | Closed production API |
| `tools/easter-hunt-preview.cjs`, `tools/easter-hunt/*` | Loopback-only local preview and management tools |
| `tools/check-easter-hunt-browser.cjs`, `test/easter-hunt.test.js` | Browser QA and critical logic/API tests |
| `index.js`, projects/FAQ/why/category HTML | Load the gated feature in existing storefront surfaces |
| `iframes/projects/projects.js` | Inventory Intelligence placement marker |
| `apps-script/teacher-preorder-verification.gs` | Shared branded HTML/plain-text reward template |

## Tests

```sh
node --test
```

Optional browser QA without adding project dependencies:

```sh
npm install --prefix /tmp/rrhs-hunt-qa --no-package-lock playwright
node tools/check-easter-hunt-browser.cjs /tmp/rrhs-hunt-qa/node_modules/playwright
```

If Chromium is not installed, run `/tmp/rrhs-hunt-qa/node_modules/.bin/playwright install chromium` first. Browser tests cover desktop, small/large mobile, tablet, landscape, reduced motion, enlarged text, keyboard focus/escape, non-consuming dismissal, simulated claims, lost availability, and mobile email width. They also verify the default-off gate, immediate on/off toggles, per-tab persistence, three-second introduction, spotlight click/skip, header counter tooltip, and trusted iframe discovery bridge. All tests use fictional or locally entered preview data, no live Ecwid writes and no real email.

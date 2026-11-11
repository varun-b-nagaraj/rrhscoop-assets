# Hidden package hunt

Twenty dragon stickers hidden around the CO-OP website, one per page (the long Teacher Hub has a top and a bottom one). A student who finds one enters their S-number (or staff enter their `@roundrockisd.org` email) and gets a percent-off coupon, emailed to that school inbox. One reward per person. The deeper the page, the bigger the reward:

| Reward | Stickers |
| --- | --- |
| 10% ×7 | Product pages: Snacks, Drinks, Long Sleeves, T-Shirts, Accessories, School Supplies, Merchandise |
| 15% ×6 | Home (Why the CO-OP), Teacher Hub top, Leadership, FAQ, Chick-fil-A, About us |
| 20% ×4 | Student Projects · Inventory Intelligence, 2025–26 Leadership, Teacher Hub bottom, Payment methods |
| 25% ×2 | Shipping & returns, Terms & Conditions |
| 35% ×1 | Privacy policy (Customers' Rights) |

Placements are in `easter-hunt/config.js`; rewards are in `HUNT_REWARDS` in the Apps Script (a test keeps the two in step).

## Turning it on and off

The **only** switch is the Vercel environment variable `RRHS_HUNT_ENABLED`:

- `true` turns the hunt on for every visitor.
- Any other value, or no value, turns it off for everyone. The API then reports `disabled` and refuses claims.

Vercel applies an environment variable change only to new deployments. After changing it, redeploy (Deployments → ⋯ → Redeploy). Pages pick up the change within about 30 seconds of the deploy.

To stop claims temporarily without redeploying, use **Pause hunt** on the dashboard.

## How a claim works

1. The website asks `/api/v1/easter-hunt` for availability. Pages check every 5 seconds and Vercel caches the answer for 2 seconds. The Apps Script is the only source of truth: once anyone claims a sticker, every visitor sees it greyed out under a magnifying glass and it can no longer be opened. The finder's own tabs and the page's iframes switch instantly; everyone else within a few seconds. Opening a sticker always re-checks with the server, skipping the cache.
2. The student enters their S-number. The API forwards the claim to the Apps Script web app (`RRHS_CFA_VERIFICATION_URL`).
3. Under its script lock, the Apps Script:
   - checks the hunt window (Nov 9 – Fri Nov 13, 11:59 PM Central);
   - checks one reward per person (S-number or staff email) and one per sticker;
   - gives the sticker's fixed reward;
   - creates a single-use, uncapped percent-off Ecwid coupon (`RRHSHUNT-…`);
   - records the claim, then emails the code to `S-number@student.roundrockisd.org`, or to the staff email as entered.
4. The website sees only the percentage, never the code.
5. If the email fails, the minute job (`runCoopJobs`) retries it, up to 5 attempts.

## Dashboard and logs

<https://rrhscoop-assets.vercel.app/easter-hunt/dashboard>

- **Sign-in:** a 6-digit code is emailed to an approved address (`HUNT_ADMINS` in the Apps Script). The session lasts 12 hours.
- **What it shows:** status, rewards left, every claim with its coupon code and email status, each sticker with its reward, and the event log.
- **Sticker screenshots:** select a sticker to see a screenshot of exactly where it hides. The screenshots live in `api/v1/_hunt-locations/` and are served only to a signed-in admin, never as public files. Retake them with `node tools/capture-hunt-locations.mjs` after moving a sticker.
- **Pause / Resume** stops or restarts claims without losing records.
- **Where logs are stored:** every claim, refusal, email, retry, sign-in and pause is appended to the Google Sheet **"RRHS CO-OP package hunt log"** in the script owner's Drive. Claims are also kept in Script properties (`hunt_live_state`), so the dashboard works even if the sheet is unavailable.

Apps Script editor actions:
- `setupHuntLog()`: run once. It authorizes Google Sheets and creates the log.
- `showHuntClaims()`: logs every claim.
- `pauseHunt()` / `resumeHunt()`: same as the dashboard buttons.
- `resetHuntForNewPromo()`: starts over. It deletes the Ecwid coupons the hunt created, clears every claim and empties the log sheet. This can't be undone.

After pasting a new version of the script, deploy a **new version of the existing web-app deployment** (Deploy → Manage deployments → edit → New version). Otherwise Vercel keeps talking to the old code.

## Local development

`node tools/easter-hunt-preview.cjs` serves the storefront pages at <http://127.0.0.1:4173> with a simulated backend (`easter-hunt/service.js`). No coupons or emails are created.

## Files

| Files | Purpose |
| --- | --- |
| `easter-hunt/config.js` | Deadline and the twelve sticker locations |
| `easter-hunt/boot.js`, `hunt.js`, `hunt.css`, `experience.js` | Loader, stickers, claim dialogs, header counter, intro |
| `api/v1/easter-hunt.js` | Availability, claims and dashboard API (`RRHS_HUNT_ENABLED` switch) |
| `apps-script/teacher-preorder-verification.gs` | Reward pool, coupons, emails, log sheet, dashboard sign-in |
| `tools/easter-hunt/` | Dashboard page |
| `tools/easter-hunt-preview.cjs`, `easter-hunt/service.js` | Local simulator |

## Tests

```sh
node --test
```

`test/hunt-live.test.js` covers the claim rules, coupons, email retries, the env switch and dashboard sign-in. All tests use fake Ecwid, mail and storage, so they make no live writes.

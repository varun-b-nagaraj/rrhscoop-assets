# Hidden package hunt

Twelve dragon stickers hidden around the CO-OP website. A student who finds one enters their S-number and gets a mystery 10–35% off coupon, emailed to their school inbox.

## Turning it on and off

The **only** switch is the Vercel environment variable `RRHS_HUNT_ENABLED`:

- `true` turns the hunt on for every visitor.
- Any other value, or no value, turns it off for everyone. The API then reports `disabled` and refuses claims.

Vercel applies an environment variable change only to new deployments. After changing it, redeploy (Deployments → ⋯ → Redeploy). Pages pick up the change within about 30 seconds of the deploy.

To stop claims temporarily without redeploying, use **Pause hunt** on the dashboard.

## How a claim works

1. The website asks `/api/v1/easter-hunt` for availability. Vercel caches the answer for 10 seconds.
2. The student enters their S-number. The API forwards the claim to the Apps Script web app (`RRHS_CFA_VERIFICATION_URL`).
3. Under its script lock, the Apps Script:
   - checks the hunt window (Nov 9 – Fri Nov 13, 11:59 PM Central);
   - checks one reward per student and one per sticker;
   - draws from the shared pool: 10% ×4, 15% ×3, 20% ×2, 25% ×2, 35% ×1;
   - creates a single-use, uncapped percent-off Ecwid coupon (`RRHSHUNT-…`);
   - records the claim, then emails the code to `S-number@student.roundrockisd.org`.
4. The website sees only the percentage, never the code.
5. If the email fails, the minute job (`runCoopJobs`) retries it, up to 5 attempts.

## Dashboard and logs

<https://rrhscoop-assets.vercel.app/easter-hunt/dashboard>

- **Sign-in:** a 6-digit code is emailed to an approved address (`HUNT_ADMINS` in the Apps Script). The session lasts 12 hours.
- **What it shows:** status, rewards left, every claim with its coupon code and email status, sticker status, and the event log.
- **Pause / Resume** stops or restarts claims without losing records.
- **Where logs are stored:** every claim, refusal, email, retry, sign-in and pause is appended to the Google Sheet **"RRHS CO-OP package hunt log"** in the script owner's Drive. Claims are also kept in Script properties (`hunt_live_state`), so the dashboard works even if the sheet is unavailable.

Apps Script editor actions:
- `setupHuntLog()`: run once. It authorizes Google Sheets and creates the log.
- `showHuntClaims()`: logs every claim.
- `pauseHunt()` / `resumeHunt()`: same as the dashboard buttons.

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

# Hidden package hunt

Twenty dragon stickers hidden around the CO-OP website, one per page (the long Teacher Hub has a top and a bottom one). A student who finds one enters their S-number (or staff enter their `@roundrockisd.org` email) and gets a percent-off coupon, emailed to that school inbox. One reward per person. The deeper the page, the bigger the reward:

| Reward | Stickers |
| --- | --- |
| 10% ×7 | Product pages: Snacks, Drinks, Long Sleeves, T-Shirts, Accessories, School Supplies, Merchandise |
| 15% ×6 | Home (Why the CO-OP), Teacher Hub top, Leadership, FAQ, Chick-fil-A, About us |
| 20% ×4 | Student Projects · Inventory Intelligence, 2025–26 Leadership, Teacher Hub bottom, Payment methods |
| 25% ×2 | Shipping & returns, Terms & Conditions |
| 35% ×1 | Privacy policy (Customers' Rights) |

Placements are in `easter-hunt/config.js`; rewards are in `easter-hunt/rules.js` (a test keeps the two in step).

## Who controls what

| Piece | Job |
| --- | --- |
| **Vercel env** | Every decision. `RRHS_HUNT_ENABLED` turns it on/off, `RRHS_HUNT_PROMO_ID` names the promo. |
| **Neon** (project "Digital Pass CO-Op", schema `hunt`) | Every claim, coupon code, email status, dashboard session and the event log. |
| **Apps Script** | Only sends email (reward codes, dashboard sign-in codes) through a signed relay, and pings Vercel each minute to retry anything pending. It stores nothing about the hunt and cannot reset or pause it. |

Vercel env variables (production):

- `RRHS_HUNT_ENABLED`: `true` turns the hunt on for everyone; anything else turns it off.
- `RRHS_HUNT_PROMO_ID`: the promo's name. A new ID starts a completely empty hunt.
- `RRHS_HUNT_DATABASE_URL`: Neon pooled connection string.
- `RRHS_HUNT_SECRET`: encrypts S-numbers and codes at rest.
- `RRHS_HUNT_RELAY_SECRET`: signs mail requests; the same value goes in the Apps Script's Script properties.
- Optional: `RRHS_HUNT_STARTS_AT`, `RRHS_HUNT_EXPIRES_AT`, `RRHS_HUNT_ADMINS` (comma-separated).

Vercel applies an env change only to new deployments: redeploy after changing one.

## Resetting

Run from the repo (it reads `.env`):

```sh
node tools/hunt-db.cjs status
node tools/hunt-db.cjs reset --confirm 2026-11-dragon-hunt
```

Reset deletes this promo's Ecwid coupons, clears every claim and the log, and frees all twenty dragons. Open pages notice within a few seconds. It also deletes any coupons left by the old Apps Script hunt and clears its saved data.

## How a claim works

1. Pages ask `/api/v1/easter-hunt` for availability every 5 seconds (Vercel caches it for 2 seconds). Once anyone claims a dragon, everyone sees it greyed out under a magnifying glass.
2. The student enters their S-number (staff: their `@roundrockisd.org` email). There is no extra code step: the reward only ever goes to that person's school inbox.
3. Vercel locks the promo row in Neon, checks one reward per person and one per dragon, and saves the claim before anything else happens.
4. Vercel creates a single-use, percent-off Ecwid coupon (`RRHSHUNT-…`), then asks Apps Script to email it.
5. If Ecwid or email fails, the claim stays saved and the minute job retries with the same code, up to 10 times.
6. The website sees only the percentage, never the code.

## Dashboard

<https://rrhscoop-assets.vercel.app/easter-hunt/dashboard>

Sign in with a 6-digit code emailed to an approved address; the session lasts 12 hours. It shows status, rewards left, every claim with its code and email status, each sticker with a screenshot of where it hides, and the event log. Screenshots live in `api/v1/_hunt-locations/` (retake with `node tools/capture-hunt-locations.mjs`).

## Apps Script setup (once)

1. Paste `apps-script/teacher-preorder-verification.gs` into the project.
2. Project Settings → Script properties: add `RRHS_HUNT_RELAY_SECRET` with the same value as in Vercel.
3. Deploy → Manage deployments → edit → **New version**.
4. Check it with `node tools/hunt-db.cjs relay-check`.

## Dev mode (fake codes)

Test the whole hunt on the real website, in your browser only, without touching the real promo:

- Turn on: add `?hunt-dev=on` to any page address, or run `rrhsHunt.dev()` in the DevTools console.
- Turn off: `?hunt-dev=off`, `rrhsHunt.dev(false)`, or **Turn off** on the yellow badge in the bottom-left corner.
- Clear fake claims: **Reset claims** on the badge, or `rrhsHunt.reset()`.

Dev mode shows all 20 stickers even when `RRHS_HUNT_ENABLED` is off. Claims stay in that browser and show a `FAKE-…` code on screen. No coupon is created, no email is sent, and nothing is claimed on the server. The rules still apply: one claim per person, and a found sticker goes under the magnifying glass.

## Local development

`node tools/easter-hunt-preview.cjs` serves the storefront pages at <http://127.0.0.1:4173> with a simulated backend (`easter-hunt/service.js`). No coupons or emails are created.

## Files

| Files | Purpose |
| --- | --- |
| `easter-hunt/config.js` | Deadline and the twenty sticker locations |
| `easter-hunt/boot.js`, `hunt.js`, `hunt.css`, `experience.js` | Loader, stickers, claim dialogs, header counter, intro |
| `api/v1/easter-hunt.js`, `api/v1/hunt-jobs.js` | Availability, claims, dashboard API; minute retries |
| `easter-hunt/live.js`, `rules.js`, `db.js`, `secure.js`, `integrations.js` | Claim rules on Neon, rewards, encryption, Ecwid and mail relay |
| `migrations/`, `tools/hunt-db.cjs` | Neon schema; migrate, status and reset commands |
| `apps-script/teacher-preorder-verification.gs` | Signed mail relay only |
| `tools/easter-hunt/` | Dashboard page |
| `tools/easter-hunt-preview.cjs`, `easter-hunt/service.js` | Local simulator |

## Tests

```sh
node --test
```

`test/hunt-live.test.js` runs the claim rules, coupons, retries, reset, the env switch and dashboard sign-in against an in-memory Postgres (PGlite) with fake Ecwid and mail, so it makes no live writes.

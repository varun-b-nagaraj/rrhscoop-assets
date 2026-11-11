# rrhscoop-assets

Static assets + client-side scripts used by the RRHS COOP Ecwid storefront embed.

## Hidden package hunt (development preview)

Run `node tools/easter-hunt-preview.cjs` and open `http://127.0.0.1:4173`.
Enable the preview from DevTools with `window.RRHSOVERIDE = true`; set it to
`false` to hide it again. The override stays in the current tab across navigation.
One package beside Inventory Intelligence supports the full simulated discovery
flow. No coupons or emails are created. Live claims remain disabled by a plain
boolean and a closed server endpoint. See [the hunt setup notes](easter-hunt/README.md)
for preview controls, Apps Script instructions, tests, and live-launch blockers.

## Runtime (Performance)

File: `rrhs-runtime.js` 

When you embed `index.js`, it loads `rrhs-runtime.js` first. This provides a shared DOM-change observer + shared interval scheduler so multiple RRHS scripts don’t each create their own `MutationObserver`/timers.

## Checkout Script

File: `check-out-page/rrhscoop-checkout.js`

### Day Type Source (Primary)

Day type is now sourced from HAC `getDayType` API as the primary source of truth.
The checkout script uses this to decide A/B day, then applies existing period time windows to determine current period (`1-4` on A day, `5-8` on B day).

Set these runtime values from deployment env:

- `RRHS_DAY_TYPE_API_URL`
- `RRHS_HAC_BASE_URL`
- `RRHS_HAC_USERNAME`
- `RRHS_HAC_PASSWORD`

The script reads them from globals (`window.<NAME>`) or `window.RRHS_ENV.<NAME>`.

Note: HAC login/switch UI flows are intentionally disabled by default (`RRHS_HAC_UI_ENABLED = false`), so only day-type sync remains active.

### Inventory Guard (variation-aware)

File: `check-out-page/rrhs-inventory-guard.js`

**Currently disabled** (`inventoryGuardEnabled = false` in `index.js`), so low-stock items can be ordered. Flip the flag to re-enable.

- Runs `Ecwid.Cart.get()` on page load and listens to `Ecwid.OnCartChanged`.
- Checks cart items against Ecwid REST inventory endpoints.
- Uses variation-level lookup when `item.product.variation` exists.
- Removes blocked lines from cart and shows a modal when available stock is below threshold.

Expected runtime config object:

```js
window.RRHS_INVENTORY_GUARD_CONFIG = {
  storeId: "YOUR_STORE_ID",
  apiToken: "YOUR_ECWID_BEARER_TOKEN",
  minRemainingAllowed: 5, // block item if quantity < this number
  apiBase: "https://app.ecwid.com/api/v3"
};
```

Project `.env` placeholders were added for these values:
- `RRHS_ECWID_STORE_ID`
- `RRHS_ECWID_API_TOKEN`
- `RRHS_INVENTORY_MIN_REMAINING`
- `RRHS_ECWID_API_BASE`

### Graduation Stole S-number Drawer

File: `check-out-page/rrhs-stole-drawer.js`

- Adds a right-side slide-out drawer with an arrow toggle.
- Saves the entered S-number immediately in `localStorage`.
- Looks up assigned stole products from local JSON data (`window.RRHS_STOLE_CONFIG.assignmentData` or built-in defaults).
- Fetches the live stole product list from Ecwid category `169641234`.
- Excludes the legacy matrix product with SKU `48_sku_main`.
- Shows assigned stoles first, then requires a checkbox + button click before adding them to cart.
- Uses Ecwid Storefront JS to remove unauthorized stole products and keep allowed stole products capped at quantity `1` each.
- If no mapping exists for the entered S-number, all stole products are removed and the drawer shows: `No stole found for you please contact your counselor.`

Example runtime override:

```js
window.RRHS_STOLE_CONFIG = {
  assignmentData: {
    s151579: ["Business and Industry (Gold)", "STEM (Yellow)"]
  }
};
```

### Ordering Period Matrix (Allowed Periods)

To restrict (or expand) which class periods can place orders, edit the matrix in:

- `check-out-page/rrhscoop-checkout.js` → `RRHS_ORDERING_PERIOD_MATRIX`

Current setting is **every period except 3rd and 7th**:
- A Day: `A: [1, 2, 4]`
- B Day: `B: [5, 6, 8]`

Empty lists for both days close regular ordering site-wide (shows the maintenance message).

Notes:
- The checkout UI always displays the *actual* period number (so B Day will show `Period 5` / `Period 6`, not `Period 1/5`).
- On B Day you can specify either base periods `1`–`4` (auto-mapped to `5`–`8`) or specify `5`–`8` directly.

### Room Schedule CSV

The checkout script loads room/teacher schedule data from:

- `check-out-page/schedule_processed.xlsx - Room Schedule.csv`

If you host these assets on Vercel (or anywhere else) and see a 404 for the CSV, you can override the URL from DevTools:

```js
window.RRHS_ROOM_SCHEDULE_CSV_URL = "https://<your-domain>/check-out-page/schedule_processed.xlsx%20-%20Room%20Schedule.csv";
```

### Session-Only DevTools Overrides

The checkout script exposes `window.RRHS_OVERRIDES` for **your current tab only** (stored in `sessionStorage`). These are intended for admins/testing from DevTools.

```js
RRHS_OVERRIDES.help();
RRHS_OVERRIDES.get();
RRHS_OVERRIDES.reset();
RRHS_OVERRIDES.getActive()
```

**Always allow checkout (bypass delivery windows):**

```js
RRHS_OVERRIDES.setAlwaysAllow(true);
RRHS_OVERRIDES.setAlwaysAllow(false);
```

**Simulate day/time (admin testing)**

These are **in-memory only** and reset when you refresh the page.

```js
RRHS_OVERRIDES.setSimDayType("A"); // force A Day
RRHS_OVERRIDES.setSimDayType("B"); // force B Day
RRHS_OVERRIDES.setSimDayType(null); // back to real isADay()

RRHS_OVERRIDES.setSimDate("2026-03-22"); // force date used for day-type + window checks
RRHS_OVERRIDES.setSimDate(null); // back to real date
// Changing sim date forces a fresh day-type API lookup for that date.

RRHS_OVERRIDES.setSimTime("10:00"); // force "now" to 10:15
RRHS_OVERRIDES.setSimTime(null); // back to real clock
```

**Change delivery-window close delta (minutes before period end):**

```js
RRHS_OVERRIDES.setCloseDeltaMinutes(15); // default behavior (ordering closes 15 min before bell)
```

**Override bell schedule base periods (periods 5–8 mirror via p-4):**

```js
RRHS_OVERRIDES.setBasePeriodWindow(1, "09:00", "10:40");
RRHS_OVERRIDES.setBasePeriodWindow(2, "10:40", "12:12");
RRHS_OVERRIDES.setBasePeriodWindow(3, "12:12", "13:59");
RRHS_OVERRIDES.setBasePeriodWindow(4, "14:47", "16:20");
```

## Ecwid Service Charge (server-side `discountUrl`)

This repo includes a production-ready Vercel Serverless Function that returns **exactly one** dynamic surcharge line item using Ecwid’s official server-side cart calculation hook (`discountUrl`).

### Endpoint

- Versioned path (recommended for Ecwid): `https://<your-domain>/v1/ecwid/discount-url`
- Implementation (Vercel function): `api/v1/ecwid/discount-url.js`
- Shared calculation logic: `check-out-page/checkout-charges.js`
- Configure this URL as your Ecwid `discountUrl` (cart calculation hook) in the Ecwid admin.

### Calculation

- Uses `cart.subtotal` (pre-tax, pre-shipping)
- `fee = round_to_cents(subtotal * 0.029 + 0.30)`
- If cart is empty / subtotal `<= 0` / fee `< 0.01` → returns `{"surcharges":[]}`

### Environment variables (optional)

- `RRHS_CUSTOM_PRICING_ENABLED`: Set to `true` to enable server-calculated surcharges/discounts. Default: disabled (`false`).
- `DISCOUNT_URL_SHARED_SECRET`: If set, require `?token=<secret>` (or `Authorization: Bearer <secret>` / `X-Discount-Secret`) on requests.
- `EXCLUDED_COUPON_CODES`: Comma-separated list of coupon codes that disable the surcharge (default: `ECOMMERCE`).
- `TARGET_PAYMENT_METHODS`: Comma-separated allowlist (exact string match). If set and not matched, returns no surcharge.

### Reliability notes

- No external calls; should respond well under Ecwid’s 5-second limit.
- Structured logs include `storeId`, `cartId`, `subtotal`, `computedFee`, `paymentMethod`.
- In-memory cache (≤ 60s TTL) keyed by `(storeId, cartId, subtotal, paymentMethod)`.

### Tests

Run unit tests (Node 18+):

```bash
node --test
```

## Hosted storefront CSS

`custom-visuals/rrhs-site.css` contains the CSS formerly pasted into Ecwid's custom
CSS editor. The existing `index.js` embed loads it automatically. Once these assets
are deployed, remove that duplicated CSS from Ecwid. No additional stylesheet
embed is needed. Bump the stylesheet's query version in `index.js` when editing it.

## Teacher Information embed

The faculty landing page is in `iframes/teachers/`. Paste the full contents of
`iframes/teachers/embed.html` into an HTML block on the Teacher Information page.
It loads the hosted page, resizes to its content, and scrolls the parent page to
sections selected in the guide navigation. The message bridge checks the iframe's
origin and source. Google Forms open in a new tab; the shop link opens the main site.

The page uses the shared Playfair Display / Spectral theme, the guide's faculty and
blue-pass information, and the actual form links from the supplied email. Photo
credits, source links, and the preorder prices checked during implementation are
recorded in `iframes/teachers/ASSETS.md`. The paste-once embed loads its parent-page
bridge from `iframes/teachers/embed.js`. Hosting headers require revalidation for
the teacher files and shared theme CSS, so future deployed changes appear when the
host page opens or refreshes. No embed version edits are required. The hosted
bridge also passes the available viewport height to the page so the hero and guide
navigation fill the opening view without sizing against the full iframe height.
It recalculates when late-loaded banners or other host-page layout changes move
the iframe, and reduces hero spacing on shorter desktop viewports.
On small screens or when the content needs more room, the page scrolls naturally.

### Embed sizing and pass links

`custom-visuals/rrhs-embed-bridge.js` loads before the storefront scripts. It listens
for height messages from the current hosted frames, including frames inserted during
page navigation, and requests fresh measurements after load, resize, visibility
changes, and page restoration. Each content embed loads `iframes/embed-resize.js`
to remeasure after delayed images, fonts, content changes, and disclosure toggles.
The iframe files revalidate on subsequent visits, so existing pasted embeds receive
these fixes without replacing their HTML. The home hero keeps its viewport sizing.

The teacher pass section has two links with hover and keyboard-focus info tooltips. The request
form and dashboard navigate through the parent bridge because the storefront's
iframe sandbox blocks opening new tabs. The bridge checks the sending frame's
origin and source and allows only those two destinations.

## Faculty Chick-fil-A preorders

Paste [the preorder embed](iframes/teachers/chick-fil-a/embed.html) into the custom
HTML block on the Ecwid page at `/teachers/chick-fil-a`. The Teacher Hub links to
that page. The iframe allows forms, scripts, payment permissions, and user-initiated
navigation for payment providers.

The three menu prices come from Ecwid. Orders placed before 4 p.m. Central use
the next instructional A/B day in `check-out-page/aday-bday.json`. At 4 p.m.
or later, scheduling starts two calendar days out and skips non-school days.
An order can include up to ten packets of each sauce. The order comments carry the delivery date, room, time,
verified email, and sauces into Ecwid.

### Connect district email

1. Copy [the combined script](apps-script/teacher-preorder-verification.gs)
   into the Apps Script project owned by the district sending account.
2. Deploy a new version of the web app that runs as the district account with
   access set to Anyone. Apps Script generates its own key to store email codes.
3. Keep `RRHS_CFA_VERIFICATION_URL` in Vercel pointing to the deployed `/exec` URL.
   Vercel uses its existing `RRHS_CFA_VERIFICATION_SECRET` to sign browser
   sessions. That value stays in Vercel.

A six-digit code proves access to an `@roundrockisd.org` mailbox. It does not look
up employment records. The browser can remember the signed verification for 30 days.

### Enable Ecwid checkout

Ecwid's existing checkout calculates tax and delivery charges and accepts payment.
Apple Pay availability depends on the enabled gateway, device, and iframe policy.

After deploying the storefront cart guard, run
`node tools/configure-cfa-preorders.cjs --apply` with the store credentials in
`.env`. It enables Ecwid's out-of-stock preorder feature, allows preorders for
the three faculty items, and excludes them from discounts. Without `--apply`,
the script only inspects the settings.

Test with a district address and a supported payment device before announcing the
page. Confirm that the order appears in Ecwid with its room, delivery date, and
sauces, and that a regular cart containing any of the three SKUs cannot continue.
The regular cart restriction runs in the storefront. It is not an Ecwid
server-side product access rule.

### Set up dispatch and receipts in the same Apps Script project

Use [the combined Apps Script](apps-script/teacher-preorder-verification.gs) in the
existing district verification project. Keep the existing
`RRHS_ECWID_STORE_ID` and `RRHS_ECWID_API_TOKEN` in Script properties. Apps
Script reads orders and downloads receipt PDFs directly from Ecwid.

Deploy the Apps Script update before the corresponding Vercel code update.
### Customer emails (replaces Ecwid's customer notifications)

The minute trigger sends every customer email, so Ecwid's built-in customer
notifications can stay off:

- **Order confirmation / receipt** (`sendPendingReceipts`): a receipt for paid
  orders, an "Order received · Payment pending" confirmation for unpaid orders,
  and the receipt once a confirmed unpaid order is paid.
- **Status updates** (`sendOrderStatusUpdates`): one email when staff change an
  order to Processing, Shipped/Out for delivery, Ready for pickup, Delivered,
  Will not deliver, or Returned, when a tracking number is added, when a refund
  is issued, and when an order is cancelled. Only the latest change is sent if
  several land in the same minute. Orders with customer notifications disabled
  in Ecwid are skipped.

The status job records existing orders on its first run without emailing anyone.
`sendTestStatusEmails` emails you a `[Preview]` of each status email built from
the latest order. The store has no downloadable products, so Ecwid's "Download
e-goods" email has no replacement.

Run `checkCoopSetup` to verify Ecwid access without sending mail. Existing
combined triggers continue with the saved script. For a new install, remove
any separate receipt trigger, then run `setup` in the combined project.

The dispatch goes to the two student dispatchers on the first run at or after
4:05 p.m. Central. It includes faculty preorders placed from the previous day's
4 p.m. cutoff up to the current day's 4 p.m. cutoff, with payment status labeled.
`sendCfaDispatchPreview` emails a fictional
sample to the Gmail test inbox. `sendTestReceipt` sends the latest paid receipt
to the Apps Script editor's signed-in account.

### Faculty pickup and pay at pickup

The preorder page offers classroom delivery with online payment or scheduled
pickup at the RRHS CO-OP. The fulfillment drawer uses the scheduled school day
and offers pickup times from the Ecwid pickup method's hours. Ecwid lets pickup
customers pay online or choose **Pay at pickup**. In Ecwid, keep
that offline payment method restricted to the CO-OP pickup shipping method.

The combined script sends a pickup confirmation with the balance due, then a paid
receipt after staff mark the order paid. The daily dispatch includes pickup times
and payment status.

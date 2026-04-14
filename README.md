# rrhscoop-assets

Static assets + client-side scripts used by the RRHS COOP Ecwid storefront embed.

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
- Uses Ecwid Storefront JS to keep only the assigned stole products in the cart, capped at quantity `1` each.
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

Default behavior is **only the first two delivery windows**:
- A Day: `A: [1, 2]`
- B Day: `B: [1, 2]` (base periods that map to Periods `5, 6`)

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

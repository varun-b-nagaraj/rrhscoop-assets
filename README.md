# rrhscoop-assets

Static assets + client-side scripts used by the RRHS COOP Ecwid storefront embed.

## Runtime (Performance)

File: `rrhs-runtime.js`

When you embed `index.js`, it loads `rrhs-runtime.js` first. This provides a shared DOM-change observer + shared interval scheduler so multiple RRHS scripts don’t each create their own `MutationObserver`/timers.

## Checkout Script

File: `check-out-page/rrhscoop-checkout.js`

### Ordering Period Matrix (Allowed Periods)

To restrict (or expand) which class periods can place orders, edit the matrix in:

- `check-out-page/rrhscoop-checkout.js` → `RRHS_ORDERING_PERIOD_MATRIX`

Default behavior is **only Period 1–2 on A days** and **only Period 5–6 on B days**. To add more later, extend the arrays with period numbers `1`–`8`.

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

RRHS_OVERRIDES.setSimTime("10:15"); // force "now" to 10:15
RRHS_OVERRIDES.setSimTime(null); // back to real clock
```

**Change delivery-window close delta (minutes before period end):**

```js
RRHS_OVERRIDES.setCloseDeltaMinutes(20); // default behavior
```

**Override bell schedule base periods (periods 5–8 mirror via p-4):**

```js
RRHS_OVERRIDES.setBasePeriodWindow(1, "09:00", "10:40");
RRHS_OVERRIDES.setBasePeriodWindow(2, "10:40", "12:12");
RRHS_OVERRIDES.setBasePeriodWindow(3, "12:12", "13:59");
RRHS_OVERRIDES.setBasePeriodWindow(4, "14:47", "16:20");
```

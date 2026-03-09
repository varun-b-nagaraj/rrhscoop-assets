/* rrhscoop-checkout.js - extracted checkout & cart logic */
(function () {
  const RRHS_DEBUG =
    (typeof window !== "undefined" &&
      (window.RRHS_DEBUG === true ||
        (typeof localStorage !== "undefined" &&
          localStorage.getItem("RRHS_DEBUG") === "1"))) ||
    false;

  const log = (...args) => {
    if (RRHS_DEBUG) console.log(...args);
  };

  // ---------------------------
  // Frequently edited settings
  // ---------------------------
  // A/B day reference (YYYY-MM-DD). This date is treated as an "A Day".
  const REFERENCE_A_DAY = "2026-02-24";

  // Emergency bypass (ignores day/period windows).
  const CHECKOUT_ALWAYS_ALLOW = false;

  // Room schedule source (served from this repo's assets unless RRHS_ROOM_SCHEDULE_CSV_URL is set).
  const ROOM_SCHEDULE_CSV_FILENAME = "schedule_processed.xlsx - Room Schedule.csv";

  // Room field lock value used when a product rule says to auto-fill/lock the room field.
  const RRHS_LOCKED_ROOM_SENTINEL =
    "Room number already specified on Valentine's Order, this field does not need to be filled out";

  // Default "ordering closes N minutes before bell" (can be overridden in sessionStorage).
  const RRHS_DEFAULT_CLOSE_DELTA_MINUTES = 15;

  // Room filtering (applies to values coming from the schedule CSV).
  // Examples (default):
  // - Valid: 1003, 1241, 1314, 1430, 2312, 208
  // - Invalid: 143 (3 digits), 725 (3 digits), Gym (non-numeric)
  const RRHS_ROOM_FILTER = Object.freeze({
    enabled: true,
    // Rules are OR'ed together. A room is allowed if it matches any rule.
    // - `digits` is the exact room number length to allow (digits only).
    // - `prefixDigits` is how many leading digits to compare against `allowedPrefixes`.
    rules: Object.freeze([
      // 4-digit rooms: 1000s–1500s and 2200s–2500s (prefix is first two digits).
      { digits: 4, prefixDigits: 2, allowedPrefixes: Object.freeze([11, 12, 13, 14, 15, 22, 23, 24, 25]) },
      // 3-digit rooms: 200s (prefix is first one digit).
      //{ digits: 3, prefixDigits: 1, allowedPrefixes: Object.freeze([2]) }
      // To also allow 700s later, add:
      // { digits: 3, prefixDigits: 1, allowedPrefixes: Object.freeze([7]) }
    ])
  });
  const RRHS_STUDENT_ROOM_FILTER = Object.freeze({
    enabled: true,
    rules: Object.freeze([
      { digits: 4, prefixDigits: 2, allowedPrefixes: Object.freeze([11, 12, 13, 14, 15, 22, 23, 24, 25]) }
    ])
  });

  // Special delivery locations (appear in the room dropdown even if not in the schedule CSV).
  // These are string values that will be written into the room input when selected.
  const RRHS_SPECIAL_DELIVERY = Object.freeze({
    enabled: true,
    headerLabel: "Special Locations (Delivered to front counter)",
    alphaOffice: Object.freeze({
      enabled: true,
      groupLabel: "Alpha Office",
      rooms: Object.freeze([200, 1300, 1400, 1500]),
      roomLabelSuffix: "Alpha Office"
    }),
    locations: Object.freeze([
      Object.freeze({
        id: "front_desk",
        label: "Front Desk",
        roomValue:
          "Front Desk"
      }),
      Object.freeze({
        id: "library",
        label: "Library",
        roomValue: "Library"
      })
    ])
  });

  // Period-by-period bell schedule (base periods 1–4). B-day periods map to 5–8 automatically.
  const BASE_PERIOD_WINDOWS = Object.freeze({
    1: { start: "09:00", end: "10:32" },
    2: { start: "10:40", end: "12:12" },
    3: { start: "12:20", end: "14:39" },
    4: { start: "14:47", end: "16:20" }
  });

  // Controls which period numbers (1–8) are eligible for ordering, by day type.
  // For B Day, you can write either [1,2] meaning "base" -> 5/6, or [5,6] explicitly.
  const RRHS_ORDERING_PERIOD_MATRIX = Object.freeze({
    A: [1, 2],
    B: []
  });

  // Base origin used for product links shown in modals/tooltips.
  const RRHS_SITE_ORIGIN = "https://rrhscoop.roundrockisd.org";

  // Products that are allowed to checkout outside delivery windows (all-day).
  // If the cart contains *only* these products, checkout is allowed any time.
  // If the cart mixes these + regular items, checkout is blocked to prevent bypassing windows.
  //
  // For each product, set any of: sku, name, urlPath to identify it.
  // - `lockRoom: true` will lock the delivery room field to `roomSentinel`.
  const RRHS_ALL_DAY_DELIVERY_PRODUCTS = Object.freeze([
    {
      label: "Valentine's Day Flowers",
      sku: "703_sku",
      name: "Valentine's Day Flowers",
      urlPath: "/products/Valentines-Day-Flowers-p813923050",
      lockRoom: true,
      roomSentinel: RRHS_LOCKED_ROOM_SENTINEL
    }
  ]);
  const RRHS_EMPLOYEE_FIELD_NAME = "pvhvhag";
  const RRHS_EMPLOYEE_STORAGE_KEY = "rrhs_employee_id_v1";
  // Legacy toggle kept for compatibility. Employee-id prefix is no longer used for access decisions.
  const RRHS_EMPLOYEE_WINDOW_BYPASS_ENABLED = false;

  // Link used in the "site closed" message when RRHS_ORDERING_PERIOD_MATRIX disables all windows.
  const RRHS_FLOWERS_PREORDER_URL_FULL = `${RRHS_SITE_ORIGIN}/products/Valentines-Day-Flowers-p813923050`;

  // Message shown when all delivery windows are disabled (matrix empty).
  const RRHS_CLOSED_MESSAGE_HTML = `The website is temporarily unavailable for regular orders due to maintenance. Thank you for your patience — service will resume on February 18th.`;

  const rrhsUiRefreshers = [];
  let rrhsLastDayType = null;
  let rrhsLastOverrideSignature = null;

  // In-memory simulation overrides (reset on refresh)
  const rrhsSim = {
    dayType: null, // "A" | "B" | null
    nowMinutes: null // number (0..1439) | null
  };

  function rrhsRunInBackground(fn, timeoutMs = 2000) {
    if (typeof fn !== "function") return;
    try {
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(() => fn(), { timeout: Math.max(0, Number(timeoutMs) || 0) });
        return;
      }
    } catch (e) {}
    setTimeout(fn, 0);
  }

  function rrhsGetOverrideSignature() {
    const ss = rrhsGetSessionStorage();
    if (!ss) return null;
    const alwaysAllow = ss.getItem("RRHS_ALWAYS_ALLOW");
    const closeDelta = ss.getItem("RRHS_CLOSE_DELTA_MINUTES");
    const baseWindows = ss.getItem("RRHS_BASE_PERIOD_WINDOWS");
    return `${alwaysAllow || ""}|${closeDelta || ""}|${baseWindows || ""}`;
  }

  function rrhsInvalidateDerivedSchedule() {
    rrhsDerivedSchedule.dayType = null;
    rrhsDerivedSchedule.period = null;
    rrhsDerivedSchedule.teacherNames = [];
    rrhsDerivedSchedule.teacherToEntries = Object.create(null);
    rrhsDerivedSchedule.roomToEntries = Object.create(null);
    rrhsDerivedSchedule.allEntries = [];
    rrhsDerivedSchedule.allEntriesByRoom = [];
  }
// ---------------------------
  // Auto-fill & hide address fields (backend only, never visible)
  // ---------------------------
  const RRHS_AUTOFILL_ADDRESS = Object.freeze({
    "address-line1": "201 Deep Wood Drive",
    "city":          "Round Rock",
    "zip":           "78681",
    "province":      "TX",
    "country-list":  "US"
  });

  // Inject a <style> tag so the rows are hidden via CSS before JS even runs
  (function rrhsInjectAddressHideStyles() {
    if (document.getElementById("rrhs-address-hide-styles")) return;
    const style = document.createElement("style");
    style.id = "rrhs-address-hide-styles";
    style.textContent = `
      /* Hide address rows — autofilled on backend, never shown to user */
      .ec-form__cell--street,
      .ec-form__cell--city,
      .ec-form__cell--postalcode,
      .ec-form__cell--state,
      .ec-form__cell--country,
      .ec-form__row:has(.ec-form__cell--street),
      .ec-form__row:has(.ec-form__cell--city),
      .ec-form__row:has(.ec-form__cell--postalcode),
      .ec-form__row:has(.ec-form__cell--state) {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        min-height: 0 !important;
        overflow: hidden !important;
        margin: 0 !important;
        padding: 0 !important;
        pointer-events: none !important;
      }
      /* Hide country field */
      .ec-form__cell--country,
      .ec-form__cell--country * {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        min-height: 0 !important;
        overflow: hidden !important;
        margin: 0 !important;
        padding: 0 !important;
        pointer-events: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  })();

  function rrhsFillAndHideAddressFields() {
    // Street / city / zip / state
    const fieldSelectors = [
      'input[name="address-line1"]',
      'input[name="city"]',
      'input[name="zip"]',
      'select[name="province"]',
      'select[name="country-list"]'
    ];

    fieldSelectors.forEach((sel) => {
      const el = document.querySelector(sel);
      if (!el) return;

      const fieldName = el.name;
      const fillValue = RRHS_AUTOFILL_ADDRESS[fieldName];
      if (fillValue === undefined) return;

      // Always force our value — override anything the user or Ecwid may have set
      if (el.value !== fillValue) {
        el.value = fillValue;
        el.dispatchEvent(new Event("input",  { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }

      // Sync the paired read-only display input (Ecwid pattern for selects)
      const container = el.closest(".form-control--select");
      if (container) {
        const readonlyInput = container.querySelector('input[readonly]');
        if (readonlyInput) {
          const chosen = el.options[el.selectedIndex];
          if (chosen) readonlyInput.value = chosen.text;
        }
      }

      // Belt-and-suspenders: also hide the nearest row/cell via inline style
      const targets = [
        el.closest(".ec-form__row"),
        el.closest(".ec-form__cell--street"),
        el.closest(".ec-form__cell--city"),
        el.closest(".ec-form__cell--postalcode"),
        el.closest(".ec-form__cell--state"),
        el.closest(".ec-form__cell--country")
      ].filter(Boolean);

      targets.forEach((node) => {
        node.style.setProperty("display",         "none",   "important");
        node.style.setProperty("visibility",      "hidden", "important");
        node.style.setProperty("height",          "0",      "important");
        node.style.setProperty("min-height",      "0",      "important");
        node.style.setProperty("overflow",        "hidden", "important");
        node.style.setProperty("margin",          "0",      "important");
        node.style.setProperty("padding",         "0",      "important");
        node.style.setProperty("pointer-events",  "none",   "important");
      });
    });

    // Extra: prevent user from ever changing these fields via direct manipulation
    fieldSelectors.forEach((sel) => {
      const el = document.querySelector(sel);
      if (!el || el.dataset.rrhsAddressLocked === "1") return;
      el.dataset.rrhsAddressLocked = "1";
      el.addEventListener("change", (e) => {
        const fn = el.name;
        const locked = RRHS_AUTOFILL_ADDRESS[fn];
        if (locked !== undefined && el.value !== locked) {
          el.value = locked;
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
        e.stopImmediatePropagation();
      }, true);
      el.addEventListener("input", (e) => {
        const fn = el.name;
        const locked = RRHS_AUTOFILL_ADDRESS[fn];
        if (locked !== undefined && el.value !== locked) {
          el.value = locked;
        }
        e.stopImmediatePropagation();
      }, true);
    });
  }

  // Run immediately, on every UI refresh, and on every DOM mutation
  rrhsFillAndHideAddressFields();
  rrhsUiRefreshers.push(rrhsFillAndHideAddressFields);

  const _addrObserver = new MutationObserver(rrhsFillAndHideAddressFields);
  if (document.body) {
    _addrObserver.observe(document.body, { childList: true, subtree: true });
  }
  
  function rrhsRefreshEverything(reason = "") {
    try {
      const todayDay = getTodayDayType();
      const currentPeriod = rrhsGetCurrentOrNextPeriodForToday();
      const dayOrPeriodChanged =
        rrhsLastDayType !== todayDay ||
        (rrhsDerivedSchedule.period !== null && rrhsDerivedSchedule.period !== currentPeriod);
      if (dayOrPeriodChanged) {
        rrhsLastDayType = todayDay;
        rrhsInvalidateDerivedSchedule();
      }

      const sig = rrhsGetOverrideSignature();
      if (sig != null && rrhsLastOverrideSignature !== sig) {
        rrhsLastOverrideSignature = sig;
        rrhsInvalidateDerivedSchedule();
      }

      rrhsRecheckCheckoutAvailability();
      rrhsUiRefreshers.forEach((fn) => {
        try {
          if (typeof fn === "function") fn(reason);
        } catch (e) {}
      });
    } catch (e) {}
  }

  const RRHS_ASSET_BASE_URL = (() => {
    try {
      const cur = document.currentScript;
      if (cur && cur.src) return new URL(".", cur.src).toString();
      const scripts = document.getElementsByTagName("script");
      const last = scripts && scripts.length ? scripts[scripts.length - 1] : null;
      if (last && last.src) return new URL(".", last.src).toString();
    } catch (e) {}
    return null;
  })();

  /* Modal utilities */
  function createModal(message, opts = null) {
    const existing = document.getElementById('rrhs-error-modal');
    if (existing) existing.remove();

    const options = opts && typeof opts === "object" ? opts : {};
    const autoCloseMsRaw = options.autoCloseMs;
    const autoCloseMs = Number.isFinite(Number(autoCloseMsRaw))
      ? Math.max(0, Math.min(60000, Math.floor(Number(autoCloseMsRaw))))
      : 5000;

    const modal = document.createElement("div");
    modal.id = "rrhs-error-modal";
    modal.style.cssText = `
      position: fixed !important;
      top: 20px !important;
      left: 50% !important;
      transform: translateX(-50%) translateY(-100vh) !important;

      width: 90%;
      max-width: 600px;

      background: #670000;
      color: #EBEBE2;

      padding: 16px 20px 16px 52px;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);

      z-index: 999999 !important;
      display: flex;
      align-items: center;
    `;

    modal.innerHTML = `
      <button
        id="rrhs-modal-close"
        style="
          position: absolute;
          top: 50%;
          left: 16px;
          transform: translateY(-50%);

          background: transparent;
          color: #EBEBE2;
          border: none;
          padding: 0;

          cursor: pointer;
          font-size: 20px;
          line-height: 1;

          width: 20px;
          height: 20px;

          display: flex;
          align-items: center;
          justify-content: center;

          transition: transform 0.2s ease, opacity 0.2s ease;
          opacity: 0.8;
        "
        onmouseover="this.style.transform='translateY(-50%) rotate(90deg)'; this.style.opacity='1';"
        onmouseout="this.style.transform='translateY(-50%) rotate(0deg)'; this.style.opacity='0.8';"
        aria-label="Close"
        type="button"
      >×</button>

      <div style="font-size: 0.95em; font-weight: 500; flex: 1; margin: 0;">
        ${message}
      </div>
    `;

    document.body.appendChild(modal);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        modal.style.transition = "transform 0.4s ease";
        modal.style.transform = "translateX(-50%) translateY(0)";
      });
    });

    if (!document.getElementById("rrhs-modal-styles")) {
      const style = document.createElement("style");
      style.id = "rrhs-modal-styles";
      style.textContent = `
        #rrhs-error-modal { position: fixed !important; top: 130px !important; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
          20%, 40%, 60%, 80% { transform: translateX(8px); }
        }
      `;
      document.head.appendChild(style);
    }

    const closeModal = () => {
      modal.style.transition = 'transform 0.3s ease';
      modal.style.transform = 'translateX(-50%) translateY(-100vh)';
      setTimeout(() => modal.remove(), 300);
    };
    document.getElementById('rrhs-modal-close').addEventListener('click', closeModal);
    if (autoCloseMs > 0) setTimeout(closeModal, autoCloseMs);
    return modal;
  }

  function shakeElement(element) {
    element.style.animation = 'shake 0.5s ease';
    setTimeout(() => {
      element.style.animation = '';
    }, 500);
  }

  function rrhsGetEmployeeInput() {
    return document.querySelector(`input[name="${RRHS_EMPLOYEE_FIELD_NAME}"]`);
  }

  function rrhsEmployeeIdIsValid(value) {
    // Accept numeric IDs with optional leading letter; do not enforce S/E prefixes.
    return /^[a-zA-Z]?\d+$/.test(String(value || "").trim());
  }

  function rrhsPersistEmployeeId(value) {
    try {
      if (typeof window === "undefined" || !window.localStorage) return;
      const v = String(value || "").trim();
      if (!v) return;
      window.localStorage.setItem(RRHS_EMPLOYEE_STORAGE_KEY, v);
    } catch (_) {}
  }

  function rrhsMaybeAutofillEmployeeId(input) {
    if (!input) return;
    try {
      if (String(input.value || "").trim()) return;
      if (typeof window === "undefined" || !window.localStorage) return;
      const stored = String(window.localStorage.getItem(RRHS_EMPLOYEE_STORAGE_KEY) || "").trim();
      if (!stored) return;
      input.value = stored;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (_) {}
  }

  function rrhsGetEmployeeIdForAccess() {
    try {
      if (typeof window === "undefined" || !window.localStorage) return "";
      return String(window.localStorage.getItem(RRHS_EMPLOYEE_STORAGE_KEY) || "").trim();
    } catch (_) {
      return "";
    }
  }

  function rrhsGetRoomAccessMode() {
    // Prefix-based room access is disabled; room filtering rules always apply.
    return "limited";
  }

  function rrhsCanBypassOrderingWindowByEmployeeId() {
    // Prefix-based ordering-window bypass is disabled.
    if (!RRHS_EMPLOYEE_WINDOW_BYPASS_ENABLED) return false;
    return false;
  }

  function rrhsRefreshRoomAccessIfNeeded() {
    const mode = rrhsGetRoomAccessMode();
    if (mode === rrhsLastRoomAccessMode) return;
    rrhsLastRoomAccessMode = mode;

    rrhsRoomSchedulePromise = null;
    ROOM_DATA = Object.create(null);
    rrhsRoomSchedule.ready = false;
    rrhsRoomSchedule.teachers = [];
    rrhsRoomSchedule.error = null;
    rrhsInvalidateDerivedSchedule();

    loadRoomSchedule()
      .then(() => {
        buildDerivedScheduleForToday();
        const roomInput = document.querySelector('input[name="z7rty2b"]');
        if (roomInput && document.activeElement === roomInput) {
          roomInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
      })
      .catch(() => {});
  }

  function rrhsShowEmployeeInputError(input, show) {
    if (!input) return;
    const container = input.closest(".form-control") || input.parentElement;
    const errorMsg = container ? container.querySelector('[data-rrhs-employee-error="true"]') : null;
    if (show) {
      input.style.border = "2px solid #d32f2f";
      input.style.backgroundColor = "#ffebee";
      if (errorMsg) errorMsg.style.display = "block";
      return;
    }
    input.style.border = "1px solid #ddd";
    input.style.backgroundColor = "";
    if (errorMsg) errorMsg.style.display = "none";
  }

  function rrhsEnsureEmployeeValidation() {
    const input = rrhsGetEmployeeInput();
    if (!input) return;
    rrhsMaybeAutofillEmployeeId(input);

    const container = input.closest(".form-control") || input.parentElement;
    if (container && !container.querySelector('[data-rrhs-employee-error="true"]')) {
      const errorMsg = document.createElement("div");
      errorMsg.dataset.rrhsEmployeeError = "true";
      errorMsg.style.cssText = "display:none;color:#d32f2f;font-size:12px;margin-top:6px;font-weight:500;";
      errorMsg.textContent = "Please enter your full employee number.";
      container.appendChild(errorMsg);
    }

    if (input.dataset.rrhsEmployeeValidationBound !== "1") {
      input.dataset.rrhsEmployeeValidationBound = "1";
      const onEmployeeInput = () => {
        const v = String(input.value || "").trim();
        if (v) rrhsPersistEmployeeId(v);
        if (rrhsEmployeeIdIsValid(v)) rrhsShowEmployeeInputError(input, false);
        rrhsRefreshRoomAccessIfNeeded();
      };
      input.addEventListener("input", onEmployeeInput);
      input.addEventListener("change", onEmployeeInput);
    }
  }

  function rrhsBlockCheckoutForInvalidEmployeeId(event) {
    const input = rrhsGetEmployeeInput();
    if (!input) return false;
    const value = String(input.value || "").trim();
    rrhsPersistEmployeeId(value);
    if (rrhsEmployeeIdIsValid(value)) {
      rrhsShowEmployeeInputError(input, false);
      return false;
    }

    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    }

    rrhsShowEmployeeInputError(input, true);
    if (typeof input.focus === "function") input.focus();
    const checkoutShell =
      document.querySelector(".ec-cart__button--checkout") ||
      document.querySelector(".ec-cart__button--checkout button");
    if (checkoutShell) shakeElement(checkoutShell);
    createModal("Please input your full employee number (example: 123456).", { autoCloseMs: 6000 });
    return true;
  }

  /* Room schedule (CSV) + delivery selection */
  let ROOM_DATA = Object.create(null);
  let rrhsLastRoomAccessMode = null;
  const rrhsRoomSchedule = {
    ready: false,
    teachers: [],
    error: null
  };
  let rrhsRoomSchedulePromise = null;

  const rrhsDeliverySelection = {
    dayType: null,
    teacher: null,
    period: null,
    room: null,
    mode: null,
    specialId: null
  };

  const rrhsDerivedSchedule = {
    dayType: null,
    period: null,
    teacherNames: [],
    teacherToEntries: Object.create(null),
    roomToEntries: Object.create(null),
    allEntries: [],
    allEntriesByRoom: []
  };

  function rrhsLockRoomInputForAllDay(input, sentinelValue) {
    if (!input || input.dataset.rrhsAllDayRoomLocked === "1") return;

    input.dataset.rrhsAllDayRoomLocked = "1";
    input.dataset.rrhsAllDaySentinelValue = String(sentinelValue || "");
    input.dataset.rrhsAllDayPrevValue = String(input.value || "");
    input.dataset.rrhsAllDayPrevTabindex =
      input.hasAttribute("tabindex") ? String(input.getAttribute("tabindex")) : "";
    input.dataset.rrhsAllDayPrevPointerEvents = String(input.style.pointerEvents || "");
    input.dataset.rrhsAllDayPrevCursor = String(input.style.cursor || "");
    input.dataset.rrhsAllDayPrevBackground = String(input.style.backgroundColor || "");

    input.value = sentinelValue;
    input.readOnly = true;
    input.setAttribute("aria-readonly", "true");
    input.style.pointerEvents = "none";
    input.style.cursor = "not-allowed";
    input.style.backgroundColor = "#f5f5f5";
    input.setAttribute("tabindex", "-1");
    if (document.activeElement === input) input.blur();

    const wrapper = input.closest('[data-rrhs-room-wrapper="true"]');
    if (wrapper) {
      const dropdown = wrapper.querySelector('[data-rrhs-room-dropdown="true"]');
      const errorMsg = wrapper.querySelector('[data-rrhs-room-error="true"]');
      if (dropdown) dropdown.style.display = "none";
      if (errorMsg) errorMsg.style.display = "none";
    }

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function rrhsUnlockRoomInputForAllDay(input, sentinelValue = null) {
    if (!input || input.dataset.rrhsAllDayRoomLocked !== "1") return;

    const sentinelResolved =
      sentinelValue == null
        ? String(input.dataset.rrhsAllDaySentinelValue || "")
        : String(sentinelValue);
    const prevValue = input.dataset.rrhsAllDayPrevValue || "";
    const prevTabindex = input.dataset.rrhsAllDayPrevTabindex || "";
    const prevPointerEvents = input.dataset.rrhsAllDayPrevPointerEvents || "";
    const prevCursor = input.dataset.rrhsAllDayPrevCursor || "";
    const prevBackground = input.dataset.rrhsAllDayPrevBackground || "";

    input.readOnly = false;
    input.removeAttribute("aria-readonly");
    input.style.pointerEvents = prevPointerEvents;
    input.style.cursor = prevCursor;
    input.style.backgroundColor = prevBackground;
    if (prevTabindex === "") input.removeAttribute("tabindex");
    else input.setAttribute("tabindex", prevTabindex);

    if (sentinelResolved && String(input.value || "") === sentinelResolved) {
      input.value = prevValue;
    }

    if (input.dataset.autocompleteInit === "allDayRoomLocked") {
      delete input.dataset.autocompleteInit;
    }

    delete input.dataset.rrhsAllDayRoomLocked;
    delete input.dataset.rrhsAllDaySentinelValue;
    delete input.dataset.rrhsAllDayPrevValue;
    delete input.dataset.rrhsAllDayPrevTabindex;
    delete input.dataset.rrhsAllDayPrevPointerEvents;
    delete input.dataset.rrhsAllDayPrevCursor;
    delete input.dataset.rrhsAllDayPrevBackground;

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function rrhsSyncAllDayOnlyRoomField(input = null) {
    const resolvedInput = input || document.querySelector('input[name="z7rty2b"]');
    if (!resolvedInput) return false;

    const sentinelValue = rrhsCartState.allDayRoomSentinel;
    const shouldLockRoom =
      rrhsCartState.ready &&
      rrhsCartState.hasAllDayDelivery &&
      !rrhsCartState.hasRegularItems &&
      Boolean(sentinelValue);

    if (shouldLockRoom) {
      if (!resolvedInput.dataset.autocompleteInit) {
        resolvedInput.dataset.autocompleteInit = "allDayRoomLocked";
      }
      rrhsDeliverySelection.dayType = null;
      rrhsDeliverySelection.teacher = null;
      rrhsDeliverySelection.period = null;
      rrhsDeliverySelection.room = sentinelValue;
      rrhsLockRoomInputForAllDay(resolvedInput, sentinelValue);
      return true;
    }

    rrhsUnlockRoomInputForAllDay(resolvedInput);
    return false;
  }

  function normalizeHeaderValue(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function rrhsGetRoomFilter() {
    try {
      if (typeof window !== "undefined" && window.RRHS_ROOM_FILTER) {
        const w = window.RRHS_ROOM_FILTER;
        if (w && typeof w === "object") {
          const enabled = w.enabled == null ? RRHS_ROOM_FILTER.enabled : Boolean(w.enabled);

          // Back-compat: { requiredDigits, allowedPrefixes } => one rule.
          if (!Array.isArray(w.rules)) {
            const requiredDigitsRaw = Number(w.requiredDigits);
            const requiredDigits = Number.isFinite(requiredDigitsRaw)
              ? Math.max(1, Math.min(8, Math.floor(requiredDigitsRaw)))
              : 4;
            const allowedPrefixes = Array.isArray(w.allowedPrefixes)
              ? w.allowedPrefixes
                  .map((n) => Math.floor(Number(n)))
                  .filter((n) => Number.isFinite(n) && n >= 0 && n <= 9999)
              : [];
            return {
              enabled,
              rules: Object.freeze([
                {
                  digits: requiredDigits,
                  prefixDigits: Math.min(2, requiredDigits),
                  allowedPrefixes: Object.freeze(allowedPrefixes)
                }
              ])
            };
          }

          const rules = w.rules
            .filter((r) => r && typeof r === "object")
            .map((r) => {
              const digitsRaw = Number(r.digits);
              const digits = Number.isFinite(digitsRaw)
                ? Math.max(1, Math.min(8, Math.floor(digitsRaw)))
                : 4;
              const prefixDigitsRaw = Number(r.prefixDigits);
              const prefixDigits = Number.isFinite(prefixDigitsRaw)
                ? Math.max(1, Math.min(digits, Math.floor(prefixDigitsRaw)))
                : Math.min(2, digits);
              const allowedPrefixes = Array.isArray(r.allowedPrefixes)
                ? r.allowedPrefixes
                    .map((n) => Math.floor(Number(n)))
                    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 9999)
                : [];
              return { digits, prefixDigits, allowedPrefixes: Object.freeze(allowedPrefixes) };
            })
            .filter((r) => r.allowedPrefixes.length > 0);

          return { enabled, rules: Object.freeze(rules) };
        }
      }
    } catch (e) {}
    return RRHS_STUDENT_ROOM_FILTER;
  }

  function rrhsIsAllowedRoomValue(roomValue, filter = null) {
    const resolvedFilter = filter || rrhsGetRoomFilter();
    if (!resolvedFilter || resolvedFilter.enabled === false) return true;

    const s = String(roomValue || "").trim();
    if (!s) return false;

    const rules = Array.isArray(resolvedFilter.rules) ? resolvedFilter.rules : [];
    if (rules.length === 0) return false;

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (!rule) continue;

      const digits = Math.max(1, Math.floor(Number(rule.digits) || 0));
      // Allow an optional trailing letter (e.g. "207A", "2312B") but no other suffixes.
      const re = new RegExp(`^(\\d{${digits}})([a-zA-Z])?$`);
      const m = s.match(re);
      if (!m) continue;

      const prefixDigits = Math.max(
        1,
        Math.min(digits, Math.floor(Number(rule.prefixDigits) || 0))
      );
      const prefix = Number(m[1].slice(0, prefixDigits));
      if (!Number.isFinite(prefix)) continue;

      const allowed = Array.isArray(rule.allowedPrefixes) ? rule.allowedPrefixes : [];
      if (allowed.includes(prefix)) return true;
    }

    return false;
  }

  function rrhsGetSpecialDeliveryConfig() {
    try {
      const w =
        typeof window !== "undefined" && window.RRHS_SPECIAL_DELIVERY
          ? window.RRHS_SPECIAL_DELIVERY
          : null;
      const raw = w && typeof w === "object" ? w : RRHS_SPECIAL_DELIVERY;

      const enabled =
        raw.enabled == null ? RRHS_SPECIAL_DELIVERY.enabled : Boolean(raw.enabled);
      const headerLabel =
        raw.headerLabel == null || raw.headerLabel === ""
          ? RRHS_SPECIAL_DELIVERY.headerLabel
          : String(raw.headerLabel);

      const alphaRaw =
        raw.alphaOffice && typeof raw.alphaOffice === "object" ? raw.alphaOffice : {};
      const alphaEnabled =
        alphaRaw.enabled == null
          ? RRHS_SPECIAL_DELIVERY.alphaOffice.enabled
          : Boolean(alphaRaw.enabled);
      const alphaGroupLabel =
        alphaRaw.groupLabel == null || alphaRaw.groupLabel === ""
          ? RRHS_SPECIAL_DELIVERY.alphaOffice.groupLabel
          : String(alphaRaw.groupLabel);
      const alphaRooms = Array.isArray(alphaRaw.rooms)
        ? alphaRaw.rooms
            .map((n) => Math.floor(Number(n)))
            .filter((n) => Number.isFinite(n) && n > 0 && n < 10000)
        : RRHS_SPECIAL_DELIVERY.alphaOffice.rooms;
      const alphaSuffix =
        alphaRaw.roomLabelSuffix == null || alphaRaw.roomLabelSuffix === ""
          ? RRHS_SPECIAL_DELIVERY.alphaOffice.roomLabelSuffix
          : String(alphaRaw.roomLabelSuffix);

      const locRaw = Array.isArray(raw.locations)
        ? raw.locations
        : RRHS_SPECIAL_DELIVERY.locations;
      const locations = locRaw
        .filter((l) => l && typeof l === "object")
        .map((l) => {
          const id = String(l.id || l.label || "location");
          const label = String(l.label || l.roomValue || id);
          const roomValue = String(l.roomValue || label);
          return Object.freeze({ id, label, roomValue });
        });

      return Object.freeze({
        enabled,
        headerLabel,
        alphaOffice: Object.freeze({
          enabled: alphaEnabled,
          groupLabel: alphaGroupLabel,
          rooms: Object.freeze(alphaRooms),
          roomLabelSuffix: alphaSuffix
        }),
        locations: Object.freeze(locations)
      });
    } catch (e) {}
    return RRHS_SPECIAL_DELIVERY;
  }

  function rrhsGetSpecialDeliveryFlatOptions() {
    const cfg = rrhsGetSpecialDeliveryConfig();
    if (!cfg || cfg.enabled === false) return [];

    const out = [];
    const accessMode = rrhsGetRoomAccessMode();

    const alpha = cfg.alphaOffice;
    if (alpha && alpha.enabled !== false && Array.isArray(alpha.rooms)) {
      alpha.rooms.forEach((roomNum) => {
        const room = Math.floor(Number(roomNum));
        if (!Number.isFinite(room) || room <= 0) return;
        if (accessMode !== "all" && room === 200) return;
        const suffix = String(alpha.roomLabelSuffix || "").trim();
        const label = suffix ? `${room} ${suffix}` : String(room);
        out.push(Object.freeze({ id: `alpha_office_${room}`, label, roomValue: label }));
      });
    }

    const locations = Array.isArray(cfg.locations) ? cfg.locations : [];
    locations.forEach((l) => {
      if (!l || !l.roomValue) return;
      out.push(
        Object.freeze({
          id: String(l.id || l.label || l.roomValue),
          label: String(l.label || l.roomValue),
          roomValue: String(l.roomValue)
        })
      );
    });

    return out;
  }

  function rrhsMatchSpecialDeliveryExact(query) {
    const q = String(query || "").trim();
    if (!q) return null;
    const lower = q.toLowerCase();
    const options = rrhsGetSpecialDeliveryFlatOptions();
    return (
      options.find((o) => String(o.roomValue || "").toLowerCase() === lower) ||
      options.find((o) => String(o.label || "").toLowerCase() === lower) ||
      null
    );
  }

  function rrhsGetRoomSortKey(roomValue) {
    const s = String(roomValue || "").trim();
    if (!s) return Infinity;
    const m = s.match(/^(\d{1,6})\b/);
    if (!m) return Infinity;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : Infinity;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    const input = String(text || "");
    for (let i = 0; i < input.length; i++) {
      const char = input[i];

      if (inQuotes) {
        if (char === '"') {
          if (input[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
        continue;
      }

      if (char === '"') {
        inQuotes = true;
        continue;
      }
      if (char === ",") {
        row.push(field);
        field = "";
        continue;
      }
      if (char === "\r") continue;
      if (char === "\n") {
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
        continue;
      }
      field += char;
    }

    row.push(field);
    rows.push(row);

    while (
      rows.length > 0 &&
      rows[rows.length - 1].every((c) => String(c || "").trim() === "")
    ) {
      rows.pop();
    }
    return rows;
  }

  function buildRoomDataFromCsv(csvText) {
    const rows = parseCsv(csvText);
    if (!rows || rows.length < 2) {
      throw new Error("Room schedule CSV is empty.");
    }
    const roomFilter = rrhsGetRoomFilter();

    const header = rows[0] || [];
    const normalized = header.map(normalizeHeaderValue);

    const teacherIdx = normalized.findIndex((h) => h === "teacher" || h.includes("teacher"));
    if (teacherIdx === -1) {
      throw new Error("Room schedule CSV missing Teacher header.");
    }

    const periodIdx = Object.create(null);
    for (let p = 1; p <= 8; p++) {
      const key = `period${p}`;
      const idx = normalized.findIndex((h) => h === key);
      if (idx === -1) throw new Error(`Room schedule CSV missing ${key} header.`);
      periodIdx[p] = idx;
    }

    const data = Object.create(null);
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const teacherName = String(row[teacherIdx] || "").trim();
      if (!teacherName) continue;

      const periods = Object.create(null);
      for (let p = 1; p <= 8; p++) {
        const raw = row[periodIdx[p]];
        const roomRaw = String(raw == null ? "" : raw);
        const roomTrimmed = roomRaw.trim();
        if (!roomTrimmed) continue;
        const roomNormalized = roomTrimmed.replace(/\s+/g, " ");
        if (!rrhsIsAllowedRoomValue(roomNormalized, roomFilter)) continue;
        periods[p] = roomNormalized;
      }
      if (Object.keys(periods).length === 0) continue;
      data[teacherName] = periods;
    }

    const teachers = Object.keys(data).sort((a, b) => a.localeCompare(b));
    return { data, teachers };
  }

  function getRoomScheduleCsvUrl() {
    try {
      if (
        typeof window !== "undefined" &&
        window.RRHS_ROOM_SCHEDULE_CSV_URL &&
        String(window.RRHS_ROOM_SCHEDULE_CSV_URL).trim()
      ) {
        return String(window.RRHS_ROOM_SCHEDULE_CSV_URL).trim();
      }

      const baseUrl = RRHS_ASSET_BASE_URL
        ? new URL(RRHS_ASSET_BASE_URL)
        : new URL(window.location.href);
      return new URL(ROOM_SCHEDULE_CSV_FILENAME, baseUrl).toString();
    } catch (e) {
      return ROOM_SCHEDULE_CSV_FILENAME;
    }
  }

  function loadRoomSchedule() {
    if (rrhsRoomSchedulePromise) return rrhsRoomSchedulePromise;

    const url = getRoomScheduleCsvUrl();
    log("Room schedule CSV URL:", url);
    rrhsRoomSchedulePromise = fetch(url, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load room schedule CSV (${res.status}).`);
        return res.text();
      })
      .then((text) => {
        const built = buildRoomDataFromCsv(text);
        ROOM_DATA = built.data;
        rrhsRoomSchedule.ready = true;
        rrhsRoomSchedule.teachers = built.teachers;
        rrhsRoomSchedule.error = null;
        return rrhsRoomSchedule;
      })
      .catch((err) => {
        ROOM_DATA = Object.create(null);
        rrhsRoomSchedule.ready = false;
        rrhsRoomSchedule.teachers = [];
        rrhsRoomSchedule.error = err;
        throw err;
      });

    return rrhsRoomSchedulePromise;
  }

  function getTodayDayType() {
    if (rrhsSim.dayType === "A" || rrhsSim.dayType === "B") return rrhsSim.dayType;
    return isADay() ? "A" : "B";
  }

  function parseTimeToMinutes(hhmm) {
    const m = String(hhmm || "").trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
    return h * 60 + min;
  }

  function formatMinutes(minutes) {
    const total = Math.max(0, Math.min(24 * 60 - 1, Number(minutes)));
    const h24 = Math.floor(total / 60);
    const m = total % 60;
    const suffix = h24 >= 12 ? "PM" : "AM";
    const h12 = ((h24 + 11) % 12) + 1;
    const mm = String(m).padStart(2, "0");
    return `${h12}:${mm} ${suffix}`;
  }

  function rrhsFormatPeriodLabel(periodNumber) {
    const p = Math.floor(Number(periodNumber));
    if (!Number.isFinite(p)) return "Period";
    return `Period ${p}`;
  }

  function getNowMinutes(date = new Date()) {
    if (Number.isFinite(rrhsSim.nowMinutes)) {
      return Math.max(0, Math.min(24 * 60 - 1, Math.floor(Number(rrhsSim.nowMinutes))));
    }
    return date.getHours() * 60 + date.getMinutes();
  }

  function rrhsNormalizePeriodList(list) {
    if (!Array.isArray(list)) return [];
    const uniq = new Set();
    list.forEach((v) => {
      const n = Math.floor(Number(v));
      if (!Number.isFinite(n)) return;
      if (n < 1 || n > 8) return;
      uniq.add(n);
    });
    return Array.from(uniq).sort((a, b) => a - b);
  }

  function rrhsGetOrderingMatrix() {
    const w =
      (typeof window !== "undefined" &&
        window.RRHS_ORDERING_PERIOD_MATRIX &&
        typeof window.RRHS_ORDERING_PERIOD_MATRIX === "object")
        ? window.RRHS_ORDERING_PERIOD_MATRIX
        : RRHS_ORDERING_PERIOD_MATRIX;

    return {
      A: rrhsNormalizePeriodList(w.A),
      B: rrhsNormalizePeriodList(w.B)
    };
  }

  const RRHS_SESSION_OVERRIDE_KEYS = Object.freeze({
    alwaysAllow: "RRHS_ALWAYS_ALLOW",
    closeDeltaMinutes: "RRHS_CLOSE_DELTA_MINUTES",
    baseWindows: "RRHS_BASE_PERIOD_WINDOWS"
  });

  function rrhsGetSessionStorage() {
    try {
      return typeof sessionStorage !== "undefined" ? sessionStorage : null;
    } catch (e) {
      return null;
    }
  }

  function rrhsGetAlwaysAllowOverride() {
    const ss = rrhsGetSessionStorage();
    if (!ss) return null;
    const v = ss.getItem(RRHS_SESSION_OVERRIDE_KEYS.alwaysAllow);
    if (v === "1") return true;
    if (v === "0") return false;
    return null;
  }

  function rrhsGetCloseDeltaMinutesOverride() {
    const ss = rrhsGetSessionStorage();
    if (!ss) return null;
    const raw = ss.getItem(RRHS_SESSION_OVERRIDE_KEYS.closeDeltaMinutes);
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    const clamped = Math.max(0, Math.min(120, Math.floor(n)));
    return clamped;
  }

  function rrhsGetBaseWindowsOverride() {
    const ss = rrhsGetSessionStorage();
    if (!ss) return null;
    const raw = ss.getItem(RRHS_SESSION_OVERRIDE_KEYS.baseWindows);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function rrhsGetBaseWindowForPeriod(basePeriod) {
    const b = Number(basePeriod);
    if (!Number.isFinite(b) || b < 1 || b > 4) return null;
    const override = rrhsGetBaseWindowsOverride();
    const candidate = override && override[String(b)];
    if (candidate && typeof candidate === "object" && candidate.start && candidate.end) {
      return { start: String(candidate.start), end: String(candidate.end) };
    }
    return BASE_PERIOD_WINDOWS[b] || null;
  }

  function getPeriodWindow(periodNumber) {
    const p = Number(periodNumber);
    if (!Number.isFinite(p) || p < 1 || p > 8) return null;
    const base = p <= 4 ? p : p - 4;
    const w = rrhsGetBaseWindowForPeriod(base);
    if (!w) return null;
    const startMin = parseTimeToMinutes(w.start);
    const endMin = parseTimeToMinutes(w.end);
    if (startMin == null || endMin == null) return null;
    const closeDelta = rrhsGetCloseDeltaMinutesOverride();
    // Ordering closes N minutes before the bell (default 15).
    const closeMin = Math.max(
      startMin,
      endMin - (closeDelta == null ? RRHS_DEFAULT_CLOSE_DELTA_MINUTES : closeDelta)
    );
    return { startMin, endMin, closeMin };
  }

  function rrhsRecheckCheckoutAvailability() {
    try {
      const inCartOrCheckout = document.querySelector(".ec-cart, .ec-cart-step, .ec-checkout");
      const checkoutButton = document.querySelector('.ec-cart__button--checkout button');
      if (!inCartOrCheckout || !checkoutButton) return;
      const now = Date.now();
      const cartStale =
        !rrhsCartState.ready ||
        !rrhsCartState.lastUpdated ||
        now - rrhsCartState.lastUpdated > 5 * 60 * 1000;

      // Always update UI immediately using current cached state (fast path)
      manageCheckoutButton();
      updateCheckoutOverlay();

      // If cart flags might be stale, refresh in the background and then re-apply
      if (cartStale) {
        rrhsRunInBackground(() => {
          rrhsRefreshCartStateThrottled(() => {
            manageCheckoutButton();
            updateCheckoutOverlay();
          });
        });
      }
    } catch (e) {}
  }

  function installRrhsDevtoolsOverrides() {
    if (typeof window === "undefined") return;
    if (window.RRHS_OVERRIDES && window.RRHS_OVERRIDES.__installed) return;

    const ss = rrhsGetSessionStorage();
    const api = {
      __installed: true,
      help: () => {
        return {
          setAlwaysAllow: "RRHS_OVERRIDES.setAlwaysAllow(true|false)",
          setCloseDeltaMinutes: "RRHS_OVERRIDES.setCloseDeltaMinutes(15)",
          setBasePeriodWindow: "RRHS_OVERRIDES.setBasePeriodWindow(1, '09:00', '10:40')",
          setSimDayType: "RRHS_OVERRIDES.setSimDayType('A'|'B'|null)",
          setSimTime: "RRHS_OVERRIDES.setSimTime('HH:MM'|null)",
          setSimMinutes: "RRHS_OVERRIDES.setSimMinutes(0..1439|null)",
          reset: "RRHS_OVERRIDES.reset()",
          note:
            "Config overrides are stored in sessionStorage (tab-only). Simulation overrides are in-memory and reset on refresh."
        };
      },
      get: () => {
        return {
          alwaysAllow: rrhsGetAlwaysAllowOverride(),
          closeDeltaMinutes: rrhsGetCloseDeltaMinutesOverride(),
          basePeriodWindows: rrhsGetBaseWindowsOverride(),
          simDayType: rrhsSim.dayType,
          simNowMinutes: rrhsSim.nowMinutes,
          simNowLabel: Number.isFinite(rrhsSim.nowMinutes)
            ? formatMinutes(rrhsSim.nowMinutes)
            : null
        };
      },
      setAlwaysAllow: (value) => {
        if (!ss) return false;
        ss.setItem(RRHS_SESSION_OVERRIDE_KEYS.alwaysAllow, value ? "1" : "0");
        rrhsRefreshEverything("override:setAlwaysAllow");
        return true;
      },
      setCloseDeltaMinutes: (minutes) => {
        if (!ss) return false;
        const n = Number(minutes);
        if (!Number.isFinite(n)) return false;
        ss.setItem(RRHS_SESSION_OVERRIDE_KEYS.closeDeltaMinutes, String(Math.floor(n)));
        rrhsRefreshEverything("override:setCloseDeltaMinutes");
        return true;
      },
      setBasePeriodWindow: (basePeriod, startHHMM, endHHMM) => {
        if (!ss) return false;
        const b = Number(basePeriod);
        if (!Number.isFinite(b) || b < 1 || b > 4) return false;
        if (parseTimeToMinutes(startHHMM) == null) return false;
        if (parseTimeToMinutes(endHHMM) == null) return false;
        const current = rrhsGetBaseWindowsOverride() || {};
        current[String(b)] = { start: String(startHHMM), end: String(endHHMM) };
        ss.setItem(RRHS_SESSION_OVERRIDE_KEYS.baseWindows, JSON.stringify(current));
        rrhsRefreshEverything("override:setBasePeriodWindow");
        return true;
      },
      setSimDayType: (dayType) => {
        const v = dayType == null ? null : String(dayType).trim().toUpperCase();
        if (v !== "A" && v !== "B" && v !== null) return false;
        rrhsSim.dayType = v;
        rrhsRefreshEverything("sim:setDayType");
        return true;
      },
      setSimTime: (hhmm) => {
        if (hhmm == null || String(hhmm).trim() === "") {
          rrhsSim.nowMinutes = null;
          rrhsRefreshEverything("sim:clearTime");
          return true;
        }
        const minutes = parseTimeToMinutes(hhmm);
        if (minutes == null) return false;
        rrhsSim.nowMinutes = minutes;
        rrhsRefreshEverything("sim:setTime");
        return true;
      },
      setSimMinutes: (minutes) => {
        if (minutes == null || minutes === "") {
          rrhsSim.nowMinutes = null;
          rrhsRefreshEverything("sim:clearMinutes");
          return true;
        }
        const n = Number(minutes);
        if (!Number.isFinite(n)) return false;
        rrhsSim.nowMinutes = Math.max(0, Math.min(24 * 60 - 1, Math.floor(n)));
        rrhsRefreshEverything("sim:setMinutes");
        return true;
      },
      reset: () => {
        if (!ss) return false;
        ss.removeItem(RRHS_SESSION_OVERRIDE_KEYS.alwaysAllow);
        ss.removeItem(RRHS_SESSION_OVERRIDE_KEYS.closeDeltaMinutes);
        ss.removeItem(RRHS_SESSION_OVERRIDE_KEYS.baseWindows);
        rrhsSim.dayType = null;
        rrhsSim.nowMinutes = null;
        rrhsRefreshEverything("override:reset");
        return true;
      }
    };

    window.RRHS_OVERRIDES = api;
  }

  installRrhsDevtoolsOverrides();

  function getAllowedPeriodsForDay(dayType) {
    const dt = dayType === "A" ? "A" : "B";
    const matrix = rrhsGetOrderingMatrix();
    const raw = matrix[dt] || [];
    const mapped = raw
      .map((p) => {
        const n = Math.floor(Number(p));
        if (!Number.isFinite(n)) return null;
        if (dt === "B" && n >= 1 && n <= 4) return n + 4;
        return n;
      })
      .filter((n) => {
        if (!Number.isFinite(n)) return false;
        if (dt === "A") return n >= 1 && n <= 4;
        return n >= 5 && n <= 8;
      });
    return Array.from(new Set(mapped)).sort((a, b) => a - b);
  }

  function rrhsGetCurrentOrNextBasePeriodForDelivery(nowMin = null) {
    const minutes = nowMin == null ? getNowMinutes(new Date()) : Number(nowMin);
    if (!Number.isFinite(minutes)) return null;

    // Prefer a period that is currently in-session (start..end)
    for (let base = 1; base <= 4; base++) {
      const w = getPeriodWindow(base);
      if (!w) continue;
      if (minutes >= w.startMin && minutes < w.endMin) return base;
    }

    // Otherwise, choose the next upcoming period start
    for (let base = 1; base <= 4; base++) {
      const w = getPeriodWindow(base);
      if (!w) continue;
      if (minutes < w.startMin) return base;
    }

    // After the last period, keep it stable on the last base period
    return 4;
  }

  function rrhsGetCurrentOrNextPeriodForToday(nowMin = null) {
    const dayType = getTodayDayType();
    const allowedPeriods = getAllowedPeriodsForDay(dayType);
    if (!allowedPeriods || allowedPeriods.length === 0) return null;

    const minutes = nowMin == null ? getNowMinutes(new Date()) : Number(nowMin);
    if (!Number.isFinite(minutes)) return null;

    // Prefer an allowed period that is currently in-session (start..end)
    for (let i = 0; i < allowedPeriods.length; i++) {
      const p = allowedPeriods[i];
      const w = getPeriodWindow(p);
      if (!w) continue;
      if (minutes >= w.startMin && minutes < w.endMin) return p;
    }

    // Otherwise, choose the next upcoming allowed period start
    let next = null;
    let nextStart = Infinity;
    for (let i = 0; i < allowedPeriods.length; i++) {
      const p = allowedPeriods[i];
      const w = getPeriodWindow(p);
      if (!w) continue;
      if (minutes < w.startMin && w.startMin < nextStart) {
        nextStart = w.startMin;
        next = p;
      }
    }
    if (next != null) return next;

    // After the last allowed period, keep it stable on the last allowed period
    return allowedPeriods[allowedPeriods.length - 1];
  }

  function resolveTeacherName(value) {
    const v = String(value || "").trim();
    if (!v) return null;
    if (ROOM_DATA[v]) return v;
    const lower = v.toLowerCase();
    const match = rrhsRoomSchedule.teachers.find((t) => t.toLowerCase() === lower);
    return match || null;
  }

  function buildDerivedScheduleForToday() {
    const dayType = getTodayDayType();
    if (!rrhsRoomSchedule.ready) return null;

    const activePeriod = rrhsGetCurrentOrNextPeriodForToday();
    const allowedPeriods = activePeriod ? [activePeriod] : getAllowedPeriodsForDay(dayType);
    const teacherToEntries = Object.create(null);
    const roomToEntries = Object.create(null);
    const teacherNames = [];
    const allEntries = [];

    rrhsRoomSchedule.teachers.forEach((teacher) => {
      const periodsForTeacher = ROOM_DATA[teacher];
      if (!periodsForTeacher) return;

      const roomToPeriod = Object.create(null);
      allowedPeriods.forEach((p) => {
        const room = periodsForTeacher[p];
        if (!room) return;
        const existing = roomToPeriod[room];
        if (!existing || p < existing) roomToPeriod[room] = p;
      });

      const rooms = Object.keys(roomToPeriod);
      if (rooms.length === 0) return;

      const entries = rooms
        .map((room) => ({ teacher, room, period: roomToPeriod[room] }))
        .sort((a, b) => a.period - b.period || a.room.localeCompare(b.room));

      teacherToEntries[teacher] = entries;
      teacherNames.push(teacher);

      entries.forEach((e) => {
        if (!roomToEntries[e.room]) roomToEntries[e.room] = [];
        roomToEntries[e.room].push({ teacher: e.teacher, period: e.period, room: e.room });
        allEntries.push({ teacher: e.teacher, period: e.period, room: e.room });
      });
    });

    Object.keys(roomToEntries).forEach((room) => {
      roomToEntries[room].sort(
        (a, b) => a.teacher.localeCompare(b.teacher) || a.period - b.period
      );
    });

    const allEntriesByRoom = allEntries.slice().sort((a, b) => {
      const aKey = rrhsGetRoomSortKey(a.room);
      const bKey = rrhsGetRoomSortKey(b.room);
      if (aKey !== bKey) return aKey - bKey;
      return a.teacher.localeCompare(b.teacher) || String(a.room).localeCompare(String(b.room));
    });

    rrhsDerivedSchedule.dayType = dayType;
    rrhsDerivedSchedule.period = activePeriod;
    rrhsDerivedSchedule.teacherNames = teacherNames;
    rrhsDerivedSchedule.teacherToEntries = teacherToEntries;
    rrhsDerivedSchedule.roomToEntries = roomToEntries;
    rrhsDerivedSchedule.allEntries = allEntries;
    rrhsDerivedSchedule.allEntriesByRoom = allEntriesByRoom;

    log("Derived schedule rebuilt:", {
      dayType,
      period: activePeriod,
      teachers: teacherNames.length,
      entries: allEntries.length
    });
    log("Derived schedule sample:", allEntries.slice(0, 5));
    return rrhsDerivedSchedule;
  }

  function getDerivedScheduleForToday() {
    const today = getTodayDayType();
    if (!rrhsRoomSchedule.ready) return null;
    const currentPeriod = rrhsGetCurrentOrNextPeriodForToday();
    if (
      rrhsDerivedSchedule.dayType === today &&
      rrhsDerivedSchedule.period === currentPeriod &&
      rrhsDerivedSchedule.teacherNames.length
    ) {
      return rrhsDerivedSchedule;
    }
    return buildDerivedScheduleForToday();
  }

  function resolveRoomDeterministic(room) {
    const s = getDerivedScheduleForToday();
    if (!s) return null;
    const key = String(room || "").trim();
    if (!key) return null;
    const matches = s.roomToEntries[key];
    if (!matches || matches.length === 0) return null;
    return matches[0];
  }

  function getSelectionValidation() {
    const today = new Date();
    const dow = today.getDay();
    if (dow === 0 || dow === 6) {
      return { ok: false, message: "Deliveries are only available on school days." };
    }

    if (
      rrhsCartState.ready &&
      rrhsCartState.hasAllDayDelivery &&
      !rrhsCartState.hasRegularItems &&
      rrhsCartState.allDayRoomSentinel
    ) {
      return { ok: true, message: "" };
    }

    if (rrhsDeliverySelection.mode === "special" && rrhsDeliverySelection.room) {
      const special = rrhsMatchSpecialDeliveryExact(rrhsDeliverySelection.room);
      if (!special) {
        return { ok: false, message: "Please select a room from the list." };
      }

      const todayDay = getTodayDayType();
      rrhsDeliverySelection.dayType = todayDay;

      const allowed = getAllowedPeriodsForDay(todayDay);
      if (!allowed || allowed.length === 0) {
        return { ok: false, message: RRHS_CLOSED_MESSAGE_HTML };
      }

      const periodCandidate = rrhsGetCurrentOrNextPeriodForToday();
      if (periodCandidate == null) {
        return { ok: false, message: RRHS_CLOSED_MESSAGE_HTML };
      }
      rrhsDeliverySelection.period = periodCandidate;
      if (!allowed.includes(periodCandidate)) {
        return { ok: false, message: "Please select a room from the list." };
      }

      const w = getPeriodWindow(periodCandidate);
      if (!w) return { ok: false, message: "Invalid period selected." };

      const nowMin = getNowMinutes(today);
      if (nowMin < w.startMin) {
        return {
          ok: false,
          message: `Delivery for ${rrhsFormatPeriodLabel(periodCandidate)} starts at ${formatMinutes(w.startMin)}.`
        };
      }
      if (nowMin >= w.closeMin) {
        return {
          ok: false,
          message: `Delivery for ${rrhsFormatPeriodLabel(periodCandidate)} closes at ${formatMinutes(w.closeMin)}.`
        };
      }

      return { ok: true, message: "" };
    }

    if (!rrhsRoomSchedule.ready) {
      return {
        ok: false,
        message:
          "Room schedule is unavailable right now. Please refresh and try again."
      };
    }

    const todayDay = getTodayDayType();
    rrhsDeliverySelection.dayType = todayDay;

    const teacher = rrhsDeliverySelection.teacher;
    if (!teacher || !ROOM_DATA[teacher]) {
      return { ok: false, message: "Please select a room from the list." };
    }

    const period = Number(rrhsDeliverySelection.period);
    if (!Number.isFinite(period)) {
      return { ok: false, message: "Please select a room from the list." };
    }
    const allowed = getAllowedPeriodsForDay(todayDay);
    if (!allowed.includes(period)) {
      return { ok: false, message: "Please select a room from the list." };
    }

    const room = (ROOM_DATA[teacher] && ROOM_DATA[teacher][period]) || null;
    if (!room) {
      return { ok: false, message: "Please select a room from the list." };
    }
    if (rrhsDeliverySelection.room && rrhsDeliverySelection.room !== room) {
      return { ok: false, message: "Please select a room from the list." };
    }

    const w = getPeriodWindow(period);
    if (!w) return { ok: false, message: "Invalid period selected." };

    const nowMin = getNowMinutes(today);
    if (nowMin < w.startMin) {
      return {
        ok: false,
        message: `Delivery for ${rrhsFormatPeriodLabel(period)} starts at ${formatMinutes(w.startMin)}.`
      };
    }
    if (nowMin >= w.closeMin) {
      return {
        ok: false,
        message: `Delivery for ${rrhsFormatPeriodLabel(period)} closes at ${formatMinutes(w.closeMin)}.`
      };
    }

    return { ok: true, message: "" };
  }

  function initRoomAutocomplete() {
    const input0 = document.querySelector('input[name="z7rty2b"]');
    if (!input0 || input0.dataset.autocompleteInit) return;

    const proceed = () => {
      const input = document.querySelector('input[name="z7rty2b"]');
      if (!input || input.dataset.autocompleteInit) return;

      if (rrhsSyncAllDayOnlyRoomField(input)) {
        return;
      }

      input.dataset.autocompleteInit = "true";
      rrhsDeliverySelection.dayType = getTodayDayType();
      rrhsDeliverySelection.teacher = null;
      rrhsDeliverySelection.period = null;
      rrhsDeliverySelection.room = null;
      rrhsDeliverySelection.mode = null;
      rrhsDeliverySelection.specialId = null;

      const section = input.closest(".ec-cart-step__section");
      if (section) section.style.transition = "padding-bottom 0.2s ease";

      const wrapper = document.createElement("div");
      wrapper.style.position = "relative";
      wrapper.style.width = "100%";
      wrapper.dataset.rrhsRoomWrapper = "true";
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);

      const dropdown = document.createElement("div");
      dropdown.style.cssText =
        "position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #ddd;border-top:none;max-height:250px;overflow-y:auto;z-index:999999;display:none;box-shadow:0 4px 6px rgba(0,0,0,0.1);";
      dropdown.dataset.rrhsRoomDropdown = "true";
      wrapper.appendChild(dropdown);

      if (!document.getElementById("rrhs-room-dropdown-styles")) {
        const style = document.createElement("style");
        style.id = "rrhs-room-dropdown-styles";
        style.textContent = `
          @keyframes rrhsFadeIn {
            from { opacity: 0; transform: translateY(-2px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `;
        document.head.appendChild(style);
      }

      const errorMsg = document.createElement("div");
      errorMsg.style.cssText =
        "color:#d32f2f;font-size:.875em;margin-top:4px;display:none;outline:none!important;border:none!important;box-shadow:none!important;pointer-events:none;";
      errorMsg.textContent =
        "We couldn't find that room. Please select a valid room from the list.";
      errorMsg.tabIndex = -1;
      errorMsg.dataset.rrhsRoomError = "true";
      wrapper.appendChild(errorMsg);

      let ignoreInput = false;
      let blurTimer = null;
      let lastRenderedQuery = null;

      if (input.dataset.rrhsUiRefresher !== "1") {
        input.dataset.rrhsUiRefresher = "1";
        rrhsUiRefreshers.push((reason) => {
          const schedule = getDerivedScheduleForToday();
          if (!schedule) return;

          if (rrhsDeliverySelection.mode === "teacher" && rrhsDeliverySelection.teacher) {
            const teacher = rrhsDeliverySelection.teacher;
            const entries = schedule.teacherToEntries[teacher] || [];
            if (entries[0] && entries[0].room && entries[0].room !== rrhsDeliverySelection.room) {
              log("Teacher room auto-updated:", {
                reason,
                teacher,
                from: rrhsDeliverySelection.room,
                to: entries[0].room,
                period: entries[0].period
              });
              selectRoom(entries[0], "teacher");
              return;
            }
          }

          const qTrim = String(input.value || "").trim();
          const teacherExact = matchesTeacherExact(qTrim, schedule.teacherNames);
          const roomExact = Boolean(qTrim && schedule.roomToEntries[qTrim]);
          const shouldUpdate =
            document.activeElement === input ||
            teacherExact ||
            roomExact ||
            rrhsDeliverySelection.mode === "teacher";
          if (!shouldUpdate) return;

          lastRenderedQuery = null;
          handleQueryChange();
        });
      }

      function updateWrapperPadding(show, itemCount) {
        const sec = input.closest(".ec-cart-step__section");
        if (!sec) return;
        if (show) {
          const count = Math.max(0, Number(itemCount || 0));
          const dropdownHeight = Math.min(count * 65, 250);
          sec.style.paddingBottom = dropdownHeight + "px";
        } else {
          sec.style.paddingBottom = "0px";
        }
      }

      function showDropdown(itemCount) {
        dropdown.style.display = "block";
        updateWrapperPadding(true, itemCount);
      }

      function hideDropdown() {
        dropdown.style.display = "none";
        updateWrapperPadding(false, 0);
      }

      function showError(show) {
        if (show) {
          input.style.border = "2px solid #d32f2f";
          input.style.backgroundColor = "#ffebee";
          errorMsg.style.display = "block";
        } else {
          input.style.border = "1px solid #ddd";
          input.style.backgroundColor = "";
          errorMsg.style.display = "none";
        }
      }

      function clearSelection() {
        rrhsDeliverySelection.dayType = getTodayDayType();
        rrhsDeliverySelection.teacher = null;
        rrhsDeliverySelection.period = null;
        rrhsDeliverySelection.room = null;
        rrhsDeliverySelection.mode = null;
        rrhsDeliverySelection.specialId = null;
      }

      function setRoomValue(value) {
        ignoreInput = true;
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        ignoreInput = false;
      }

      function setSelectionFromEntry(entry, mode = "room") {
        if (!entry) return;
        rrhsDeliverySelection.dayType = getTodayDayType();
        rrhsDeliverySelection.teacher = entry.teacher;
        rrhsDeliverySelection.period = entry.period;
        rrhsDeliverySelection.room = entry.room;
        rrhsDeliverySelection.mode = mode;
        rrhsDeliverySelection.specialId = null;
      }

      function setSelectionFromSpecial(option) {
        if (!option || !option.roomValue) return;
        rrhsDeliverySelection.dayType = getTodayDayType();
        rrhsDeliverySelection.teacher = null;
        rrhsDeliverySelection.period = rrhsGetCurrentOrNextPeriodForToday();
        rrhsDeliverySelection.room = option.roomValue;
        rrhsDeliverySelection.mode = "special";
        rrhsDeliverySelection.specialId = String(option.id || "");
      }

      function selectSpecial(option) {
        if (!option || !option.roomValue) return;
        showError(false);
        setSelectionFromSpecial(option);
        setRoomValue(option.roomValue);
        hideDropdown();
      }

      function selectRoom(entry, mode = "room") {
        if (!entry) return;
        showError(false);
        setSelectionFromEntry(entry, mode);
        setRoomValue(entry.room);
        hideDropdown();
      }

      function matchesTeacherExact(query, teacherNames) {
        const q = String(query || "").trim();
        if (!q) return null;
        const lower = q.toLowerCase();
        return teacherNames.find((t) => t.toLowerCase() === lower) || null;
      }

      function buildSuggestions(query) {
        const schedule = getDerivedScheduleForToday();

        const q = String(query || "").trim();
        const qLower = q.toLowerCase();
        const specialCfg = rrhsGetSpecialDeliveryConfig();

        function formatRoomTeacherSummary(roomKey, fallbackTeacher = "") {
          if (!schedule) return String(fallbackTeacher || "");

          const entriesForRoom = schedule.roomToEntries && schedule.roomToEntries[roomKey];
          const list = [];
          const seen = new Set();
          if (Array.isArray(entriesForRoom)) {
            for (let i = 0; i < entriesForRoom.length; i++) {
              const name = String(entriesForRoom[i] && entriesForRoom[i].teacher ? entriesForRoom[i].teacher : "").trim();
              if (!name) continue;
              const key = name.toLowerCase();
              if (seen.has(key)) continue;
              seen.add(key);
              list.push(name);
            }
          }

          if (list.length === 0) {
            const fallback = String(fallbackTeacher || "").trim();
            return fallback ? fallback : "";
          }

          if (list.length === 1) return list[0];
          if (list.length === 2) return `${list[0]} + ${list[1]}`;

          return `${list[0]} + ${list[1]} + ${list.length - 2} more`;
        }

        function formatRoomLabel(roomKey) {
          const rk = String(roomKey || "").trim();
          if (!rk) return "";
          return rk.startsWith("Room") ? rk : `Room ${rk}`;
        }

        function buildSpecialSection(forceShowAll = false) {
          if (!specialCfg || specialCfg.enabled === false) return [];

          const alpha = specialCfg.alphaOffice;
          const accessMode = rrhsGetRoomAccessMode();
          const alphaEnabled = alpha && alpha.enabled !== false;
          const alphaGroupLabel = alphaEnabled ? String(alpha.groupLabel || "Alpha Office") : "";
          const alphaRooms = alphaEnabled && Array.isArray(alpha.rooms) ? alpha.rooms : [];
          const alphaSuffix = alphaEnabled ? String(alpha.roomLabelSuffix || "").trim() : "";

          const alphaChildren = alphaRooms
            .map((n) => Math.floor(Number(n)))
            .filter((n) => Number.isFinite(n) && n > 0)
            .filter((n) => accessMode === "all" || n !== 200)
            .map((n) => {
              const label = alphaSuffix ? `${n} ${alphaSuffix}` : String(n);
              return { id: `alpha_office_${n}`, label, roomValue: label };
            });

          const locations = rrhsGetSpecialDeliveryFlatOptions().filter(
            (o) => !String(o.id || "").startsWith("alpha_office_")
          );

          const alphaGroupMatches = !q || (alphaGroupLabel && alphaGroupLabel.toLowerCase().includes(qLower));
          const alphaChildMatches = alphaChildren.filter((c) => {
            if (!q) return true;
            return String(c.label || "").toLowerCase().includes(qLower);
          });
          const otherMatches = forceShowAll
            ? locations
            : locations.filter((o) => {
                if (!q) return true;
                const labelLower = String(o.label || "").toLowerCase();
                const roomLower = String(o.roomValue || "").toLowerCase();
                return labelLower.includes(qLower) || roomLower.includes(qLower);
              });

          const anyMatches =
            (alphaEnabled && alphaGroupMatches) ||
            alphaChildMatches.length > 0 ||
            otherMatches.length > 0;
          if (!anyMatches) return [];

          const section = [];
          section.push({ kind: "header", label: specialCfg.headerLabel || "Special Locations" });

          otherMatches.forEach((o) => {
            section.push({
              kind: "special",
              id: o.id,
              label: o.label,
              roomValue: o.roomValue
            });
          });

          const showAlphaSection =
            alphaEnabled && (forceShowAll || !q || alphaChildMatches.length > 0);
          if (showAlphaSection) {
            section.push({ kind: "subheader", label: alphaGroupLabel || "Alpha Office" });
            const children = forceShowAll || !q ? alphaChildren : alphaChildMatches;
            children.forEach((c) => {
              section.push({
                kind: "special",
                id: c.id,
                label: c.label,
                roomValue: c.roomValue
              });
            });
          }

          return section;
        }

        const specialExact = rrhsMatchSpecialDeliveryExact(q);
        if (specialExact) {
          selectSpecial(specialExact);
          return [];
        }

        const MAX_ITEMS = 999999999999;

        if (!schedule) {
          return buildSpecialSection(true);
        }

        const teacherExact = matchesTeacherExact(q, schedule.teacherNames);
        if (teacherExact) {
          const entries = schedule.teacherToEntries[teacherExact] || [];
          if (entries.length === 1) {
            selectRoom(entries[0], "teacher");
            return [];
          }
          return entries.map((e) => ({
            teacher: teacherExact,
            period: e.period,
            room: e.room,
            label: `${teacherExact} — ${String(e.room).startsWith("Room") ? e.room : `Room ${e.room}`}`
          }));
        }

        if (q && schedule.roomToEntries[q] && schedule.roomToEntries[q].length) {
          const resolved = resolveRoomDeterministic(q);
          if (resolved) setSelectionFromEntry(resolved, "room");
          return schedule.roomToEntries[q].map((e) => ({
            teacher: e.teacher,
            period: e.period,
            room: e.room,
            label: `${e.teacher} — ${String(e.room).startsWith("Room") ? e.room : `Room ${e.room}`}`
          }));
        }

        const specialSectionForEmpty = buildSpecialSection(false);

        const entries = Array.isArray(schedule.allEntriesByRoom) && schedule.allEntriesByRoom.length
          ? schedule.allEntriesByRoom
          : schedule.allEntries;

        if (!q) {
          const specials = specialSectionForEmpty;
          const baseLimit = Math.max(0, MAX_ITEMS - specials.length);

          // Show one row per room (sorted by room number), so higher prefixes (14xx/15xx/22xx/etc)
          // are reachable without being buried under many teachers in lower rooms.
          const baseRooms = [];
          const seenRooms = new Set();
          for (let i = 0; i < entries.length && baseRooms.length < baseLimit; i++) {
            const e = entries[i];
            const roomKey = String(e.room || "").trim();
            if (!roomKey || seenRooms.has(roomKey)) continue;
            seenRooms.add(roomKey);

            const resolved = resolveRoomDeterministic(roomKey) || e;
            const teacherPart = formatRoomTeacherSummary(roomKey, resolved.teacher);

            baseRooms.push({
              teacher: resolved.teacher,
              period: resolved.period,
              room: resolved.room,
              label: `${formatRoomLabel(roomKey)}${teacherPart ? ` — ${teacherPart}` : ""}`
            });
          }

          return baseRooms.concat(specials).slice(0, MAX_ITEMS);
        }

        const baseMatches = [];
        const seenRooms = new Set();
        for (let i = 0; i < entries.length && baseMatches.length < MAX_ITEMS; i++) {
          const e = entries[i];
          const roomKey = String(e.room || "").trim();
          if (!roomKey || seenRooms.has(roomKey)) continue;
          seenRooms.add(roomKey);

          const roomMatches = roomKey.toLowerCase().includes(qLower);
          const roomEntries = schedule.roomToEntries && schedule.roomToEntries[roomKey] ? schedule.roomToEntries[roomKey] : [];
          const teacherMatches = Array.isArray(roomEntries)
            ? roomEntries.some((re) => String(re && re.teacher ? re.teacher : "").toLowerCase().includes(qLower))
            : false;

          if (!roomMatches && !teacherMatches) continue;

          const resolved = (Array.isArray(roomEntries) && roomEntries[0]) ? roomEntries[0] : (resolveRoomDeterministic(roomKey) || e);
          const teacherPart = formatRoomTeacherSummary(roomKey, resolved.teacher);

          baseMatches.push({
            teacher: resolved.teacher,
            period: resolved.period,
            room: resolved.room,
            label: `${formatRoomLabel(roomKey)}${teacherPart ? ` — ${teacherPart}` : ""}`
          });
        }

        const specials = baseMatches.length === 0 ? buildSpecialSection(true) : buildSpecialSection(false);
        const baseLimit = Math.max(0, MAX_ITEMS - specials.length);
        return baseMatches.slice(0, baseLimit).concat(specials).slice(0, MAX_ITEMS);
      }

      function renderSuggestions(items) {
        dropdown.innerHTML = "";
        if (!items || items.length === 0) {
          hideDropdown();
          return;
        }

        items.forEach((item) => {
          const el = document.createElement("div");
          const kind = item && item.kind ? String(item.kind) : "";

          if (kind === "header") {
            el.style.cssText =
              "padding:10px 16px;background:#f8f8f8;color:#444;font-weight:600;border-bottom:1px solid #f0f0f0;cursor:default;";
            el.textContent = String(item.label || "Special");
            dropdown.appendChild(el);
            return;
          }

          if (kind === "subheader") {
            el.style.cssText =
              "padding:10px 16px;background:#fbfbfb;color:#444;font-weight:600;border-bottom:1px solid #f0f0f0;cursor:default;";
            el.textContent = String(item.label || "");
            dropdown.appendChild(el);
            return;
          }

          if (kind === "special") {
            el.style.cssText =
              "padding:12px 16px;cursor:pointer;border-bottom:1px solid #f0f0f0;";
            el.textContent = String(item.label || item.roomValue || "");
            el.style.animation = "rrhsFadeIn 0.12s ease";
            el.addEventListener("mouseenter", () => (el.style.backgroundColor = "#f5f5f5"));
            el.addEventListener("mouseleave", () => (el.style.backgroundColor = "white"));
            el.addEventListener("click", () => {
              selectSpecial(item);
            });
            dropdown.appendChild(el);
            return;
          }

          el.style.cssText =
            "padding:12px 16px;cursor:pointer;border-bottom:1px solid #f0f0f0;";
          el.textContent = item.label;
          el.addEventListener("mouseenter", () => (el.style.backgroundColor = "#f5f5f5"));
          el.addEventListener("mouseleave", () => (el.style.backgroundColor = "white"));
          el.addEventListener("click", () => {
            selectRoom(item, "room");
          });

          dropdown.appendChild(el);
        });

        showDropdown(items.length);
      }

      function handleQueryChange() {
        if (ignoreInput) return;
        showError(false);
        const query = String(input.value || "");

        const qTrim = query.trim();
        if (rrhsDeliverySelection.room && rrhsDeliverySelection.room !== qTrim) {
          clearSelection();
        }

        if (lastRenderedQuery === query && dropdown.style.display !== "none") return;
        lastRenderedQuery = query;

        const items = buildSuggestions(query);
        renderSuggestions(items);
      }

      input.addEventListener("input", handleQueryChange);
      input.addEventListener("focus", () => {
        lastRenderedQuery = null;
        handleQueryChange();
      });

      input.addEventListener("blur", () => {
        if (blurTimer) clearTimeout(blurTimer);
        blurTimer = setTimeout(() => {
          hideDropdown();

          const schedule = getDerivedScheduleForToday();
          const qTrim = String(input.value || "").trim();
          const specialExact = rrhsMatchSpecialDeliveryExact(qTrim);
          if (specialExact) {
            showError(false);
            setSelectionFromSpecial(specialExact);
            if (String(input.value || "") !== String(specialExact.roomValue || "")) {
              setRoomValue(String(specialExact.roomValue || ""));
            }
            return;
          }
          if (!schedule || !qTrim) {
            showError(false);
            return;
          }
          const teacherExact = matchesTeacherExact(qTrim, schedule.teacherNames);
          const roomExact = Boolean(schedule.roomToEntries[qTrim]);
          if (teacherExact || roomExact) {
            showError(false);
            return;
          }
          showError(true);
        }, 150);
      });

      document.addEventListener("click", (e) => {
        if (!wrapper.contains(e.target)) hideDropdown();
      });

      loadRoomSchedule()
        .then(() => {
          buildDerivedScheduleForToday();
          if (document.activeElement === input) handleQueryChange();
        })
        .catch((e) => {
          log("Room schedule load error", e);
          createModal("Room schedule failed to load. Please refresh and try again.");
        });
    };

    if (rrhsCartState.ready) {
      proceed();
      return;
    }
    rrhsRefreshCartStateThrottled(proceed);
  }

  function initRoomContinueButton() {
    const continueBtn = document.querySelector('.form-control--button button.form-control__button');
    if (!continueBtn || continueBtn.dataset.rrhsValidation) return;
    continueBtn.dataset.rrhsValidation = "true";
    continueBtn.addEventListener('click', (e) => {
      const input = document.querySelector('input[name="z7rty2b"]');
      if (!input) return;

      if (
        rrhsCartState.ready &&
        rrhsCartState.hasAllDayDelivery &&
        !rrhsCartState.hasRegularItems &&
        rrhsCartState.allDayRoomSentinel
      ) {
        input.value = rrhsCartState.allDayRoomSentinel;
        return;
      }

      // VALIDATION DISABLED - uncomment to re-enable
      
      const validation = getSelectionValidation();
      if (!validation.ok) {
        e.preventDefault();
        e.stopPropagation();
        shakeElement(continueBtn);

        createModal(validation.message || "Please select a room from the list.");
      }
  
    });
  }

  function initSauceDropdown() {
    const options = Object.freeze([
      Object.freeze({ id: "no_sauce", label: "--no sauce--" }),
      Object.freeze({ id: "cfa_sauce", label: "Chick-fil-A® Sauce" }),
      Object.freeze({ id: "garden_herb_ranch", label: "Garden Herb Ranch Sauce" })
    ]);
    const noSauceId = "no_sauce";
    const inputs = Array.from(
      document.querySelectorAll('input[name="text"][aria-label="Sauce"]')
    );
    if (!inputs.length) return;

    if (!document.getElementById("rrhs-sauce-dropdown-styles")) {
      const style = document.createElement("style");
      style.id = "rrhs-sauce-dropdown-styles";
      style.textContent = `
        @keyframes rrhsSauceFadeIn {
          from { opacity: 0; transform: translateY(-2px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `;
      document.head.appendChild(style);
    }

    inputs.forEach((input) => {
      if (!input || input.dataset.rrhsSauceDropdownInit === "1") return;
      input.dataset.rrhsSauceDropdownInit = "1";

      const section = input.closest(".ec-cart-step__section");
      if (section) section.style.transition = "padding-bottom 0.2s ease";

      const wrapper = document.createElement("div");
      wrapper.style.position = "relative";
      wrapper.style.width = "100%";
      wrapper.dataset.rrhsSauceWrapper = "true";
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);

      const dropdown = document.createElement("div");
      dropdown.style.cssText =
        "position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #ddd;border-top:none;max-height:250px;overflow-y:auto;z-index:999999;display:none;box-shadow:0 4px 6px rgba(0,0,0,0.1);";
      dropdown.dataset.rrhsSauceDropdown = "true";
      wrapper.appendChild(dropdown);

      function updateWrapperPadding(show, itemCount) {
        const sec = input.closest(".ec-cart-step__section");
        if (!sec) return;
        if (show) {
          const count = Math.max(0, Number(itemCount || 0));
          const dropdownHeight = Math.min(count * 48, 250);
          sec.style.paddingBottom = dropdownHeight + "px";
        } else {
          sec.style.paddingBottom = "0px";
        }
      }

      function showDropdown() {
        dropdown.style.display = "block";
        updateWrapperPadding(true, options.length);
      }

      function hideDropdown() {
        dropdown.style.display = "none";
        updateWrapperPadding(false, 0);
      }

      function setSauceValue(v) {
        input.value = v;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        rrhsSyncSauceQtyFields();
      }

      function parseSelectedFromInputValue() {
        const raw = String(input.value || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const selected = new Set();
        raw.forEach((label) => {
          const match = options.find((o) => o.label === label);
          if (match) selected.add(match.id);
        });
        if (selected.size === 0) selected.add(noSauceId);
        if (selected.has(noSauceId) && selected.size > 1) {
          selected.delete(noSauceId);
        }
        return selected;
      }

      function normalizeSelected(selected) {
        if (!(selected instanceof Set)) return new Set([noSauceId]);
        if (selected.size === 0) return new Set([noSauceId]);
        if (selected.has(noSauceId) && selected.size > 1) selected.delete(noSauceId);
        if (selected.size === 0) selected.add(noSauceId);
        return selected;
      }

      function commitSelected(selected) {
        const normalized = normalizeSelected(new Set(selected));
        const labels = options
          .filter((o) => normalized.has(o.id))
          .map((o) => o.label);
        setSauceValue(labels.join(", "));
        return normalized;
      }

      function renderOptions(selected) {
        dropdown.innerHTML = "";
        options.forEach((option) => {
          const isSelected = selected.has(option.id);
          const el = document.createElement("div");
          el.style.cssText =
            "padding:12px 16px;cursor:pointer;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;justify-content:space-between;gap:12px;";
          el.style.animation = "rrhsSauceFadeIn 0.12s ease";
          const label = document.createElement("span");
          label.textContent = option.label;
          el.appendChild(label);
          const check = document.createElement("span");
          check.textContent = isSelected ? "✓" : "";
          check.style.cssText = "font-weight:700;color:#2e7d32;min-width:14px;text-align:right;";
          el.appendChild(check);
          el.addEventListener("mouseenter", () => (el.style.backgroundColor = "#f5f5f5"));
          el.addEventListener("mouseleave", () => (el.style.backgroundColor = "white"));
          el.addEventListener("click", () => {
            const next = new Set(selected);
            if (option.id === noSauceId) {
              next.clear();
              next.add(noSauceId);
            } else {
              if (next.has(option.id)) next.delete(option.id);
              else next.add(option.id);
              next.delete(noSauceId);
            }
            const committed = commitSelected(next);
            renderOptions(committed);
          });
          dropdown.appendChild(el);
        });
      }

      input.readOnly = true;
      input.autocomplete = "off";
      input.style.cursor = "pointer";

      input.addEventListener("keydown", (e) => {
        if (e.key === "Tab") return;
        e.preventDefault();
      });
      input.addEventListener("beforeinput", (e) => e.preventDefault());
      input.addEventListener("paste", (e) => e.preventDefault());
      input.addEventListener("drop", (e) => e.preventDefault());
      input.addEventListener("focus", () => {
        renderOptions(parseSelectedFromInputValue());
        showDropdown();
      });
      input.addEventListener("click", () => {
        renderOptions(parseSelectedFromInputValue());
        showDropdown();
      });

      let blurTimer = null;
      input.addEventListener("blur", () => {
        if (blurTimer) clearTimeout(blurTimer);
        blurTimer = setTimeout(hideDropdown, 150);
      });

      document.addEventListener("click", (e) => {
        if (!wrapper.contains(e.target)) hideDropdown();
      });

      commitSelected(parseSelectedFromInputValue());
      renderOptions(parseSelectedFromInputValue());
      rrhsSyncSauceQtyFields();
    });
  }

  function rrhsGetSelectedSauceNames() {
    const sauceInput = document.querySelector(
      '[data-rrhs-sauce-wrapper="true"] > input.form-control__text[name="text"][aria-label="Sauce"]'
    );
    if (!sauceInput) return [];
    const raw = String(sauceInput.value || "");
    const allowed = Object.freeze(["Chick-fil-A® Sauce", "Garden Herb Ranch Sauce"]);
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const out = [];
    const seen = new Set();
    parts.forEach((p) => {
      if (!allowed.includes(p)) return;
      if (seen.has(p)) return;
      seen.add(p);
      out.push(p);
    });
    return out;
  }

  function rrhsNormalizeSauceQtyInput(input) {
    if (!input) return;
    const digits = String(input.value || "").replace(/\D+/g, "");
    if (!digits) {
      input.value = "";
      rrhsRefreshSauceQtyUiState(input);
      return;
    }
    let n = Math.floor(Number(digits));
    if (!Number.isFinite(n)) n = 1;
    if (n < 1) n = 1;
    if (n > 4) n = 4;
    input.value = String(n);
    rrhsRefreshSauceQtyUiState(input);
  }

  function rrhsRefreshSauceQtyUiState(input) {
    if (!input) return;
    const control = input.closest(".form-control");
    if (!control) return;
    const hasValue = String(input.value || "").trim().length > 0;
    if (hasValue) control.classList.remove("form-control--empty");
    else control.classList.add("form-control--empty");
  }

  function rrhsSyncSauceQtyFields() {
    const selectedSauces = rrhsGetSelectedSauceNames();
    const qtyDefs = [
      { inputSelector: 'input.form-control__text[name="text"][aria-label="SauceQty1"]', fallbackTitle: "SauceQty1" },
      { inputSelector: 'input.form-control__text[name="text"][aria-label="SauceQty2"]', fallbackTitle: "SauceQty2" }
    ];

    qtyDefs.forEach((def, idx) => {
      const input = document.querySelector(def.inputSelector);
      if (!input) return;
      const module =
        input.closest(".product-details-module") ||
        input.closest(".details-product-option") ||
        input.closest(".product-details-module__content") ||
        input.parentElement;
      if (!module) return;
      module.dataset.rrhsSauceQtyModule = "1";

      const title = module.querySelector(".details-product-option__title");

      if (!input.dataset.rrhsSauceQtyBound) {
        input.dataset.rrhsSauceQtyBound = "1";
        input.type = "number";
        input.inputMode = "numeric";
        input.step = "1";
        input.min = "1";
        input.max = "4";
        input.pattern = "[0-9]*";
        input.addEventListener("input", () => rrhsNormalizeSauceQtyInput(input));
        input.addEventListener("change", () => rrhsNormalizeSauceQtyInput(input));
      }

      const sauceName = selectedSauces[idx] || "";
      if (!sauceName) {
        module.dataset.rrhsSauceQtyVisible = "0";
        module.style.display = "none";
        if (title) {
          if (!title.dataset.rrhsOriginalTitle) {
            title.dataset.rrhsOriginalTitle = String(title.textContent || def.fallbackTitle);
          }
          title.textContent = title.dataset.rrhsOriginalTitle || def.fallbackTitle;
        }
        input.value = "";
        return;
      }

      module.dataset.rrhsSauceQtyVisible = "1";
      module.style.display = "";
      if (title) {
        if (!title.dataset.rrhsOriginalTitle) {
          title.dataset.rrhsOriginalTitle = String(title.textContent || def.fallbackTitle);
        }
        title.textContent = `${sauceName} Qty`;
      }
      if (!String(input.value || "").trim()) {
        input.value = "1";
      }
      rrhsNormalizeSauceQtyInput(input);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      rrhsRefreshSauceQtyUiState(input);
    });
  }

  function initSauceQtyFields() {
    if (!document.getElementById("rrhs-sauce-qty-styles")) {
      const style = document.createElement("style");
      style.id = "rrhs-sauce-qty-styles";
      style.textContent = `
        [data-rrhs-sauce-qty-module="1"][data-rrhs-sauce-qty-visible="0"] {
          display: none !important;
        }
        [data-rrhs-sauce-qty-module="1"] .form-control__placeholder {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
    }

    const qtyInputs = Array.from(
      document.querySelectorAll(
        'input.form-control__text[name="text"][aria-label="SauceQty1"], input.form-control__text[name="text"][aria-label="SauceQty2"]'
      )
    );
    qtyInputs.forEach((input) => {
      if (!input || input.dataset.rrhsSauceQtyBound) return;
      input.dataset.rrhsSauceQtyBound = "1";
      input.type = "number";
      input.inputMode = "numeric";
      input.step = "1";
      input.min = "1";
      input.max = "4";
      input.pattern = "[0-9]*";
      input.addEventListener("input", () => rrhsNormalizeSauceQtyInput(input));
      input.addEventListener("change", () => rrhsNormalizeSauceQtyInput(input));
    });

    rrhsSyncSauceQtyFields();
  }

  /* Checkout time restriction and cart state */
  const rrhsCartState = {
    ready: false,
    hasAllDayDelivery: false,
    hasRegularItems: false,
    allDayLabels: [],
    allDayDisplayParts: [],
    allDayRoomSentinel: null,
    lastUpdated: 0
  };

  function rrhsNormalizeProductIdentity(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[’‘]/g, "'")
      .replace(/[^a-z0-9]+/g, "");
  }

  function rrhsGetAllDayDeliveryProductRules() {
    const fromWindow =
      (typeof window !== "undefined" && Array.isArray(window.RRHS_ALL_DAY_DELIVERY_PRODUCTS))
        ? window.RRHS_ALL_DAY_DELIVERY_PRODUCTS
        : null;
    const raw = fromWindow || RRHS_ALL_DAY_DELIVERY_PRODUCTS;
    if (!Array.isArray(raw)) return [];

    return raw
      .filter((r) => r && typeof r === "object")
      .map((r) => {
        const sku = r.sku == null || r.sku === "" ? null : String(r.sku);
        const name = r.name == null || r.name === "" ? null : String(r.name);
        const urlPath = r.urlPath == null || r.urlPath === "" ? null : String(r.urlPath);
        const label = String(r.label || name || sku || urlPath || "All-day item");
        const lockRoom = Boolean(r.lockRoom);
        const roomSentinel =
          r.roomSentinel == null || r.roomSentinel === "" ? null : String(r.roomSentinel);

        return { label, sku, name, urlPath, lockRoom, roomSentinel };
      })
      .filter((r) => Boolean(r.sku || r.name || r.urlPath));
  }

  function rrhsFindAllDayDeliveryRuleForProduct(product, rules) {
    const p = product && typeof product === "object" ? product : null;
    if (!p) return null;

    const sku = p.sku == null ? "" : String(p.sku);
    const nameNorm = rrhsNormalizeProductIdentity(p.name);
    const urlNorm = rrhsNormalizeProductIdentity(p.url);

    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      if (!r) continue;

      if (r.sku && sku && String(r.sku) === sku) return r;
      if (r.name && nameNorm && rrhsNormalizeProductIdentity(r.name) === nameNorm) return r;
      if (r.urlPath && urlNorm) {
        const ruleUrlNorm = rrhsNormalizeProductIdentity(r.urlPath);
        if (ruleUrlNorm === urlNorm) return r;
        if (/^https?:\/\//i.test(r.urlPath)) {
          try {
            const pathnameNorm = rrhsNormalizeProductIdentity(new URL(r.urlPath).pathname);
            if (pathnameNorm === urlNorm) return r;
          } catch (e) {}
        }
      }
    }

    return null;
  }

  function computeCartFlags(cart) {
    const items = (cart && Array.isArray(cart.items)) ? cart.items : [];
    const rules = rrhsGetAllDayDeliveryProductRules();

    let hasAllDayDelivery = false;
    let hasRegularItems = false;
    let roomSentinel = null;
    const labels = new Set();
    const displayParts = new Set();

    items.forEach((it) => {
      const p = it && it.product;
      if (!p) {
        hasRegularItems = true;
        return;
      }

      const rule = rrhsFindAllDayDeliveryRuleForProduct(p, rules);
      if (rule) {
        hasAllDayDelivery = true;
        labels.add(rule.label);
        if (rule.urlPath) {
          const href = /^https?:\/\//i.test(rule.urlPath)
            ? rule.urlPath
            : `${RRHS_SITE_ORIGIN}${rule.urlPath}`;
          displayParts.add(
            `<a href="${href}" target="_blank" rel="noopener" style="color:#FFD6D6;text-decoration:underline;font-weight:600;">${rule.label}</a>`
          );
        } else {
          displayParts.add(rule.label);
        }
        if (!roomSentinel && rule.lockRoom && rule.roomSentinel) {
          roomSentinel = rule.roomSentinel;
        }
        return;
      }

      hasRegularItems = true;
    });

    rrhsCartState.ready = true;
    rrhsCartState.hasAllDayDelivery = hasAllDayDelivery;
    rrhsCartState.hasRegularItems = hasRegularItems;
    rrhsCartState.allDayLabels = Array.from(labels);
    rrhsCartState.allDayDisplayParts = Array.from(displayParts);
    rrhsCartState.allDayRoomSentinel =
      hasAllDayDelivery && !hasRegularItems ? roomSentinel : null;
    rrhsCartState.lastUpdated = Date.now();
  }

  function refreshCartState(cb) {
    try {
      if (!window.Ecwid || !Ecwid.Cart || typeof Ecwid.Cart.get !== "function") {
        rrhsCartState.ready = false;
        rrhsCartState.hasAllDayDelivery = false;
        rrhsCartState.hasRegularItems = false;
        rrhsCartState.allDayLabels = [];
        rrhsCartState.allDayDisplayParts = [];
        rrhsCartState.allDayRoomSentinel = null;
        rrhsCartState.lastUpdated = Date.now();
        if (typeof cb === "function") cb();
        return;
      }
      Ecwid.Cart.get(function(cart) {
        computeCartFlags(cart);
        if (typeof cb === "function") cb();
      });
    } catch (e) {
      rrhsCartState.ready = false;
      rrhsCartState.hasAllDayDelivery = false;
      rrhsCartState.hasRegularItems = false;
      rrhsCartState.allDayLabels = [];
      rrhsCartState.allDayDisplayParts = [];
      rrhsCartState.allDayRoomSentinel = null;
      rrhsCartState.lastUpdated = Date.now();
      if (typeof cb === "function") cb();
    }
  }

  let rrhsCartFetchInFlight = false;
  let rrhsCartFetchLastStartedAt = 0;
  const rrhsCartFetchWaiters = [];
  function rrhsRefreshCartStateThrottled(cb, minIntervalMs = 15000) {
    const now = Date.now();

    if (typeof cb === "function") rrhsCartFetchWaiters.push(cb);

    if (rrhsCartFetchInFlight) return;

    const interval = Math.max(0, Number(minIntervalMs) || 0);
    const force = !rrhsCartState.ready;
    if (!force && now - rrhsCartFetchLastStartedAt < interval) {
      const waiters = rrhsCartFetchWaiters.splice(0, rrhsCartFetchWaiters.length);
      waiters.forEach((fn) => {
        try {
          fn(false);
        } catch (e) {}
      });
      return;
    }

    rrhsCartFetchInFlight = true;
    rrhsCartFetchLastStartedAt = now;
    refreshCartState(() => {
      rrhsCartFetchInFlight = false;
      const waiters = rrhsCartFetchWaiters.splice(0, rrhsCartFetchWaiters.length);
      waiters.forEach((fn) => {
        try {
          fn(true);
        } catch (e) {}
      });
    });
  }

  function getRestrictionMessage() {
    if (rrhsCartState.hasAllDayDelivery && rrhsCartState.hasRegularItems) {
      const parts =
        rrhsCartState.allDayDisplayParts && rrhsCartState.allDayDisplayParts.length
          ? rrhsCartState.allDayDisplayParts
          : ["all-day delivery items"];
      return `Your cart includes ${parts.join(", ")} along with other items. Items eligible for all-day delivery must be placed separately. Please remove other items and complete them in a separate order, as regular items are only available during active delivery windows.`;
    }

    const hasCompleteSelection =
      rrhsDeliverySelection.dayType &&
      rrhsDeliverySelection.room &&
      (rrhsDeliverySelection.mode === "special" ||
        (rrhsDeliverySelection.teacher && rrhsDeliverySelection.period));
    if (hasCompleteSelection) {
      const validation = getSelectionValidation();
      if (!validation.ok && validation.message) return validation.message;
    }

    function buildLinesForPeriods(periods) {
      return (periods || [])
        .map((p) => {
          const w = getPeriodWindow(p);
          if (!w) return null;
          return `${rrhsFormatPeriodLabel(p)}: ${formatMinutes(w.startMin)}–${formatMinutes(w.closeMin)}`;
        })
        .filter(Boolean);
    }

    const aLines = buildLinesForPeriods(getAllowedPeriodsForDay("A"));
    const bLines = buildLinesForPeriods(getAllowedPeriodsForDay("B"));
    const parts = [];
    if (aLines.length) parts.push(`<strong>A Day</strong><br/>${aLines.join("<br/>")}`);
    if (bLines.length) parts.push(`<strong>B Day</strong><br/>${bLines.join("<br/>")}`);

    if (parts.length) {
      return `Ordering is available during delivery windows only:<br/>${parts.join("<br/><br/>")}`;
    }

    return RRHS_CLOSED_MESSAGE_HTML;
  }

  function isADay() {
    const now = new Date();
    const referenceDate = new Date(REFERENCE_A_DAY + 'T00:00:00');
    now.setHours(0,0,0,0);
    referenceDate.setHours(0,0,0,0);
    let dayCount = 0;
    const current = new Date(referenceDate);

    while (current < now) {
      current.setDate(current.getDate() + 1);
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        dayCount++;
      }
    }
    return dayCount % 2 === 0;
  }

  function checkOrderingWindowBase() {
    if (CHECKOUT_ALWAYS_ALLOW) return true;
    const alwaysAllowOverride = rrhsGetAlwaysAllowOverride();
    if (alwaysAllowOverride === true) return true;
    if (rrhsCanBypassOrderingWindowByEmployeeId()) return true;
    const now = new Date();
    const day = now.getDay();
    if (day === 0 || day === 6) return false;
    const nowMin = getNowMinutes(now);
    const dayType = getTodayDayType();
    const allowedPeriods = getAllowedPeriodsForDay(dayType);
    return allowedPeriods.some((p) => {
      const w = getPeriodWindow(p);
      if (!w) return false;
      return nowMin >= w.startMin && nowMin < w.closeMin;
    });
  }

  function checkOrderingWindow() {
    if (rrhsCartState.hasAllDayDelivery && !rrhsCartState.hasRegularItems) return true;
    if (rrhsCartState.hasAllDayDelivery && rrhsCartState.hasRegularItems) return false;
    return checkOrderingWindowBase();
  }

  function manageCheckoutButton() {
    const button = document.querySelector('.ec-cart__button--checkout button');
    if (!button) return;
    const isAllowed = checkOrderingWindow();
    if (isAllowed) {
      button.disabled = false;
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
      button.title = '';
      if (button.dataset.rrhsClickHandler && button._rrhsClickHandler) {
        button.removeEventListener('click', button._rrhsClickHandler, true);
        delete button.dataset.rrhsClickHandler;
        delete button._rrhsClickHandler;
      }
    } else {
      button.disabled = true;
      button.style.opacity = '0.5';
      button.style.cursor = 'not-allowed';
      button.title = getRestrictionMessage();
      if (!button.dataset.rrhsClickHandler) {
        button.dataset.rrhsClickHandler = "true";
        button._rrhsClickHandler = (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          shakeElement(button);
          createModal(getRestrictionMessage(), { autoCloseMs: 11000 });
          return false;
        };
        button.addEventListener('click', button._rrhsClickHandler, true);
      }
    }
  }

  function wrapCheckoutButton() {
    const button = document.querySelector('.ec-cart__button--checkout button');
    if (!button || button.dataset.rrhsWrapped) return;
    const parent = button.parentElement;
    if (!parent) return;
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position: relative; display: inline-block; width: 100%;';
    wrapper.dataset.rrhsWrapper = 'true';
    parent.insertBefore(wrapper, button);
    wrapper.appendChild(button);

    const overlay = document.createElement('div');
    overlay.style.cssText = `position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 10; cursor: not-allowed; display: none;`;
    overlay.dataset.rrhsOverlayBtn = 'true';
    wrapper.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (rrhsBlockCheckoutForInvalidEmployeeId(e)) return;
      e.preventDefault();
      e.stopPropagation();
      shakeElement(button);
      createModal(getRestrictionMessage(), { autoCloseMs: 11000 });
    });
    button.dataset.rrhsWrapped = 'true';
  }

  function updateCheckoutOverlay() {
    const button = document.querySelector('.ec-cart__button--checkout button');
    const overlay = document.querySelector('[data-rrhs-overlay-btn="true"]');
    if (!button || !overlay) return;
    const isAllowed = checkOrderingWindow();
    if (isAllowed) {
      overlay.style.display = 'none';
    } else {
      overlay.style.display = 'block';
    }
  }

  function initEmployeeCheckoutValidation() {
    rrhsEnsureEmployeeValidation();
    rrhsRefreshRoomAccessIfNeeded();

    const button = document.querySelector('.ec-cart__button--checkout button');
    if (!button || button.dataset.rrhsEmployeeValidation === "1") return;
    button.dataset.rrhsEmployeeValidation = "1";
    button.addEventListener(
      "click",
      (e) => {
        rrhsBlockCheckoutForInvalidEmployeeId(e);
      },
      true
    );
  }

  let rrhsCartChangedListenerAdded = false;
  function initCartChangedListener() {
    if (rrhsCartChangedListenerAdded) return;
    const ecwid = window.Ecwid;
    if (
      ecwid &&
      ecwid.OnCartChanged &&
      typeof ecwid.OnCartChanged.add === "function"
    ) {
      rrhsCartChangedListenerAdded = true;
      ecwid.OnCartChanged.add(function(cart) {
        computeCartFlags(cart);
        rrhsSyncAllDayOnlyRoomField();
        initEmployeeCheckoutValidation();
        initRoomAutocomplete();
        initSauceDropdown();
        initSauceQtyFields();
        wrapCheckoutButton();
        manageCheckoutButton();
        updateCheckoutOverlay();
      });
    }
  }

  function boot() {
    try {
      log('RRHS checkout boot');
      initCartChangedListener();
      initEmployeeCheckoutValidation();
      initRoomAutocomplete();
      initSauceDropdown();
      initSauceQtyFields();
      initRoomContinueButton();
      wrapCheckoutButton();
      const checkoutButton = document.querySelector('.ec-cart__button--checkout button');
      if (checkoutButton) {
        rrhsRecheckCheckoutAvailability();
      }
    } catch (e) {
      log('RRHS checkout boot error', e);
    }
  }

  let bootScheduled = false;
  const raf =
    (typeof window !== "undefined" &&
      typeof window.requestAnimationFrame === "function")
      ? window.requestAnimationFrame.bind(window)
      : (fn) => setTimeout(fn, 0);
  const scheduleBoot = () => {
    if (bootScheduled) return;
    bootScheduled = true;
    raf(() => {
      bootScheduled = false;
      boot();
    });
  };

  scheduleBoot();
  const runtime = (typeof window !== "undefined") ? window.RRHS_RUNTIME : null;
  if (runtime && typeof runtime.onDomChanged === "function") {
    runtime.onDomChanged(scheduleBoot, { runNow: false });
  } else {
    const observer = new MutationObserver(scheduleBoot);
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scheduleBoot);
  }

  const tick1m = () => {
    const inCartOrCheckout = document.querySelector(".ec-cart, .ec-cart-step, .ec-checkout");
    const checkoutButton = document.querySelector('.ec-cart__button--checkout button');
    if (!inCartOrCheckout || !checkoutButton) return;
    rrhsRefreshEverything("tick:1m");
  };

  if (runtime && typeof runtime.every === "function") {
    runtime.every(60000, tick1m);
  } else {
    setInterval(tick1m, 60000);
  }

})();

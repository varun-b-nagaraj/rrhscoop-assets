/**
 * rrhs-iced-tea-gate.js
 *
 * INSTALL
 * - Paste this entire script into Ecwid Admin → Settings → Tracking & Analytics → Custom JavaScript.
 * - Edit:
 *   - API_BASE (your Vercel domain, e.g. "https://example.vercel.app")
 *   - ICED_TEA_PRODUCT_ID (the Ecwid product ID for iced tea)
 *
 * Purpose: UI-only guardrail enforcing "one iced tea per employee" by blocking checkout until eligibility
 * is verified. Backend webhook must still enforce the rule for real.
 */
(() => {
  "use strict";

  if (window.__RRHS_ICED_TEA_GATE__) return;
  window.__RRHS_ICED_TEA_GATE__ = true;

  // ---------------------------
  // Config (edit these)
  // ---------------------------
  const API_BASE = "https://order-enforcement.vercel.app/";
  const ICED_TEA_PRODUCT_ID = 814252012; // replace with real product id
  const EMPLOYEE_FIELD_NAME = "pvhvhag";
  const EMPLOYEE_STORAGE_KEY = "rrhs_employee_id_v1";

  // ---------------------------
  // Required selectors (do not change)
  // ---------------------------
  const SEL_EMAIL = "#ec-cart-email-input";
  const SEL_EMPLOYEE = `input[name="${EMPLOYEE_FIELD_NAME}"]`;
  const SEL_OVERLAY = '[data-rrhs-overlay-btn="true"]';

  const DOM_POLL_MS = 250;
  const DOM_POLL_TIMEOUT_MS = 20000;
  const ELIGIBILITY_DEBOUNCE_MS = 250;

  const state = {
    cartHasIcedTea: false,
    domPollTimer: null,
    domPollStartedAt: 0,
    listenersAttached: false,
    overlayClickHandlerAttached: false,
    overlayBlockedByUs: false,
    overlayPrevDisplay: null,
    bannerEl: null,
    lastBannerMessage: "",
    lastPair: "",
    lastDecision: null, // { eligible: boolean, reason?: string }
    inFlight: null // { controller: AbortController, pair: string, seq: number }
  };

  function safeTrim(value) {
    return (value == null ? "" : String(value)).trim();
  }

  function isEmailLike(email) {
    const v = safeTrim(email);
    if (!v) return false;
    // "Basic shape" only (avoid being overly strict).
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  function debounce(fn, waitMs) {
    let t = null;
    return function debounced(...args) {
      if (t) clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), waitMs);
    };
  }

  function getCartHasIcedTea(cart) {
    try {
      const items = cart && Array.isArray(cart.items) ? cart.items : [];
      return items.some((item) => Number(item && item.product && item.product.id) === Number(ICED_TEA_PRODUCT_ID));
    } catch (_) {
      return false;
    }
  }

  function getEmailInput() {
    return document.querySelector(SEL_EMAIL);
  }

  function getEmployeeInput() {
    return document.querySelector(SEL_EMPLOYEE);
  }

  function getOverlay() {
    return document.querySelector(SEL_OVERLAY);
  }

  function setOverlayBlocked(blocked) {
    const overlay = getOverlay();
    if (!overlay) return;

    if (blocked) {
      if (!state.overlayBlockedByUs) state.overlayPrevDisplay = overlay.style.display;
      state.overlayBlockedByUs = true;
      overlay.style.display = "block";
      overlay.dataset.rrhsTeaGate = "blocked";
      overlay.setAttribute("aria-hidden", "false");
      return;
    }

    if (!state.overlayBlockedByUs) return;
    state.overlayBlockedByUs = false;
    overlay.style.display = state.overlayPrevDisplay == null ? "" : state.overlayPrevDisplay;
    state.overlayPrevDisplay = null;
    delete overlay.dataset.rrhsTeaGate;
    overlay.setAttribute("aria-hidden", "true");
  }

  function ensureOverlayClickInterception() {
    const overlay = getOverlay();
    if (!overlay || state.overlayClickHandlerAttached) return;
    state.overlayClickHandlerAttached = true;

    // Capture-phase so we can override any existing bubble listeners when our gate is active.
    overlay.addEventListener(
      "click",
      (e) => {
        if (!state.cartHasIcedTea) return;
        if (!state.overlayBlockedByUs) return;
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

        const employeeInput = getEmployeeInput();
        const emailInput = getEmailInput();
        const focusTarget = (employeeInput && employeeInput.offsetParent ? employeeInput : null) ||
          (emailInput && emailInput.offsetParent ? emailInput : null);
        if (focusTarget && typeof focusTarget.focus === "function") focusTarget.focus();
      },
      true
    );
  }

  function ensureBanner() {
    const employeeInput = getEmployeeInput();
    if (!employeeInput) return null;

    if (state.bannerEl && state.bannerEl.isConnected) return state.bannerEl;

    const banner = document.createElement("div");
    banner.id = "rrhs-iced-tea-gate-banner";
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "polite");
    banner.setAttribute("aria-atomic", "true");
    banner.style.cssText = [
      "display:none",
      "margin:10px 0 12px",
      "padding:10px 12px",
      "border-radius:10px",
      "border:1px solid rgba(155, 0, 0, 0.25)",
      "background:rgba(255, 240, 240, 0.95)",
      "color:#5a0000",
      "font-size:14px",
      "line-height:1.35"
    ].join(";");

    const container =
      employeeInput.closest(".ec-form__row") ||
      employeeInput.closest(".ec-form") ||
      employeeInput.parentElement;
    if (!container) return null;

    // Insert near the employee field (top of the closest row/form).
    container.insertBefore(banner, container.firstChild);
    state.bannerEl = banner;
    return banner;
  }

  function showBanner(message) {
    const banner = ensureBanner();
    if (!banner) return;
    const msg = safeTrim(message);
    if (msg && msg === state.lastBannerMessage && banner.style.display !== "none") return;
    banner.textContent = msg;
    banner.style.display = msg ? "block" : "none";
    state.lastBannerMessage = msg;
  }

  function hideBanner() {
    if (!state.bannerEl) return;
    state.bannerEl.style.display = "none";
    state.bannerEl.textContent = "";
    state.lastBannerMessage = "";
  }

  function maybeAutofillEmployeeId() {
    const employeeInput = getEmployeeInput();
    if (!employeeInput) return;
    try {
      const existing = safeTrim(employeeInput.value);
      if (existing) return;
      const stored = safeTrim(window.localStorage && window.localStorage.getItem(EMPLOYEE_STORAGE_KEY));
      if (!stored) return;
      employeeInput.value = stored;
      employeeInput.dispatchEvent(new Event("input", { bubbles: true }));
      employeeInput.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (_) {}
  }

  function persistEmployeeId(value) {
    try {
      if (!window.localStorage) return;
      const v = safeTrim(value);
      if (!v) return;
      window.localStorage.setItem(EMPLOYEE_STORAGE_KEY, v);
    } catch (_) {}
  }

  async function postEligibility(employeeId, email) {
    const base = safeTrim(API_BASE).replace(/\/+$/, "");
    const url = `${base}/api/tea/eligibility`;

    // Abort any previous request.
    if (state.inFlight && state.inFlight.controller) {
      try {
        state.inFlight.controller.abort();
      } catch (_) {}
    }

    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const pair = `${safeTrim(email).toLowerCase()}|${safeTrim(employeeId)}`;
    const seq = Date.now();
    state.inFlight = { controller, pair, seq };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: safeTrim(employeeId), email: safeTrim(email) }),
      mode: "cors",
      cache: "no-store",
      signal: controller ? controller.signal : undefined
    });

    if (!res.ok) {
      throw new Error(`Eligibility HTTP ${res.status}`);
    }

    const data = await res.json();
    // Ignore responses that are no longer current.
    if (!state.inFlight || state.inFlight.seq !== seq) return null;
    return data;
  }

  function applyDecision(decision) {
    if (!state.cartHasIcedTea) return;
    if (!decision) return;

    if (decision.eligible === true) {
      setOverlayBlocked(false);
      hideBanner();
      state.lastDecision = { eligible: true };
      return;
    }

    const reason = safeTrim(decision.reason) || "Not eligible for iced tea.";
    setOverlayBlocked(true);
    showBanner(reason);
    state.lastDecision = { eligible: false, reason };
  }

  const scheduleEligibilityCheck = debounce(async () => {
    if (!state.cartHasIcedTea) return;

    ensureOverlayClickInterception();
    maybeAutofillEmployeeId();

    const emailInput = getEmailInput();
    const employeeInput = getEmployeeInput();
    const overlay = getOverlay();

    // If required elements aren't present yet, keep polling (up to timeout).
    if (!overlay || !emailInput || !employeeInput) {
      // Block while we expect fields to appear, but only within the polling window.
      if (overlay && state.domPollStartedAt && Date.now() - state.domPollStartedAt <= DOM_POLL_TIMEOUT_MS) {
        setOverlayBlocked(true);
      }
      return;
    }

    const email = safeTrim(emailInput.value);
    const employeeId = safeTrim(employeeInput.value);

    if (!isEmailLike(email) || !employeeId) {
      setOverlayBlocked(true);
      showBanner("Enter your email and S-/E-Number to continue.");
      return;
    }

    persistEmployeeId(employeeId);

    const pair = `${email.toLowerCase()}|${employeeId}`;
    if (pair === state.lastPair && state.lastDecision) {
      applyDecision(state.lastDecision);
      return;
    }

    state.lastPair = pair;
    state.lastDecision = null;
    setOverlayBlocked(true);
    showBanner("Checking eligibility...");

    try {
      const decision = await postEligibility(employeeId, email);
      if (!decision) return; // stale response
      applyDecision(decision);
    } catch (_) {
      setOverlayBlocked(true);
      showBanner("Could not verify eligibility. Try again.");
    }
  }, ELIGIBILITY_DEBOUNCE_MS);

  function attachInputListenersOnce() {
    if (state.listenersAttached) return;
    const emailInput = getEmailInput();
    const employeeInput = getEmployeeInput();
    if (!emailInput || !employeeInput) return;

    state.listenersAttached = true;

    const onAnyInput = () => scheduleEligibilityCheck();

    emailInput.addEventListener("input", onAnyInput);
    emailInput.addEventListener("change", onAnyInput);

    employeeInput.addEventListener("input", (e) => {
      persistEmployeeId(e && e.target ? e.target.value : "");
      onAnyInput();
    });
    employeeInput.addEventListener("change", (e) => {
      persistEmployeeId(e && e.target ? e.target.value : "");
      onAnyInput();
    });
  }

  function stopDomPolling() {
    if (!state.domPollTimer) return;
    clearInterval(state.domPollTimer);
    state.domPollTimer = null;
  }

  function startDomPolling() {
    if (state.domPollTimer) return;
    state.domPollStartedAt = Date.now();

    state.domPollTimer = setInterval(() => {
      if (!state.cartHasIcedTea) {
        stopDomPolling();
        return;
      }

      ensureOverlayClickInterception();
      attachInputListenersOnce();
      ensureBanner();
      maybeAutofillEmployeeId();

      // Once key elements exist, run a check immediately.
      if (getOverlay() && getEmailInput() && getEmployeeInput()) {
        scheduleEligibilityCheck();
        // Keep polling lightly; Ecwid can re-render fields, so don't stop immediately.
      }

      if (Date.now() - state.domPollStartedAt > DOM_POLL_TIMEOUT_MS) {
        // If we couldn't find required fields in time, fail open (don't break checkout).
        stopDomPolling();
        if (state.overlayBlockedByUs) setOverlayBlocked(false);
        hideBanner();
      }
    }, DOM_POLL_MS);
  }

  function evaluateGate(cart) {
    state.cartHasIcedTea = getCartHasIcedTea(cart);

    if (!state.cartHasIcedTea) {
      // Tea not in cart: never block, never show banners.
      stopDomPolling();
      hideBanner();
      setOverlayBlocked(false);
      state.lastPair = "";
      state.lastDecision = null;
      return;
    }

    // Tea in cart: start polling for dynamic Ecwid checkout fields and enforce gating.
    startDomPolling();
    scheduleEligibilityCheck();
  }

  function waitForEcwidAndInit() {
    const startedAt = Date.now();
    const tick = () => {
      const ecwid = window.Ecwid;
      const hasApi =
        ecwid &&
        ecwid.Cart &&
        typeof ecwid.Cart.get === "function" &&
        ecwid.OnCartChanged &&
        typeof ecwid.OnCartChanged.add === "function";

      if (!hasApi) {
        if (Date.now() - startedAt > DOM_POLL_TIMEOUT_MS) return;
        setTimeout(tick, 100);
        return;
      }

      try {
        ecwid.Cart.get((cart) => evaluateGate(cart || {}));
      } catch (_) {}

      try {
        ecwid.OnCartChanged.add((cart) => evaluateGate(cart || {}));
      } catch (_) {}
    };
    tick();
  }

  // Boot
  waitForEcwidAndInit();
})();

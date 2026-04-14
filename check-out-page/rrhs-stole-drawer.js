/* rrhs-stole-drawer.js
 * Right-side S-number drawer for auto-assigning graduation stoles in Ecwid.
 * - Stores S-number locally as the user types.
 * - Looks up assigned stoles from local JSON data.
 * - Fetches the live stole product catalog from Ecwid category API.
 * - Ensures only assigned stole products exist in cart, capped at quantity 1 each.
 */
(function () {
  "use strict";

  if (typeof window === "undefined") return;
  if (window.__RRHS_STOLE_DRAWER__) return;
  window.__RRHS_STOLE_DRAWER__ = true;

  const RRHS_DEBUG =
    window.RRHS_DEBUG === true ||
    (typeof localStorage !== "undefined" && localStorage.getItem("RRHS_DEBUG") === "1");
  const log = (...args) => {
    if (RRHS_DEBUG) console.log("[RRHS stole]", ...args);
  };

  const defaultConfig = Object.freeze({
    apiBase: "https://app.ecwid.com/api/v3",
    storeId: "104841648",
    apiToken: "secret_nHv8GnnhKdESsZuHy4hSpiczWqL1B4JB",
    categoryId: 169641234,
    requestTimeoutMs: 6000,
    storageKey: "rrhs_stole_s_number_v1",
    catalogCacheKey: "rrhs_stole_catalog_v1",
    catalogCacheTtlMs: 5 * 60 * 1000,
    assignmentData: {
      s151579: [
        "Business and Industry (Gold)",
        "STEM (Yellow)"
      ]
    },
    excludedSkus: ["48_sku_main"],
    excludedProductIds: [],
    drawerTitle: "Enter your S-number to add the correct stoles to cart.",
    missingStudentMessage: "No stole found for you please contact your counselor."
  });

  const runtimeConfig =
    window.RRHS_STOLE_CONFIG && typeof window.RRHS_STOLE_CONFIG === "object"
      ? window.RRHS_STOLE_CONFIG
      : {};

  const config = Object.assign({}, defaultConfig, runtimeConfig);

  if (
    runtimeConfig.assignmentData &&
    typeof runtimeConfig.assignmentData === "object" &&
    !Array.isArray(runtimeConfig.assignmentData)
  ) {
    config.assignmentData = runtimeConfig.assignmentData;
  } else if (
    window.RRHS_STOLE_ASSIGNMENTS &&
    typeof window.RRHS_STOLE_ASSIGNMENTS === "object" &&
    !Array.isArray(window.RRHS_STOLE_ASSIGNMENTS)
  ) {
    config.assignmentData = window.RRHS_STOLE_ASSIGNMENTS;
  }

  const state = {
    catalog: [],
    catalogById: new Map(),
    catalogByKey: new Map(),
    selectedProductIds: new Set(),
    selectedSNumber: "",
    lastStatusKey: "",
    isSyncingCart: false,
    pendingSyncReason: "",
    lookupTimer: null,
    addRequested: false,
    refs: {
      root: null,
      toggle: null,
      status: null,
      input: null,
      list: null,
      confirm: null,
      button: null
    }
  };

  function normalizeText(value) {
    return String(value == null ? "" : value)
      .trim()
      .toLowerCase()
      .replace(/^graduation stoles?\s*/i, "")
      .replace(/\s+/g, " ");
  }

  function normalizeSNumber(value) {
    const raw = String(value == null ? "" : value)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
    if (!raw) return "";
    return raw.startsWith("s") ? raw : `s${raw}`;
  }

  function readStorage(key) {
    try {
      return localStorage.getItem(key) || "";
    } catch (_err) {
      return "";
    }
  }

  function writeStorage(key, value) {
    try {
      if (!value) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (_err) {}
  }

  function readCatalogCache() {
    try {
      const raw = localStorage.getItem(config.catalogCacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      if (!Array.isArray(parsed.items)) return null;
      if (Date.now() - Number(parsed.ts || 0) > config.catalogCacheTtlMs) return null;
      return parsed.items;
    } catch (_err) {
      return null;
    }
  }

  function writeCatalogCache(items) {
    try {
      localStorage.setItem(
        config.catalogCacheKey,
        JSON.stringify({
          ts: Date.now(),
          items
        })
      );
    } catch (_err) {}
  }

  function setStatus(text, tone) {
    const statusEl = state.refs.status;
    if (!statusEl) return;
    const safeTone = tone || "neutral";
    const key = `${safeTone}::${text}`;
    if (state.lastStatusKey === key) return;
    state.lastStatusKey = key;
    statusEl.textContent = text;
    statusEl.dataset.tone = safeTone;
  }

  function renderAssignedList(products) {
    const listEl = state.refs.list;
    if (!listEl) return;
    listEl.innerHTML = "";
    const items = Array.isArray(products) ? products : [];
    if (!items.length) {
      const li = document.createElement("li");
      li.textContent = "No assigned stoles yet.";
      listEl.appendChild(li);
      return;
    }
    items.forEach((product) => {
      const li = document.createElement("li");
      li.textContent = product.name;
      listEl.appendChild(li);
    });
  }

  function setDrawerOpen(isOpen) {
    const root = state.refs.root;
    if (!root) return;
    root.dataset.open = isOpen ? "1" : "0";
    if (state.refs.toggle) {
      state.refs.toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      state.refs.toggle.setAttribute("aria-label", isOpen ? "Close stole drawer" : "Open stole drawer");
      state.refs.toggle.textContent = isOpen ? "›" : "‹";
    }
  }

  function updateActionButtonState() {
    const button = state.refs.button;
    if (!button) return;
    const hasAssigned = state.selectedProductIds && state.selectedProductIds.size > 0;
    const confirmed = !!(state.refs.confirm && state.refs.confirm.checked);
    button.disabled = !hasAssigned || !confirmed;
    button.setAttribute("aria-disabled", button.disabled ? "true" : "false");
  }

  function injectStyles() {
    if (document.getElementById("rrhs-stole-drawer-styles")) return;
    const style = document.createElement("style");
    style.id = "rrhs-stole-drawer-styles";
    style.textContent = `
      #rrhs-stole-drawer {
        position: fixed;
        top: 50%;
        right: 0;
        transform: translate3d(0, -50%, 0);
        z-index: 2147483000;
        display: flex;
        align-items: stretch;
        width: min(88vw, 376px);
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
        will-change: transform;
      }
      #rrhs-stole-drawer[data-open="0"] {
        transform: translate3d(calc(100% - 42px), -50%, 0);
      }
      #rrhs-stole-drawer .rrhs-stole-drawer__panel {
        flex: 1 1 auto;
        background: #ffffff;
        border: 1px solid rgba(17, 24, 39, 0.12);
        border-right: 0;
        border-radius: 18px 0 0 18px;
        box-shadow: 0 18px 45px rgba(15, 23, 42, 0.18);
        padding: 18px 18px 16px;
        overflow: hidden;
      }
      #rrhs-stole-drawer .rrhs-stole-drawer__toggle {
        align-self: center;
        width: 42px;
        min-width: 42px;
        height: 72px;
        border: 0;
        border-radius: 14px 0 0 14px;
        background: #7c2d12;
        color: #fff;
        cursor: pointer;
        box-shadow: 0 10px 28px rgba(124, 45, 18, 0.25);
        font-size: 24px;
        line-height: 1;
      }
      #rrhs-stole-drawer .rrhs-stole-drawer__actions {
        display: grid;
        gap: 10px;
        margin-top: 12px;
      }
      #rrhs-stole-drawer .rrhs-stole-drawer__confirm {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        color: #334155;
        font-size: 12px;
        line-height: 1.45;
      }
      #rrhs-stole-drawer .rrhs-stole-drawer__confirm input {
        margin-top: 2px;
      }
      #rrhs-stole-drawer .rrhs-stole-drawer__button {
        height: 42px;
        border: 0;
        border-radius: 12px;
        background: #7c2d12;
        color: #fff;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
      }
      #rrhs-stole-drawer .rrhs-stole-drawer__button[disabled] {
        opacity: 0.45;
        cursor: not-allowed;
      }
      #rrhs-stole-drawer .rrhs-stole-drawer__title {
        margin: 0 0 10px;
        color: #111827;
        font-size: 15px;
        line-height: 1.45;
        font-weight: 700;
      }
      #rrhs-stole-drawer .rrhs-stole-drawer__field {
        display: block;
        margin: 0 0 10px;
      }
      #rrhs-stole-drawer .rrhs-stole-drawer__input {
        width: 100%;
        height: 44px;
        border-radius: 12px;
        border: 1px solid #cbd5e1;
        padding: 0 14px;
        font-size: 15px;
        color: #0f172a;
        background: #fff;
      }
      #rrhs-stole-drawer .rrhs-stole-drawer__hint {
        margin: 0 0 8px;
        color: #475569;
        font-size: 12px;
        line-height: 1.5;
      }
      #rrhs-stole-drawer .rrhs-stole-drawer__status {
        margin: 0;
        min-height: 40px;
        font-size: 13px;
        line-height: 1.45;
        color: #334155;
      }
      #rrhs-stole-drawer .rrhs-stole-drawer__status[data-tone="error"] {
        color: #b91c1c;
      }
      #rrhs-stole-drawer .rrhs-stole-drawer__status[data-tone="success"] {
        color: #166534;
      }
      #rrhs-stole-drawer .rrhs-stole-drawer__list {
        margin: 10px 0 0;
        padding-left: 18px;
        color: #1e293b;
        font-size: 13px;
      }
      #rrhs-stole-drawer .rrhs-stole-drawer__blocked-note {
        margin: 10px 0 0;
        font-size: 12px;
        color: #64748b;
      }
      .rrhs-stole-lock-note {
        margin-top: 8px;
        font-size: 12px;
        color: #b45309;
      }
      @media (max-width: 640px) {
        #rrhs-stole-drawer {
          top: auto;
          bottom: 20px;
          transform: translate3d(0, 0, 0);
        }
        #rrhs-stole-drawer[data-open="0"] {
          transform: translate3d(calc(100% - 42px), 0, 0);
        }
        #rrhs-stole-drawer .rrhs-stole-drawer__toggle {
          height: 60px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function createDrawer() {
    if (document.getElementById("rrhs-stole-drawer")) return;

    injectStyles();

    const root = document.createElement("aside");
    root.id = "rrhs-stole-drawer";
    root.dataset.open = "0";
    root.innerHTML = `
      <button type="button" class="rrhs-stole-drawer__toggle" aria-expanded="false" aria-label="Open stole drawer">‹</button>
      <div class="rrhs-stole-drawer__panel">
        <p class="rrhs-stole-drawer__title">${config.drawerTitle}</p>
        <label class="rrhs-stole-drawer__field" for="rrhs-stole-s-number-input">
          <input
            id="rrhs-stole-s-number-input"
            class="rrhs-stole-drawer__input"
            type="text"
            inputmode="text"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            placeholder="s123456"
          />
        </label>
        <p class="rrhs-stole-drawer__hint">Saved immediately. Review your assigned stoles, then confirm before adding them.</p>
        <p class="rrhs-stole-drawer__status" data-tone="neutral"></p>
        <ul class="rrhs-stole-drawer__list"></ul>
        <div class="rrhs-stole-drawer__actions">
          <label class="rrhs-stole-drawer__confirm" for="rrhs-stole-confirm">
            <input id="rrhs-stole-confirm" type="checkbox" />
            <span>I confirmed these are my assigned stoles.</span>
          </label>
          <button type="button" class="rrhs-stole-drawer__button" disabled aria-disabled="true">Add assigned stoles to cart</button>
        </div>
        <p class="rrhs-stole-drawer__blocked-note">Graduation stoles are locked to counselor-assigned products and capped at one each.</p>
      </div>
    `;

    document.body.appendChild(root);

    state.refs.root = root;
    state.refs.toggle = root.querySelector(".rrhs-stole-drawer__toggle");
    state.refs.status = root.querySelector(".rrhs-stole-drawer__status");
    state.refs.input = root.querySelector(".rrhs-stole-drawer__input");
    state.refs.list = root.querySelector(".rrhs-stole-drawer__list");
    state.refs.confirm = root.querySelector("#rrhs-stole-confirm");
    state.refs.button = root.querySelector(".rrhs-stole-drawer__button");

    state.refs.toggle.addEventListener("click", () => {
      setDrawerOpen(root.dataset.open !== "1");
    });

    state.refs.input.addEventListener("focus", () => setDrawerOpen(true));
    state.refs.input.addEventListener("input", onInputChanged);
    state.refs.input.addEventListener("change", onInputChanged);
    state.refs.confirm.addEventListener("change", updateActionButtonState);
    state.refs.button.addEventListener("click", () => {
      state.addRequested = true;
      processCurrentStudent("manual-add").catch((err) => {
        console.warn("[RRHS stole] Manual add failed", err);
      });
    });
    updateActionButtonState();
  }

  function onInputChanged(event) {
    const raw = event && event.target ? event.target.value : "";
    const normalized = normalizeSNumber(raw);
    writeStorage(config.storageKey, normalized);
    state.selectedSNumber = normalized;
    state.addRequested = false;
    if (state.refs.confirm) state.refs.confirm.checked = false;
    updateActionButtonState();

    if (state.lookupTimer) clearTimeout(state.lookupTimer);
    state.lookupTimer = setTimeout(() => {
      processCurrentStudent("input");
    }, 180);
  }

  function normalizeCatalogItems(items) {
    const excludedIds = new Set((config.excludedProductIds || []).map((id) => Number(id)));
    const excludedSkus = new Set((config.excludedSkus || []).map((sku) => String(sku || "").trim()));

    return (Array.isArray(items) ? items : [])
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const id = Number(item.id || 0);
        if (!Number.isFinite(id) || id <= 0) return null;
        const sku = String(item.sku || "").trim();
        const enabled = item.enabled !== false;
        if (!enabled) return null;
        if (excludedIds.has(id) || excludedSkus.has(sku)) return null;
        const name = String(item.name || "").trim();
        if (!name) return null;
        return {
          id,
          sku,
          name,
          url: String(item.url || "").trim(),
          key: normalizeText(name)
        };
      })
      .filter(Boolean);
  }

  async function fetchJsonWithTimeout(url, opts, timeoutMs) {
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    try {
      const fetchOpts = Object.assign({}, opts);
      if (ctrl) fetchOpts.signal = ctrl.signal;
      const res = await fetch(url, fetchOpts);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  function applyCatalog(items) {
    const normalized = normalizeCatalogItems(items);
    state.catalog = normalized;
    state.catalogById = new Map(normalized.map((item) => [item.id, item]));
    state.catalogByKey = new Map(normalized.map((item) => [item.key, item]));
  }

  async function ensureCatalog() {
    if (state.catalog.length) return state.catalog;

    const cached = readCatalogCache();
    if (cached) applyCatalog(cached);
    if (state.catalog.length) return state.catalog;

    const storeId = encodeURIComponent(String(config.storeId || "").trim());
    const categoryId = encodeURIComponent(String(config.categoryId || "").trim());
    const endpoint =
      `${config.apiBase}/${storeId}/products` +
      `?category=${categoryId}&limit=100&responseFields=items(id,sku,name,url,enabled),count,total`;

    const payload = await fetchJsonWithTimeout(
      endpoint,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${String(config.apiToken || "").trim()}`
        },
        cache: "no-store"
      },
      Number(config.requestTimeoutMs) || 6000
    );

    const items = Array.isArray(payload && payload.items) ? payload.items : [];
    applyCatalog(items);
    writeCatalogCache(items);
    return state.catalog;
  }

  function getRawAssignmentForStudent(sNumber) {
    const key = normalizeSNumber(sNumber);
    if (!key) return [];
    const data =
      config.assignmentData && typeof config.assignmentData === "object" ? config.assignmentData : {};
    const direct = data[key];
    return Array.isArray(direct) ? direct : [];
  }

  function resolveAssignedProducts(sNumber) {
    const rawAssignments = getRawAssignmentForStudent(sNumber);
    const products = [];
    const seen = new Set();

    rawAssignments.forEach((entry) => {
      if (entry == null) return;

      let product = null;
      if (typeof entry === "number") {
        product = state.catalogById.get(Number(entry)) || null;
      } else if (typeof entry === "string") {
        product = state.catalogByKey.get(normalizeText(entry)) || null;
      } else if (typeof entry === "object") {
        const id = Number(entry.productId || entry.id || 0);
        if (id > 0) product = state.catalogById.get(id) || null;
        if (!product && entry.name) product = state.catalogByKey.get(normalizeText(entry.name)) || null;
      }

      if (!product || seen.has(product.id)) return;
      seen.add(product.id);
      products.push(product);
    });

    return products;
  }

  function isStoleCartItem(item) {
    const productId = Number(item && item.product && item.product.id);
    return state.catalogById.has(productId);
  }

  function whenEcwidReady(cb) {
    if (window.Ecwid && window.Ecwid.Cart) {
      cb();
      return;
    }

    const started = Date.now();
    const timer = setInterval(() => {
      if (window.Ecwid && window.Ecwid.Cart) {
        clearInterval(timer);
        cb();
        return;
      }
      if (Date.now() - started > 10000) clearInterval(timer);
    }, 100);
  }

  function ecwidGetCart() {
    return new Promise((resolve, reject) => {
      if (!window.Ecwid || !window.Ecwid.Cart || typeof window.Ecwid.Cart.get !== "function") {
        reject(new Error("Ecwid Cart.get unavailable"));
        return;
      }
      let done = false;
      const timeoutId = setTimeout(() => {
        if (done) return;
        done = true;
        reject(new Error("Ecwid Cart.get timeout"));
      }, 6000);
      window.Ecwid.Cart.get((cart) => {
        if (done) return;
        done = true;
        clearTimeout(timeoutId);
        resolve(cart || {});
      });
    });
  }

  function ecwidAddProduct(product) {
    return new Promise((resolve, reject) => {
      if (!window.Ecwid || !window.Ecwid.Cart || typeof window.Ecwid.Cart.addProduct !== "function") {
        reject(new Error("Ecwid Cart.addProduct unavailable"));
        return;
      }
      let done = false;
      const timeoutId = setTimeout(() => {
        if (done) return;
        done = true;
        reject(new Error("Ecwid Cart.addProduct timeout"));
      }, 6000);

      window.Ecwid.Cart.addProduct(
        Object.assign({}, product, {
          callback: (success, productResult, cart, error) => {
            if (done) return;
            done = true;
            clearTimeout(timeoutId);
            if (!success) {
              reject(new Error(error || "Ecwid Cart.addProduct failed"));
              return;
            }
            resolve({ success, productResult, cart, error });
          }
        })
      );
    });
  }

  function ecwidRemoveProduct(index) {
    return new Promise((resolve, reject) => {
      if (!window.Ecwid || !window.Ecwid.Cart || typeof window.Ecwid.Cart.removeProduct !== "function") {
        reject(new Error("Ecwid Cart.removeProduct unavailable"));
        return;
      }
      let done = false;
      const timeoutId = setTimeout(() => {
        if (done) return;
        done = true;
        reject(new Error("Ecwid Cart.removeProduct timeout"));
      }, 6000);
      window.Ecwid.Cart.removeProduct(index, (success, itemsRemovedQuantity, product, cart, error) => {
        if (done) return;
        done = true;
        clearTimeout(timeoutId);
        if (!success) {
          reject(new Error(error || "Ecwid Cart.removeProduct failed"));
          return;
        }
        resolve({ success, itemsRemovedQuantity, product, cart, error });
      });
    });
  }

  async function syncCartToAssignedProducts(assignedProducts, reason, opts) {
    const options = opts && typeof opts === "object" ? opts : {};
    const addMissing = options.addMissing === true;
    if (state.isSyncingCart) {
      state.pendingSyncReason = reason || "queued";
      return;
    }
    state.isSyncingCart = true;

    try {
      const cart = await ecwidGetCart();
      const items = Array.isArray(cart.items) ? cart.items : [];
      const allowedIds = new Set((assignedProducts || []).map((product) => product.id));
      const removals = [];
      const foundCounts = new Map();

      items.forEach((item, index) => {
        if (!isStoleCartItem(item)) return;
        const productId = Number(item && item.product && item.product.id);
        const currentQty = Math.max(0, Number(item && item.quantity) || 0);
        const nextCount = (foundCounts.get(productId) || 0) + currentQty;
        foundCounts.set(productId, nextCount);

        if (!allowedIds.has(productId)) {
          removals.push(index);
          return;
        }

        if (nextCount > 1) {
          removals.push(index);
        }
      });

      removals.sort((a, b) => b - a);
      for (const index of removals) {
        await ecwidRemoveProduct(index);
      }

      const refreshedCart = removals.length ? await ecwidGetCart() : cart;
      const refreshedItems = Array.isArray(refreshedCart.items) ? refreshedCart.items : [];
      const effectiveCounts = new Map();
      refreshedItems.forEach((item) => {
        if (!isStoleCartItem(item)) return;
        const productId = Number(item && item.product && item.product.id);
        if (!allowedIds.has(productId)) return;
        const qty = Math.max(0, Number(item && item.quantity) || 0);
        if (qty <= 0) return;
        effectiveCounts.set(productId, Math.min(1, (effectiveCounts.get(productId) || 0) + qty));
      });

      if (addMissing) {
        for (const product of assignedProducts) {
          if ((effectiveCounts.get(product.id) || 0) >= 1) continue;
          await ecwidAddProduct({ id: product.id, quantity: 1 });
        }
      }

      log("Cart sync complete", {
        reason,
        allowed: Array.from(allowedIds)
      });
    } finally {
      state.isSyncingCart = false;
      if (state.pendingSyncReason) {
        const nextReason = state.pendingSyncReason;
        state.pendingSyncReason = "";
        syncCartToAssignedProducts(resolveAssignedProducts(state.selectedSNumber), nextReason, { addMissing: state.addRequested });
      }
    }
  }

  async function removeAllStolesFromCart(reason) {
    if (state.isSyncingCart) {
      state.pendingSyncReason = reason || "clear";
      return;
    }
    state.isSyncingCart = true;

    try {
      const cart = await ecwidGetCart();
      const items = Array.isArray(cart.items) ? cart.items : [];
      const indices = items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => isStoleCartItem(item))
        .map(({ index }) => index)
        .sort((a, b) => b - a);

      for (const index of indices) {
        await ecwidRemoveProduct(index);
      }
      log("Removed all stole products from cart", { reason, removed: indices.length });
    } finally {
      state.isSyncingCart = false;
      if (state.pendingSyncReason) {
        const nextReason = state.pendingSyncReason;
        state.pendingSyncReason = "";
        syncCartToAssignedProducts(resolveAssignedProducts(state.selectedSNumber), nextReason, { addMissing: state.addRequested });
      }
    }
  }

  async function processCurrentStudent(reason) {
    try {
      await ensureCatalog();
    } catch (err) {
      console.warn("[RRHS stole] Unable to load stole catalog", err);
      setStatus("Could not load graduation stole data right now.", "error");
      return;
    }

    const sNumber = normalizeSNumber(state.selectedSNumber || readStorage(config.storageKey));
    state.selectedSNumber = sNumber;
    if (state.refs.input && state.refs.input.value !== sNumber) {
      state.refs.input.value = sNumber;
    }

    if (!sNumber) {
      state.selectedProductIds = new Set();
      renderAssignedList([]);
      setStatus("Enter your S-number to add your assigned graduation stoles.", "neutral");
      state.addRequested = false;
      if (state.refs.confirm) state.refs.confirm.checked = false;
      updateActionButtonState();
      await removeAllStolesFromCart(`${reason}:empty`);
      return;
    }

    const assignedProducts = resolveAssignedProducts(sNumber);
    state.selectedProductIds = new Set(assignedProducts.map((product) => product.id));
    renderAssignedList(assignedProducts);

    if (!assignedProducts.length) {
      setStatus(config.missingStudentMessage, "error");
      state.addRequested = false;
      if (state.refs.confirm) state.refs.confirm.checked = false;
      updateActionButtonState();
      await removeAllStolesFromCart(`${reason}:missing`);
      return;
    }

    updateActionButtonState();

    if (state.addRequested) {
      setStatus("Adding your assigned stoles to cart.", "success");
      await syncCartToAssignedProducts(assignedProducts, reason, { addMissing: true });
      state.addRequested = false;
      if (state.refs.confirm) state.refs.confirm.checked = false;
      updateActionButtonState();
      setStatus(`Assigned stoles are locked in your cart: ${assignedProducts.map((product) => product.name).join(", ")}`, "success");
      return;
    }

    await syncCartToAssignedProducts(assignedProducts, `${reason}:enforce`, { addMissing: false });
    setStatus(`Assigned stoles loaded. Check the box and click the button to add: ${assignedProducts.map((product) => product.name).join(", ")}`, "success");
  }

  function bindEcwidEvents() {
    whenEcwidReady(() => {
      if (
        window.Ecwid &&
        window.Ecwid.OnCartChanged &&
        typeof window.Ecwid.OnCartChanged.add === "function"
      ) {
        window.Ecwid.OnCartChanged.add(() => {
          processCurrentStudent("cart-change").catch((err) => {
            console.warn("[RRHS stole] Cart enforcement failed", err);
          });
        });
      }

    });
  }

  function boot() {
    if (!document.body) return;
    createDrawer();
    state.selectedSNumber = normalizeSNumber(readStorage(config.storageKey));
    if (state.refs.input && state.selectedSNumber) {
      state.refs.input.value = state.selectedSNumber;
    }

    processCurrentStudent("boot").catch((err) => {
      console.warn("[RRHS stole] Boot failed", err);
    });
    bindEcwidEvents();
  }

  const runtime = window.RRHS_RUNTIME;
  if (runtime && typeof runtime.onDomChanged === "function") {
    runtime.onDomChanged(() => {
      if (!document.getElementById("rrhs-stole-drawer")) createDrawer();
    }, { runNow: false });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

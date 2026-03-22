/* rrhs-inventory-guard.js
 * Enforces variation-aware inventory checks in Ecwid cart:
 * - Loads current cart on boot (Ecwid.Cart.get)
 * - Re-checks on every cart change (Ecwid.OnCartChanged)
 * - If inventory is below configured threshold, removes the affected cart lines
 */
(function () {
  "use strict";

  if (typeof window === "undefined") return;
  if (window.__RRHS_INVENTORY_GUARD__) return;
  window.__RRHS_INVENTORY_GUARD__ = true;

  const RRHS_DEBUG =
    window.RRHS_DEBUG === true ||
    (typeof localStorage !== "undefined" && localStorage.getItem("RRHS_DEBUG") === "1");
  const log = (...args) => {
    if (RRHS_DEBUG) console.log("[RRHS inventory]", ...args);
  };

  const defaultConfig = Object.freeze({
    apiBase: "https://app.ecwid.com/api/v3",
    storeId: "104841648",
    apiToken: "secret_nHv8GnnhKdESsZuHy4hSpiczWqL1B4JB",
    minRemainingAllowed: 5,
    requestTimeoutMs: 6000,
    cacheTtlMs: 15000
  });

  const runtimeConfig =
    (window.RRHS_INVENTORY_GUARD_CONFIG && typeof window.RRHS_INVENTORY_GUARD_CONFIG === "object")
      ? window.RRHS_INVENTORY_GUARD_CONFIG
      : {};

  const config = Object.assign({}, defaultConfig, runtimeConfig);
  const storeId = String(config.storeId || "").trim();
  const apiToken = String(config.apiToken || "").trim();
  const minRemainingAllowed = Number(config.minRemainingAllowed);
  const cache = new Map();
  const combinationsCache = new Map();
  let warnedMissingAuth = false;
  let isChecking = false;
  let pendingCart = null;

  function hasApiCredentials() {
    return Boolean(storeId) && Boolean(apiToken);
  }

  function toIntOrNull(v) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }

  function normalizeOptionToken(v) {
    return String(v == null ? "" : v)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function buildOptionsMap(raw) {
    if (!raw || typeof raw !== "object") return null;
    const out = {};

    if (!Array.isArray(raw)) {
      const keys = Object.keys(raw);
      for (let i = 0; i < keys.length; i += 1) {
        const k = keys[i];
        const keyNorm = normalizeOptionToken(k);
        if (!keyNorm) continue;
        out[keyNorm] = normalizeOptionToken(raw[k]);
      }
      return Object.keys(out).length ? out : null;
    }

    for (let i = 0; i < raw.length; i += 1) {
      const it = raw[i] && typeof raw[i] === "object" ? raw[i] : null;
      if (!it) continue;
      const name =
        it.name != null ? it.name
          : (it.title != null ? it.title
            : (it.optionName != null ? it.optionName : ""));
      const value =
        it.value != null ? it.value
          : (it.text != null ? it.text
            : (it.optionValue != null ? it.optionValue : ""));
      const keyNorm = normalizeOptionToken(name);
      if (!keyNorm) continue;
      out[keyNorm] = normalizeOptionToken(value);
    }

    return Object.keys(out).length ? out : null;
  }

  function optionsMatch(lineOptions, combinationOptions) {
    if (!lineOptions || !combinationOptions) return false;
    const keys = Object.keys(lineOptions);
    if (!keys.length) return false;
    for (let i = 0; i < keys.length; i += 1) {
      const k = keys[i];
      if (String(combinationOptions[k] || "") !== String(lineOptions[k] || "")) {
        return false;
      }
    }
    return true;
  }

  function combinationSelectedOptions(combination) {
    if (!combination || typeof combination !== "object") return null;
    if (combination.options) return buildOptionsMap(combination.options);
    if (combination.optionValues) return buildOptionsMap(combination.optionValues);
    if (combination.selectedOptions) return buildOptionsMap(combination.selectedOptions);
    return null;
  }

  function lineKey(productId, variationId) {
    return `${productId}:${variationId == null ? "base" : variationId}`;
  }

  function parseInStock(payload) {
    if (!payload || typeof payload !== "object") return null;
    if (typeof payload.inStock === "boolean") return payload.inStock;
    if (typeof payload.instock === "boolean") return payload.instock;
    return null;
  }

  function parseInventory(payload) {
    const unlimited = payload && payload.unlimited === true;
    const quantityRaw = payload ? payload.quantity : null;
    const quantity = Number.isFinite(Number(quantityRaw)) ? Number(quantityRaw) : null;
    const inStock = parseInStock(payload);
    return { unlimited, quantity, inStock };
  }

  function isBlockedByInventory(inventory) {
    if (!inventory) return false;
    if (inventory.unlimited) return false;
    if (Number.isFinite(inventory.quantity)) return inventory.quantity < minRemainingAllowed;
    if (inventory.inStock === false) return true;
    return false;
  }

  async function fetchJsonWithTimeout(url, opts, timeoutMs) {
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const t = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    try {
      const fetchOpts = Object.assign({}, opts);
      if (ctrl) fetchOpts.signal = ctrl.signal;
      const res = await fetch(url, fetchOpts);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      if (t) clearTimeout(t);
    }
  }

  async function fetchInventory(productId, variationId) {
    const key = lineKey(productId, variationId);
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && now - cached.ts < config.cacheTtlMs) return cached.data;

    if (!hasApiCredentials()) {
      if (!warnedMissingAuth) {
        warnedMissingAuth = true;
        console.warn(
          "[RRHS inventory] Missing Ecwid API credentials. Set window.RRHS_INVENTORY_GUARD_CONFIG.storeId/apiToken."
        );
      }
      return null;
    }

    const headers = { Authorization: `Bearer ${apiToken}` };
    const encodedStoreId = encodeURIComponent(storeId);
    const encodedProductId = encodeURIComponent(String(productId));
    const endpoint =
      variationId == null
        ? `${config.apiBase}/${encodedStoreId}/products/${encodedProductId}?responseFields=id,name,quantity,unlimited,inStock`
        : `${config.apiBase}/${encodedStoreId}/products/${encodedProductId}/combinations/${encodeURIComponent(
            String(variationId)
          )}?responseFields=id,quantity,unlimited,inStock,instock`;

    try {
      const payload = await fetchJsonWithTimeout(
        endpoint,
        {
          method: "GET",
          headers,
          cache: "no-store"
        },
        config.requestTimeoutMs
      );
      const parsed = parseInventory(payload);
      cache.set(key, { ts: now, data: parsed });
      return parsed;
    } catch (err) {
      console.warn("[RRHS inventory] Inventory lookup failed", {
        productId,
        variationId,
        error: err && err.message ? err.message : String(err)
      });
      return null;
    }
  }

  async function fetchProductCombinations(productId) {
    const key = String(productId);
    const now = Date.now();
    const cached = combinationsCache.get(key);
    if (cached && now - cached.ts < config.cacheTtlMs) return cached.data;

    if (!hasApiCredentials()) return null;
    const headers = { Authorization: `Bearer ${apiToken}` };
    const encodedStoreId = encodeURIComponent(storeId);
    const encodedProductId = encodeURIComponent(String(productId));
    const endpoint =
      `${config.apiBase}/${encodedStoreId}/products/${encodedProductId}/combinations` +
      `?responseFields=id,enabled,inStock,instock,quantity,unlimited,options,optionValues,selectedOptions`;

    try {
      const payload = await fetchJsonWithTimeout(
        endpoint,
        { method: "GET", headers, cache: "no-store" },
        config.requestTimeoutMs
      );
      const list = Array.isArray(payload)
        ? payload
        : (payload && Array.isArray(payload.items) ? payload.items : []);
      combinationsCache.set(key, { ts: now, data: list });
      return list;
    } catch (err) {
      console.warn("[RRHS inventory] Combinations lookup failed", {
        productId,
        error: err && err.message ? err.message : String(err)
      });
      return null;
    }
  }

  async function resolveVariationIdByOptions(productId, lineOptions) {
    if (!lineOptions || !Object.keys(lineOptions).length) return null;
    const combinations = await fetchProductCombinations(productId);
    if (!Array.isArray(combinations) || !combinations.length) return null;

    const matches = [];
    for (let i = 0; i < combinations.length; i += 1) {
      const combo = combinations[i];
      if (!combo || typeof combo !== "object") continue;
      if (combo.enabled === false) continue;
      const comboOptions = combinationSelectedOptions(combo);
      if (!comboOptions) continue;
      if (!optionsMatch(lineOptions, comboOptions)) continue;
      const id = toIntOrNull(combo.id);
      if (id != null && id > 0) matches.push(id);
    }
    if (matches.length === 1) return matches[0];
    return null;
  }

  function ensureModal() {
    let root = document.getElementById("rrhs-inventory-toast");
    if (root) return root;

    root = document.createElement("div");
    root.id = "rrhs-inventory-toast";
    root.style.cssText = [
      "position:fixed",
      "top:84px",
      "right:16px",
      "left:auto",
      "display:none",
      "width:calc(100vw - 32px)",
      "max-width:420px",
      "z-index:2147483647",
      "transform:translateX(110%)",
      "opacity:0"
    ].join(";");

    const card = document.createElement("div");
    card.style.cssText = [
      "width:100%",
      "background:#670000",
      "color:#EBEBE2",
      "border-radius:8px",
      "box-shadow:0 10px 30px rgba(0,0,0,0.2)",
      "padding:14px 44px 14px 14px",
      "font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
      "position:relative"
    ].join(";");

    const body = document.createElement("p");
    body.id = "rrhs-inventory-toast-body";
    body.style.cssText = "margin:0;font-size:14px;line-height:1.4;color:#EBEBE2;";

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "×";
    button.style.cssText = [
      "position:absolute",
      "top:8px",
      "right:10px",
      "border:none",
      "background:transparent",
      "padding:0",
      "margin:0",
      "color:#EBEBE2",
      "font-size:24px",
      "line-height:1",
      "opacity:0.8",
      "cursor:pointer"
    ].join(";");
    button.addEventListener("click", () => {
      hideInventoryToast();
    });

    card.appendChild(body);
    card.appendChild(button);
    root.appendChild(card);
    (document.body || document.documentElement).appendChild(root);
    return root;
  }

  function positionToastNearCartIcon(root) {
    if (!root) return;
    const candidates = [
      ".ec-minicart__icon",
      ".ec-minicart",
      ".ec-cart-widget",
      ".ec-header-has-cart .ec-header__cart"
    ];
    let anchor = null;
    for (let i = 0; i < candidates.length; i += 1) {
      const found = document.querySelector(candidates[i]);
      if (found) {
        anchor = found;
        break;
      }
    }
    if (!anchor || typeof anchor.getBoundingClientRect !== "function") return;
    const rect = anchor.getBoundingClientRect();
    const top = Math.max(12, Math.round(rect.bottom + 8));
    root.style.top = `${top}px`;
  }

  let hideTimer = null;
  function hideInventoryToast() {
    const root = document.getElementById("rrhs-inventory-toast");
    if (!root) return;
    root.style.transition = "transform 0.25s ease, opacity 0.25s ease";
    root.style.transform = "translateX(110%)";
    root.style.opacity = "0";
    setTimeout(() => {
      root.style.display = "none";
    }, 250);
  }

  function showInventoryModal(productNames) {
    const root = ensureModal();
    const body = root.querySelector("#rrhs-inventory-toast-body");
    const names = Array.from(new Set((productNames || []).filter(Boolean)));
    const list = names.length ? ` (${names.join(", ")})` : "";
    body.textContent =
      `We're sorry, we don't have enough inventory${list}. ` +
      `Items with fewer than ${minRemainingAllowed} remaining are unavailable and were removed from your cart.`;
    if (hideTimer) clearTimeout(hideTimer);
    root.style.display = "block";
    positionToastNearCartIcon(root);
    root.style.transition = "none";
    root.style.transform = "translateX(110%)";
    root.style.opacity = "0";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.style.transition = "transform 0.35s ease, opacity 0.35s ease";
        root.style.transform = "translateX(0)";
        root.style.opacity = "1";
      });
    });
    hideTimer = setTimeout(hideInventoryToast, 6000);
  }

  function removeIndexes(indexes) {
    return new Promise((resolve) => {
      if (!window.Ecwid || !window.Ecwid.Cart) return resolve(false);
      if (!Array.isArray(indexes) || !indexes.length) return resolve(true);

      const sorted = Array.from(new Set(indexes))
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n >= 0)
        .sort((a, b) => a - b);
      if (!sorted.length) return resolve(true);

      if (typeof window.Ecwid.Cart.removeProducts === "function") {
        window.Ecwid.Cart.removeProducts(sorted, (success) => resolve(Boolean(success)));
        return;
      }

      // Fallback for environments where removeProducts is unavailable.
      let i = sorted.length - 1;
      function next() {
        if (i < 0) return resolve(true);
        const idx = sorted[i];
        i -= 1;
        window.Ecwid.Cart.removeProduct(idx, () => next());
      }
      next();
    });
  }

  async function checkCart(cart, source) {
    if (!cart || !Array.isArray(cart.items) || !cart.items.length) return;
    if (!Number.isFinite(minRemainingAllowed) || minRemainingAllowed < 1) return;

    const rawLines = cart.items.map((item, index) => {
      const product = item && item.product ? item.product : {};
      const productId = toIntOrNull(product.id);
      const variationIdRaw = toIntOrNull(product.variation);
      const variationId = variationIdRaw && variationIdRaw > 0 ? variationIdRaw : null;
      const lineOptions = buildOptionsMap(item && item.options ? item.options : null);
      return {
        index,
        productId,
        variationId,
        lineOptions,
        name: String(product.name || "").trim()
      };
    }).filter((line) => line.productId != null);

    const lines = await Promise.all(
      rawLines.map(async (line) => {
        if (line.variationId != null) {
          return Object.assign({}, line, { effectiveVariationId: line.variationId });
        }
        if (line.lineOptions && Object.keys(line.lineOptions).length) {
          const resolvedVariationId = await resolveVariationIdByOptions(line.productId, line.lineOptions);
          return Object.assign({}, line, { effectiveVariationId: resolvedVariationId });
        }
        return Object.assign({}, line, { effectiveVariationId: null });
      })
    );

    if (!lines.length) return;

    const unique = [];
    const seen = new Set();
    for (let i = 0; i < lines.length; i += 1) {
      const k = lineKey(lines[i].productId, lines[i].effectiveVariationId);
      if (seen.has(k)) continue;
      seen.add(k);
      unique.push(lines[i]);
    }

    const inventoryPairs = await Promise.all(
      unique.map(async (line) => {
        // If options exist but we still couldn't resolve a specific variation,
        // skip product-level blocking to avoid removing all variations incorrectly.
        if (line.effectiveVariationId == null && line.lineOptions && Object.keys(line.lineOptions).length) {
          return [lineKey(line.productId, line.effectiveVariationId), null];
        }
        const inventory = await fetchInventory(line.productId, line.effectiveVariationId);
        return [lineKey(line.productId, line.effectiveVariationId), inventory];
      })
    );

    const blockedKeys = new Set();
    for (let i = 0; i < inventoryPairs.length; i += 1) {
      const [k, inventory] = inventoryPairs[i];
      if (isBlockedByInventory(inventory)) blockedKeys.add(k);
    }
    if (!blockedKeys.size) return;

    const indexesToRemove = [];
    const removedNames = [];
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const k = lineKey(line.productId, line.effectiveVariationId);
      if (!blockedKeys.has(k)) continue;
      indexesToRemove.push(line.index);
      if (line.name) removedNames.push(line.name);
    }
    if (!indexesToRemove.length) return;

    log("Removing low inventory lines", { source, indexesToRemove, removedNames });
    await removeIndexes(indexesToRemove);
    showInventoryModal(removedNames);
  }

  async function runCheck(cart, source) {
    pendingCart = cart;
    if (isChecking) return;
    isChecking = true;
    try {
      while (pendingCart) {
        const nextCart = pendingCart;
        pendingCart = null;
        await checkCart(nextCart, source);
      }
    } finally {
      isChecking = false;
    }
  }

  function startWhenEcwidReady() {
    const timeoutAt = Date.now() + 20000;
    const poll = () => {
      if (window.Ecwid && window.Ecwid.Cart && window.Ecwid.OnCartChanged) {
        try {
          window.Ecwid.Cart.get((cart) => runCheck(cart, "init"));
        } catch (e) {
          console.warn("[RRHS inventory] Initial Ecwid.Cart.get failed", e);
        }
        try {
          window.Ecwid.OnCartChanged.add((cart) => runCheck(cart, "change"));
        } catch (e) {
          console.warn("[RRHS inventory] Ecwid.OnCartChanged binding failed", e);
        }
        return;
      }
      if (Date.now() > timeoutAt) {
        console.warn("[RRHS inventory] Ecwid API not detected; inventory guard not started.");
        return;
      }
      setTimeout(poll, 250);
    };
    poll();
  }

  startWhenEcwidReady();
})();

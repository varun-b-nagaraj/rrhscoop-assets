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

  function ensureModal() {
    let root = document.getElementById("rrhs-inventory-modal");
    if (root) return root;

    root = document.createElement("div");
    root.id = "rrhs-inventory-modal";
    root.style.cssText = [
      "position:fixed",
      "inset:0",
      "display:none",
      "align-items:center",
      "justify-content:center",
      "background:rgba(0,0,0,0.45)",
      "z-index:2147483647",
      "padding:16px"
    ].join(";");

    const card = document.createElement("div");
    card.style.cssText = [
      "max-width:520px",
      "width:100%",
      "background:#fff",
      "border-radius:12px",
      "box-shadow:0 10px 30px rgba(0,0,0,0.2)",
      "padding:16px 16px 14px",
      "font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"
    ].join(";");

    const title = document.createElement("h3");
    title.textContent = "Item removed from cart";
    title.style.cssText = "margin:0 0 8px;font-size:18px;line-height:1.25;color:#111;";

    const body = document.createElement("p");
    body.id = "rrhs-inventory-modal-body";
    body.style.cssText = "margin:0 0 14px;font-size:14px;line-height:1.45;color:#222;";

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "OK";
    button.style.cssText = [
      "border:0",
      "border-radius:8px",
      "padding:8px 14px",
      "font-size:14px",
      "font-weight:600",
      "color:#fff",
      "background:#111",
      "cursor:pointer"
    ].join(";");
    button.addEventListener("click", () => {
      root.style.display = "none";
    });

    card.appendChild(title);
    card.appendChild(body);
    card.appendChild(button);
    root.appendChild(card);
    root.addEventListener("click", (e) => {
      if (e.target === root) root.style.display = "none";
    });
    (document.body || document.documentElement).appendChild(root);
    return root;
  }

  function showInventoryModal(productNames) {
    const root = ensureModal();
    const body = root.querySelector("#rrhs-inventory-modal-body");
    const names = Array.from(new Set((productNames || []).filter(Boolean)));
    const list = names.length ? ` (${names.join(", ")})` : "";
    body.textContent =
      `We're sorry, we don't have enough inventory${list}. ` +
      `Items with fewer than ${minRemainingAllowed} remaining are unavailable and were removed from your cart.`;
    root.style.display = "flex";
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

    const lines = cart.items.map((item, index) => {
      const product = item && item.product ? item.product : {};
      const productId = toIntOrNull(product.id);
      const variationIdRaw = toIntOrNull(product.variation);
      const variationId = variationIdRaw && variationIdRaw > 0 ? variationIdRaw : null;
      return {
        index,
        productId,
        variationId,
        name: String(product.name || "").trim()
      };
    }).filter((line) => line.productId != null);

    if (!lines.length) return;

    const unique = [];
    const seen = new Set();
    for (let i = 0; i < lines.length; i += 1) {
      const k = lineKey(lines[i].productId, lines[i].variationId);
      if (seen.has(k)) continue;
      seen.add(k);
      unique.push(lines[i]);
    }

    const inventoryPairs = await Promise.all(
      unique.map(async (line) => {
        const inventory = await fetchInventory(line.productId, line.variationId);
        return [lineKey(line.productId, line.variationId), inventory];
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
      const k = lineKey(line.productId, line.variationId);
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

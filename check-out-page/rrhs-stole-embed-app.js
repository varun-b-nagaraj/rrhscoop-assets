(function () {
  "use strict";
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__RRHS_STOLE_EMBED_APP__) return;
  window.__RRHS_STOLE_EMBED_APP__ = true;

  const cfg = Object.assign({
    mountId: "rrhs-stole-app",
    storeId: "104841648",
    apiToken: "",
    apiBase: "https://app.ecwid.com/api/v3",
    categoryId: 169641234,
    excludedSkus: ["48_sku_main"],
    fallbackCatalog: [],
    assignments: {}
  }, window.RRHS_STOLE_EMBED_CONFIG || {});

  const root = document.getElementById(cfg.mountId);
  if (!root) return;

  const state = {
    catalogById: new Map(),
    catalogByName: new Map(),
    assigned: [],
    selectedIds: new Set(),
    lockedIds: new Set(),
    syncing: false
  };

  if (!document.getElementById("rrhs-stole-embed-styles")) {
    const style = document.createElement("style");
    style.id = "rrhs-stole-embed-styles";
    style.textContent = `
      #rrhs-stole-app{font-family:"Avenir Next","Segoe UI",Arial,sans-serif;max-width:1080px;margin:24px auto;padding:0 16px;color:#111827}
      #rrhs-stole-app .hero{border:1px solid #e2e8f0;border-radius:16px;padding:18px;background:#fff}
      #rrhs-stole-app .login{display:grid;grid-template-columns:1fr auto;gap:10px;margin-top:10px}
      #rrhs-stole-app input{height:44px;border:1px solid #cbd5e1;border-radius:12px;padding:0 12px}
      #rrhs-stole-app button{height:44px;border:0;border-radius:12px;background:#7c2d12;color:#fff;font-weight:700;padding:0 14px;cursor:pointer}
      #rrhs-stole-app button[disabled]{opacity:.45;cursor:not-allowed}
      #rrhs-stole-app .status{min-height:20px;margin-top:8px}.error{color:#b91c1c}.ok{color:#166534}
      #rrhs-stole-app .main{display:none;margin-top:14px;grid-template-columns:1fr 300px;gap:14px}
      #rrhs-stole-app .panel{border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;background:#fff}
      #rrhs-stole-app .head{padding:10px 12px;border-bottom:1px solid #e2e8f0;background:#fafafa;display:flex;justify-content:space-between}
      #rrhs-stole-app .rows{padding:8px}
      #rrhs-stole-app .row{border:1px solid #e2e8f0;border-radius:10px;margin-bottom:8px;overflow:hidden}
      #rrhs-stole-app .row.locked{background:#f8fafc;opacity:.75}
      #rrhs-stole-app .row-top{display:grid;grid-template-columns:22px 1fr auto auto;gap:8px;align-items:center;padding:10px}
      #rrhs-stole-app .row-name{font-weight:700}
      #rrhs-stole-app .badge{font-size:11px;border:1px solid #d1d5db;border-radius:999px;padding:2px 8px}
      #rrhs-stole-app .row-body{max-height:0;overflow:hidden;transition:max-height .2s ease}
      #rrhs-stole-app .row.open .row-body{max-height:200px;border-top:1px solid #e2e8f0}
      #rrhs-stole-app .row-body-in{padding:10px;color:#334155;font-size:14px}
      #rrhs-stole-app .summary{padding:12px;display:grid;gap:10px}
      #rrhs-stole-app .line{display:flex;justify-content:space-between}
      #rrhs-stole-app .total{font-size:22px;font-weight:800}
      @media (max-width:900px){#rrhs-stole-app .main{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  root.innerHTML = `
    <section class="hero">
      <h2 style="margin:0 0 6px;">Graduation Stoles</h2>
      <p style="margin:0;color:#64748b;">Enter your S-number. Only authorized students will see stoles.</p>
      <div class="login">
        <input id="rrhs-s-number" type="text" placeholder="s123456" autocomplete="off"/>
        <button id="rrhs-login" type="button">Continue</button>
      </div>
      <div id="rrhs-status" class="status"></div>
    </section>
    <section id="rrhs-main" class="main">
      <div class="panel">
        <div class="head"><strong>Your Eligible Stoles</strong><span id="rrhs-count"></span></div>
        <div id="rrhs-rows" class="rows"></div>
      </div>
      <div class="panel">
        <div class="head"><strong>Order Summary</strong></div>
        <div class="summary">
          <div class="line"><span>Selected</span><strong id="rrhs-sel-count">0</strong></div>
          <div class="line"><span>Total</span><span class="total" id="rrhs-total">$0.00</span></div>
          <button id="rrhs-add" type="button" disabled>Add Selected To Cart</button>
          <div style="font-size:12px;color:#64748b">Items already in cart are locked. Qty is enforced to 1.</div>
        </div>
      </div>
    </section>
  `;

  const els = {
    input: root.querySelector("#rrhs-s-number"),
    login: root.querySelector("#rrhs-login"),
    status: root.querySelector("#rrhs-status"),
    main: root.querySelector("#rrhs-main"),
    rows: root.querySelector("#rrhs-rows"),
    count: root.querySelector("#rrhs-count"),
    selCount: root.querySelector("#rrhs-sel-count"),
    total: root.querySelector("#rrhs-total"),
    add: root.querySelector("#rrhs-add")
  };

  const nS = (v) => { const t = String(v || "").trim().toLowerCase().replace(/\s+/g, ""); return t ? (t.startsWith("s") ? t : `s${t}`) : ""; };
  const money = (n) => `$${(Number(n || 0)).toFixed(2)}`;
  const setStatus = (text, kind) => { els.status.textContent = text || ""; els.status.className = `status ${kind || ""}`.trim(); };

  function setCatalog(items) {
    const clean = (Array.isArray(items) ? items : []).filter((p) => p && p.enabled !== false && !cfg.excludedSkus.includes(String(p.sku || "").trim()));
    state.catalogById = new Map(clean.map((p) => [Number(p.id), p]));
    state.catalogByName = new Map(clean.map((p) => [String(p.name || "").trim().toLowerCase(), p]));
  }

  async function fetchCatalog() {
    const token = String(cfg.apiToken || "").trim();
    if (!token || token === "REPLACE_WITH_TOKEN") { setCatalog(cfg.fallbackCatalog); return; }
    const url = `${cfg.apiBase}/${encodeURIComponent(cfg.storeId)}/products?category=${encodeURIComponent(cfg.categoryId)}&limit=100`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!res.ok) throw new Error(`Catalog fetch failed: ${res.status}`);
      const json = await res.json();
      setCatalog(json.items || []);
      if (!state.catalogById.size) setCatalog(cfg.fallbackCatalog);
    } catch (_e) {
      setCatalog(cfg.fallbackCatalog);
    }
  }

  function resolveAssigned(sNumber) {
    if (!Object.prototype.hasOwnProperty.call(cfg.assignments || {}, sNumber)) return [];
    const raw = cfg.assignments[sNumber] || [];
    const seen = new Set();
    const out = [];
    raw.forEach((entry) => {
      let p = null; let meta = { description: "", color: "" };
      if (typeof entry === "number") p = state.catalogById.get(Number(entry)) || null;
      else if (typeof entry === "string") p = state.catalogByName.get(entry.trim().toLowerCase()) || null;
      else if (entry && typeof entry === "object") {
        const id = Number(entry.productId || entry.id || 0);
        if (id > 0) p = state.catalogById.get(id) || null;
        if (!p && entry.name) p = state.catalogByName.get(String(entry.name).trim().toLowerCase()) || null;
        meta = { description: String(entry.description || ""), color: String(entry.color || "") };
      }
      if (!p || seen.has(p.id)) return;
      seen.add(p.id);
      out.push({ id: Number(p.id), name: String(p.name || ""), price: Number(p.price || 0), url: String(p.url || ""), description: meta.description, color: meta.color });
    });
    return out;
  }

  function ecwidReady() { return new Promise((resolve, reject) => { const s = Date.now(); const t = setInterval(() => { if (window.Ecwid && Ecwid.Cart) { clearInterval(t); resolve(); } else if (Date.now() - s > 10000) { clearInterval(t); reject(new Error("Ecwid storefront JS not found")); } }, 120); }); }
  function cartGet() { return new Promise((resolve, reject) => { if (!window.Ecwid || !Ecwid.Cart || typeof Ecwid.Cart.get !== "function") { reject(new Error("Cart.get unavailable")); return; } Ecwid.Cart.get((c) => resolve(c || {})); }); }
  function cartAdd(id, quantity) { return new Promise((resolve, reject) => { if (!window.Ecwid || !Ecwid.Cart || typeof Ecwid.Cart.addProduct !== "function") { reject(new Error("Cart.addProduct unavailable")); return; } Ecwid.Cart.addProduct({ id, quantity, callback: (ok, p, c, e) => ok ? resolve({ p, c }) : reject(new Error(e || "addProduct failed")) }); }); }
  function cartRemove(i) { return new Promise((resolve, reject) => { if (!window.Ecwid || !Ecwid.Cart || typeof Ecwid.Cart.removeProduct !== "function") { reject(new Error("Cart.removeProduct unavailable")); return; } Ecwid.Cart.removeProduct(i, (ok, q, p, c, e) => ok ? resolve({ q, p, c }) : reject(new Error(e || "removeProduct failed"))); }); }

  async function readLocked() {
    const ids = new Set(state.assigned.map((x) => x.id));
    const locked = new Set();
    const cart = await cartGet();
    (Array.isArray(cart.items) ? cart.items : []).forEach((it) => {
      const id = Number(it && it.product && it.product.id);
      const qty = Math.max(0, Number(it && it.quantity) || 0);
      if (qty > 0 && ids.has(id)) locked.add(id);
    });
    state.lockedIds = locked;
  }

  async function enforce() {
    if (state.syncing) return;
    state.syncing = true;
    try {
      const allowed = new Set(state.assigned.map((x) => x.id));
      const cart = await cartGet();
      const items = Array.isArray(cart.items) ? cart.items : [];
      const group = new Map(); const removeIdx = [];
      items.forEach((it, i) => {
        const id = Number(it && it.product && it.product.id);
        const qty = Math.max(0, Number(it && it.quantity) || 0);
        if (!state.catalogById.has(id)) return;
        if (!allowed.has(id)) { removeIdx.push(i); return; }
        const g = group.get(id) || { total: 0, idx: [] };
        g.total += qty; g.idx.push(i); group.set(id, g);
      });
      group.forEach((g) => { if (!(g.total <= 1 && g.idx.length === 1)) g.idx.forEach((i) => removeIdx.push(i)); });
      removeIdx.sort((a, b) => b - a);
      for (const i of removeIdx) await cartRemove(i);
      for (const [id, g] of group.entries()) if (g.total >= 1) await cartAdd(id, 1);
    } finally { state.syncing = false; }
  }

  function updateSummary() {
    const selected = state.assigned.filter((x) => state.selectedIds.has(x.id) && !state.lockedIds.has(x.id));
    const total = selected.reduce((sum, x) => sum + Number(x.price || 0), 0);
    els.selCount.textContent = String(selected.length);
    els.total.textContent = money(total);
    els.add.disabled = selected.length === 0;
  }

  function renderRows() {
    els.rows.innerHTML = "";
    els.count.textContent = `${state.assigned.length} item(s)`;
    state.selectedIds = new Set([...state.selectedIds].filter((id) => !state.lockedIds.has(id)));
    state.assigned.forEach((item, idx) => {
      const locked = state.lockedIds.has(item.id);
      const checked = locked || state.selectedIds.has(item.id);
      const row = document.createElement("article");
      row.className = `row ${locked ? "locked" : ""}`;
      row.innerHTML = `<div class="row-top" role="button" aria-expanded="false" tabindex="0"><input type="checkbox" ${checked ? "checked" : ""} ${locked ? "disabled" : ""} /><div class="row-name">${item.name}</div><span class="badge">${locked ? "Already in cart" : "Eligible"}</span><div>${money(item.price)} ▾</div></div><div class="row-body"><div class="row-body-in"><div><strong>Color:</strong> ${item.color || "Assigned by pathway"}</div><div style="margin-top:6px;">${item.description || "Official graduation stole approved for your pathway."}</div>${item.url ? `<div style="margin-top:8px;"><a href="${item.url}" target="_blank" rel="noopener">View product page</a></div>` : ""}</div></div>`;
      const top = row.querySelector(".row-top");
      const cb = row.querySelector("input[type='checkbox']");
      const toggle = (force) => { const open = typeof force === "boolean" ? force : !row.classList.contains("open"); row.classList.toggle("open", open); top.setAttribute("aria-expanded", open ? "true" : "false"); };
      top.addEventListener("click", (e) => { if (e.target === cb) return; toggle(); });
      top.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
      cb.addEventListener("change", () => { if (cb.checked) state.selectedIds.add(item.id); else state.selectedIds.delete(item.id); updateSummary(); });
      if (idx === 0) toggle(true);
      els.rows.appendChild(row);
    });
    updateSummary();
  }

  async function addSelected() {
    const selected = state.assigned.filter((x) => state.selectedIds.has(x.id) && !state.lockedIds.has(x.id));
    if (!selected.length) return;
    setStatus("Adding selected stoles to cart...", "ok");
    for (const item of selected) await cartAdd(item.id, 1);
    await enforce();
    await readLocked();
    renderRows();
    setStatus("Selected stoles added. Items already in cart are now locked.", "ok");
  }

  async function loginFlow() {
    try {
      const sNum = nS(els.input.value);
      if (!sNum) { setStatus("Enter your S-number.", "error"); return; }
      setStatus("Loading your stole options...", "");
      if (!state.catalogById.size) await fetchCatalog();
      state.assigned = resolveAssigned(sNum);
      if (!state.assigned.length) { els.main.style.display = "none"; setStatus("No stole found for you please contact your counselor.", "error"); return; }
      await ecwidReady();
      await enforce();
      await readLocked();
      renderRows();
      els.main.style.display = "grid";
      setStatus(`Loaded ${state.assigned.length} eligible stole(s).`, "ok");
    } catch (err) {
      console.error(err);
      setStatus(`Could not load stoles: ${err.message}`, "error");
    }
  }

  els.login.addEventListener("click", loginFlow);
  els.input.addEventListener("keydown", (e) => { if (e.key === "Enter") loginFlow(); });
  els.add.addEventListener("click", () => addSelected().catch((e) => setStatus(e.message, "error")));

  ecwidReady().then(() => {
    if (window.Ecwid && Ecwid.OnCartChanged && typeof Ecwid.OnCartChanged.add === "function") {
      Ecwid.OnCartChanged.add(() => {
        if (!state.assigned.length) return;
        enforce().then(readLocked).then(renderRows).catch(() => {});
      });
    }
  }).catch(() => {});
})();

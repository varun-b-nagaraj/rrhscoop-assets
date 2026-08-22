/* index.js - loader that injects visuals and checkout scripts for embed */
(function () {
  function loadScript(src, opts) {
    return new Promise((resolve, reject) => {
      try {
        const s = document.createElement('script');
        s.src = src;
        s.async = false;
        if (opts && opts.type) s.type = opts.type;
        s.onload = () => resolve(src);
        s.onerror = (e) => reject(e);
        (document.head || document.documentElement).appendChild(s);
      } catch (err) { reject(err); }
    });
  }

  function baseForCurrentScript() {
    const cur = document.currentScript;
    if (!cur || !cur.src) return './';
    return new URL('.', cur.src).href;
  }

  const base = baseForCurrentScript();
  const runtime = new URL('rrhs-runtime.js', base).href;
  const visuals = new URL('custom-visuals/rrhscoop-visuals.js?v=12', base).href;
  const checkout = new URL('check-out-page/rrhscoop-checkout.js', base).href;
  const inventoryGuard = new URL('check-out-page/rrhs-inventory-guard.js', base).href;
  const stoleDrawer = new URL('check-out-page/rrhs-stole-drawer.js', base).href;
  const icedTeaGate = new URL('order-validate/rrhs-iced-tea-gate.js', base).href;
  const agent = new URL('agent/rrhscoop-assistant.js', base).href;
  const stoleDrawerEnabled = false;
  const assistantEnabled = false;

  function loadOptionalScript(enabled, src) {
    if (!enabled) return Promise.resolve();
    return loadScript(src).catch(() => {});
  }

  // Load runtime -> visuals -> checkout -> inventory guard -> optional stole drawer
  // -> iced tea gate -> optional assistant (sequential to keep deterministic ordering).
  // The optional scripts and their implementations remain available for future use.
  loadScript(runtime)
    .catch(() => {})
    .then(() => loadScript(visuals).catch(() => {}))
    .then(() => loadScript(checkout).catch(() => {}))
    .then(() => loadScript(inventoryGuard).catch(() => {}))
    .then(() => loadOptionalScript(stoleDrawerEnabled, stoleDrawer))
    .then(() => loadScript(icedTeaGate).catch(() => {}))
    .then(() => loadOptionalScript(assistantEnabled, agent));

})();

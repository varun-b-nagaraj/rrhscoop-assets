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
  const visuals = new URL('custom-visuals/rrhscoop-visuals.js', base).href;
  const checkout = new URL('check-out-page/rrhscoop-checkout.js', base).href;

  // Load visuals first, then checkout (order doesn't strictly matter but keeps things deterministic)
  loadScript(visuals).catch(() => {}).then(() => { loadScript(checkout).catch(() => {}); });

})();

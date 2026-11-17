/* index.js - loader that injects visuals and checkout scripts for embed */
(function () {
  const doc = document;
  const currentScript = doc.currentScript;

  // ---- Staging hand-off ----
  // The store always embeds the production index.js. In a staging tab (opened
  // from the staging domain, see rrhs-env.js) hand off to the index.js on the
  // staging deployment, so every script comes from `main` (staging) instead of
  // the `production` branch.
  // Keep in sync with the staging host redirects in vercel.json.
  const STAGING_ORIGIN = 'https://rrhscoop-staging.vercel.app';
  // Staging serves only the scripts; its API calls go to production, so the
  // staging Vercel project needs no env vars or secrets of its own.
  const PROD_ORIGIN = 'https://rrhscoop-assets.vercel.app';

  function wantsStaging() {
    try {
      const forced = new URLSearchParams(location.search).get('rrhs_env');
      if (forced) return forced === 'staging';
      return sessionStorage.getItem('rrhs_env') === 'staging';
    } catch (e) {
      return false;
    }
  }

  function scriptOrigin() {
    try { return new URL(currentScript.src).origin; } catch (e) { return ''; }
  }

  if (scriptOrigin() !== STAGING_ORIGIN && wantsStaging() && !window.__RRHS_STAGING_HANDOFF) {
    window.__RRHS_STAGING_HANDOFF = true;
    const s = doc.createElement('script');
    s.src = STAGING_ORIGIN + '/index.js';
    // If the staging deployment can't be reached, fall back to production.
    s.onerror = () => boot();
    (doc.head || doc.documentElement).appendChild(s);
    return;
  }
  boot();

  function boot() {
    if (scriptOrigin() === STAGING_ORIGIN) window.RRHS_API_ORIGIN = PROD_ORIGIN;
    const root = doc.documentElement;
    const head = doc.head || root;

    // ---- Anti-flicker cloak ----
    // Hide the page while the RRHS scripts restyle the storefront, then fade it in
    // once everything has settled. A hard cap guarantees the page always appears.
    const CLOAK_MAX_MS = 2500;
    const cloakStart = Date.now();
    let revealed = false;

    if (!doc.getElementById('rrhs-cloak-style')) {
      const cloakStyle = doc.createElement('style');
      cloakStyle.id = 'rrhs-cloak-style';
      cloakStyle.textContent =
        'html.rrhs-cloak body{opacity:0!important;}' +
        'html.rrhs-reveal body{opacity:1;transition:opacity .3s ease;}' +
        '@media (prefers-reduced-motion: reduce){html.rrhs-reveal body{transition:none;}}';
      head.appendChild(cloakStyle);
    }
    root.classList.add('rrhs-cloak');

    function reveal() {
      if (revealed) return;
      revealed = true;
      root.classList.add('rrhs-reveal');
      root.classList.remove('rrhs-cloak');
      setTimeout(() => root.classList.remove('rrhs-reveal'), 400);
    }
    const hardRevealTimer = setTimeout(reveal, CLOAK_MAX_MS);

    function afterFrames(fn) {
      // rAF doesn't fire in background tabs, so race it against a timer.
      let called = false;
      const once = () => { if (!called) { called = true; fn(); } };
      const raf = window.requestAnimationFrame || ((cb) => setTimeout(cb, 16));
      raf(() => raf(once));
      setTimeout(once, 100);
    }

    // Wait for Ecwid's first page render (if the storefront is present) so the
    // RRHS visuals have had a chance to restyle it before the fade-in.
    function waitForEcwidPage() {
      return new Promise((resolve) => {
        const remaining = Math.max(0, CLOAK_MAX_MS - (Date.now() - cloakStart));
        const giveUp = setTimeout(resolve, remaining);
        const done = () => { clearTimeout(giveUp); resolve(); };
        let tries = 0;
        (function poll() {
          const E = window.Ecwid;
          if (E && E.OnPageLoaded && typeof E.OnPageLoaded.add === 'function') {
            // Storefront already rendered before we subscribed.
            if (doc.querySelector('.ec-store .ec-store__content-wrapper, .ec-storefront-v3 .ec-wrapper')) return done();
            try { E.OnPageLoaded.add(done); } catch (e) { done(); }
            return;
          }
          // No Ecwid storefront on this page after ~600ms: don't wait for it.
          if (++tries > 12 && !doc.querySelector('[id^="ecwid"], .ec-storefront-v3, .ins-tiles')) return done();
          setTimeout(poll, 50);
        })();
      });
    }

    function finishLoading() {
      waitForEcwidPage().then(() => {
        // Let the shared DOM observer run the visuals boot, then reveal.
        afterFrames(() => setTimeout(() => { clearTimeout(hardRevealTimer); reveal(); }, 80));
      });
    }

    // ---- Script loading ----
    // Scripts are inserted together with async=false: they download in parallel
    // but still execute in insertion order.
    function loadScript(src) {
      return new Promise((resolve) => {
        try {
          const s = doc.createElement('script');
          s.src = src;
          s.async = false;
          s.onload = () => resolve(src);
          s.onerror = () => resolve(src);
          head.appendChild(s);
        } catch (err) { resolve(src); }
      });
    }

    function addStylesheet(id, href) {
      if (doc.getElementById(id)) return;
      const link = doc.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = href;
      head.appendChild(link);
    }

    function baseForCurrentScript() {
      if (!currentScript || !currentScript.src) return './';
      return new URL('.', currentScript.src).href;
    }

    const base = baseForCurrentScript();
    const url = (path) => new URL(path, base).href;

    // Stylesheets first so fonts and colors are in place before the reveal.
    // theme-tokens id/version must match ensureThemeTokens() in rrhscoop-visuals.js.
    addStylesheet('rrhs-site-css', url('custom-visuals/rrhs-site.css?v=1'));
    addStylesheet('rrhs-theme-tokens', url('custom-visuals/theme-tokens.css?v=18'));

    const stoleDrawerEnabled = false;
    const assistantEnabled = false;
    // Low-stock cart gating (removes items with < N remaining). Disabled; the
    // implementation in check-out-page/rrhs-inventory-guard.js is kept for later.
    const inventoryGuardEnabled = false;

    const scripts = [
      // First, so window.RRHS_ENVIRONMENT is set before the other scripts run.
      url('rrhs-env.js?v=2'),
      url('easter-hunt/boot.js?v=31'),
      url('custom-visuals/rrhs-embed-bridge.js?v=6'),
      url('rrhs-runtime.js'),
      url('custom-visuals/rrhs-faq-sticky-nav.js?v=5'),
      url('custom-visuals/rrhs-project-deeplinks.js?v=7'),
      url('custom-visuals/rrhscoop-visuals.js?v=57'),
      url('custom-visuals/rrhs-footer.js?v=5'),
      url('custom-visuals/rrhs-header-dropdowns.js?v=12'),
      url('custom-visuals/rrhs-by-the-numbers.js?v=2'),
      url('custom-visuals/rrhs-featured-product.js?v=3'),
      url('custom-visuals/rrhs-select.js?v=4'),
      url('custom-visuals/rrhs-category-images.js?v=2'),
      url('check-out-page/cfa-products.js?v=2'),
      url('check-out-page/rrhscoop-checkout.js?v=18'),
      url('check-out-page/rrhs-cfa-preorder-gate.js?v=2'),
      inventoryGuardEnabled && url('check-out-page/rrhs-inventory-guard.js'),
      stoleDrawerEnabled && url('check-out-page/rrhs-stole-drawer.js'),
      url('order-validate/rrhs-iced-tea-gate.js'),
      assistantEnabled && url('agent/rrhscoop-assistant.js')
    ].filter(Boolean);

    Promise.all(scripts.map(loadScript)).then(finishLoading);
  }
})();

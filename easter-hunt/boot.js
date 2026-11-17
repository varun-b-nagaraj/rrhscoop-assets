(function () {
  'use strict';
  if (window.__rrhsHuntBoot) return;
  window.__rrhsHuntBoot = true;
  const base = new URL('.', document.currentScript.src);
  const STAGING_ORIGIN = 'https://rrhscoop-staging.vercel.app';
  const PROD_ORIGIN = 'https://rrhscoop-assets.vercel.app';
  const topLevel = window.parent === window;
  const stagingPreview = topLevel && base.origin === STAGING_ORIGIN && window.RRHS_DEPLOYMENT?.frontendEnvironment === 'staging';
  const localPreview = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  window.__RRHS_HUNT_STAGING_PREVIEW = stagingPreview;
  const load = name => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL(name, base).href;
    script.onload = resolve; script.onerror = reject; document.head.append(script);
  });
  let config, loading;
  const allowedParents = new Set([base.origin, 'https://rrhscoop.roundrockisd.org']);
  const assetOrigins = new Set([base.origin, STAGING_ORIGIN, PROD_ORIGIN]);
  if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) allowedParents.add(location.origin);
  function trustedFrame(source, origin) {
    return assetOrigins.has(origin) && [...document.querySelectorAll('iframe')].some(frame => {
      try { const url = new URL(frame.src); return frame.contentWindow === source && url.origin === origin && url.pathname.startsWith('/iframes/'); }
      catch (_) { return false; }
    });
  }
  // Tell hosted iframes that this page will show their claim dialogs full-screen.
  function announce(frame) {
    const origin = new URL(frame.src).origin;
    frame.contentWindow.postMessage({ type: 'rrhs-hunt-parent', enabled: true, stagingPreview, found: window.RRHS_EASTER_HUNT?.foundIds?.() || [], done: window.RRHS_EASTER_HUNT?.doneId?.() || null }, origin);
  }
  function broadcast() {
    if (!topLevel || !window.RRHS_HUNT_ACTIVE) return;
    for (const frame of document.querySelectorAll('iframe')) {
      try { const url = new URL(frame.src); if (assetOrigins.has(url.origin) && url.pathname.startsWith('/iframes/')) announce(frame); } catch (_) {}
    }
  }
  function start(enabled) {
    if (window.RRHS_HUNT_ACTIVE) return;
    window.RRHS_HUNT_ACTIVE = enabled;
    if (!window.RRHS_HUNT_ACTIVE) return;
    const css = document.createElement('link'); css.rel = 'stylesheet';
    css.href = new URL('hunt.css?v=33', base).href;
    const styled = new Promise((resolve, reject) => { css.onload = resolve; css.onerror = reject; document.head.append(css); });
    loading = styled.then(() => load('hunt.js?v=23')).then(() => topLevel ? load('experience.js?v=30') : undefined)
      .then(() => document.dispatchEvent(new CustomEvent('rrhs-hunt-toggle', { detail: { enabled: true } }))).catch(() => {});
    broadcast();
  }
  addEventListener('message', event => {
    if (!event.data || typeof event.data !== 'object') return;
    if (!topLevel && event.source === parent && allowedParents.has(event.origin) && event.data.type === 'rrhs-hunt-parent') {
      window.RRHS_HUNT_PARENT = event.origin;
      // Once this person has claimed, the parent page tells its sticker iframes to hide the rest.
      if (typeof event.data.done === 'string') { window.RRHS_HUNT_DONE_ID = event.data.done; if (window.RRHS_HUNT_ACTIVE) window.RRHS_EASTER_HUNT?.refresh(true); }
      // The top-level API decides whether the hunt is enabled; iframe script origin does not.
      if (event.data.enabled === true && !window.RRHS_HUNT_ACTIVE) {
        window.__RRHS_HUNT_STAGING_PREVIEW = true; window.RRHS_HUNT_STAGING_FOUND = Array.isArray(event.data.found) ? event.data.found : [];
        wanted = true;
        if (window.RRHS_HUNT_ACTIVE) window.RRHS_EASTER_HUNT?.refresh(true);
        else Promise.resolve(window.RRHS_HUNT_CONFIG || load('config.js?v=5')).then(() => { config = window.RRHS_HUNT_CONFIG; start(true); });
      }
    } else if (topLevel && window.RRHS_HUNT_ACTIVE && trustedFrame(event.source, event.origin)) {
      if (event.data.type === 'rrhs-hunt-parent-query') {
        const frame = [...document.querySelectorAll('iframe')].find(candidate => candidate.contentWindow === event.source);
        if (frame) announce(frame);
      }
      if (event.data.type === 'rrhs-hunt-open' && config?.locations.some(egg => egg.id === event.data.id)) Promise.resolve(loading).then(() => window.RRHS_EASTER_HUNT?.open(event.data.id));
    }
  });
  if (!topLevel) parent.postMessage({ type: 'rrhs-hunt-parent-query' }, '*');
  // Each deployment asks its own API. Production and staging can therefore use different flags.
  const authorized = stagingPreview && !window.RRHS_DEPLOYMENT?.sessionToken()
    ? new Promise(resolve => document.addEventListener('rrhs:staging-authorized', resolve, { once: true }))
    : Promise.resolve();
  const status = localPreview ? Promise.resolve(true) : authorized.then(() => (window.RRHS_DEPLOYMENT?.fetch('/api/v1/easter-hunt', { cache: 'no-store' }) || fetch(base.origin + '/api/v1/easter-hunt', { cache: 'no-store' })))
    .then(response => response.ok ? response.json() : Promise.reject(new Error('Hunt status unavailable')))
    .then(result => result.status !== 'disabled' && result.status !== 'unavailable');
  // No hunt on the Digital Pass pages (/pass, /pass/teacher and anything under /pass/). The store
  // can change pages without a reload, so the path is rechecked and the hunt hides or comes back.
  const passPage = () => topLevel && /^\/pass(\/|$)/i.test(location.pathname);
  let wanted = false;
  function sync() {
    const on = wanted && !passPage();
    if (on === Boolean(window.RRHS_HUNT_ACTIVE)) return;
    if (on && !loading) { start(true); return; }
    window.RRHS_HUNT_ACTIVE = on;
    if (on) broadcast();
    Promise.resolve(loading).then(() => document.dispatchEvent(new CustomEvent('rrhs-hunt-toggle', { detail: { enabled: window.RRHS_HUNT_ACTIVE === true } })));
  }
  if (topLevel) { addEventListener('popstate', sync); setInterval(sync, 500); }
  Promise.all([load('config.js?v=5'), status]).then(([, enabled]) => { config = window.RRHS_HUNT_CONFIG; wanted = enabled; sync(); })
    .catch(() => { /* Discovery never blocks shopping. */ });
})();

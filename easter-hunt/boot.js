(function () {
  'use strict';
  if (window.__rrhsHuntBoot) return;
  window.__rrhsHuntBoot = true;
  // RRHS_HUNT_ENABLED in Vercel is the only switch: on for every visitor, or off for everyone.
  // The API reports it, since a browser cannot read server environment variables.
  const base = new URL('.', document.currentScript.src);
  // Dev switch, for this browser only: every sticker shows and claims make fake codes, with no
  // request to the Apps Script, no coupon and no email. Turn it on with ?hunt-dev=on in the address
  // or rrhsHunt.dev() in the DevTools console; off with ?hunt-dev=off or rrhsHunt.dev(false).
  const DEV_KEY = 'rrhs-hunt-dev', DEV_STATE = 'rrhs-hunt-dev-state';
  const store = (key, value) => { try { if (value === undefined) return localStorage.getItem(key); if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch (_) { return null; } };
  const devParam = new URLSearchParams(location.search).get('hunt-dev');
  if (window.parent === window && devParam) store(DEV_KEY, devParam === 'on' ? 'on' : null);
  window.rrhsHunt = {
    dev(on = true) { store(DEV_KEY, on ? 'on' : null); location.reload(); return on ? 'Hunt dev mode on: fake codes only.' : 'Hunt dev mode off.'; },
    reset() { store(DEV_STATE, null); location.reload(); return 'Fake claims cleared.'; },
    get devMode() { return window.RRHS_HUNT_DEV === true; },
  };
  if (window.parent === window && store(DEV_KEY) === 'on') window.RRHS_HUNT_DEV = true;
  const load = name => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL(name, base).href;
    script.onload = resolve; script.onerror = reject; document.head.append(script);
  });
  let config, loading;
  const topLevel = window.parent === window;
  const allowedParents = new Set([base.origin, 'https://rrhscoop.roundrockisd.org']);
  if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) allowedParents.add(location.origin);
  function trustedFrame(source, origin) {
    return origin === base.origin && [...document.querySelectorAll('iframe')].some(frame => {
      try { const url = new URL(frame.src); return frame.contentWindow === source && url.origin === base.origin && url.pathname.startsWith('/iframes/'); }
      catch (_) { return false; }
    });
  }
  // Tell hosted iframes that this page will show their claim dialogs full-screen.
  function announce(target) {
    target.postMessage({ type: 'rrhs-hunt-parent', dev: window.RRHS_HUNT_DEV === true, found: window.RRHS_EASTER_HUNT?.foundIds?.() || [], done: window.RRHS_EASTER_HUNT?.doneId?.() || null }, base.origin);
  }
  function broadcast() {
    if (!topLevel || !window.RRHS_HUNT_ACTIVE) return;
    for (const frame of document.querySelectorAll('iframe')) {
      try { const url = new URL(frame.src); if (url.origin === base.origin && url.pathname.startsWith('/iframes/')) announce(frame.contentWindow); } catch (_) {}
    }
  }
  function start(enabled) {
    if (window.RRHS_HUNT_ACTIVE) return;
    window.RRHS_HUNT_ACTIVE = enabled;
    if (!window.RRHS_HUNT_ACTIVE) return;
    const css = document.createElement('link'); css.rel = 'stylesheet';
    css.href = new URL('hunt.css?v=30', base).href;
    const styled = new Promise((resolve, reject) => { css.onload = resolve; css.onerror = reject; document.head.append(css); });
    loading = styled.then(() => load('hunt.js?v=19')).then(() => topLevel ? load('experience.js?v=30') : undefined)
      .then(() => document.dispatchEvent(new CustomEvent('rrhs-hunt-toggle', { detail: { enabled: true } }))).catch(() => {});
    broadcast();
  }
  addEventListener('message', event => {
    if (!event.data || typeof event.data !== 'object') return;
    if (!topLevel && event.source === parent && allowedParents.has(event.origin) && event.data.type === 'rrhs-hunt-parent') {
      window.RRHS_HUNT_PARENT = event.origin;
      // Once this person has claimed, the parent page tells its sticker iframes to hide the rest.
      if (typeof event.data.done === 'string') { window.RRHS_HUNT_DONE_ID = event.data.done; if (window.RRHS_HUNT_ACTIVE) window.RRHS_EASTER_HUNT?.refresh(true); }
      // A parent page in dev mode runs its sticker iframes in dev mode too.
      if (event.data.dev === true && !window.RRHS_HUNT_DEV) {
        window.RRHS_HUNT_DEV = true; window.RRHS_HUNT_DEV_FOUND = Array.isArray(event.data.found) ? event.data.found : [];
        if (window.RRHS_HUNT_ACTIVE) window.RRHS_EASTER_HUNT?.refresh(true);
        else Promise.resolve(window.RRHS_HUNT_CONFIG || load('config.js?v=5')).then(() => { config = window.RRHS_HUNT_CONFIG; start(true); });
      }
    } else if (topLevel && window.RRHS_HUNT_ACTIVE && trustedFrame(event.source, event.origin)) {
      if (event.data.type === 'rrhs-hunt-parent-query') announce(event.source);
      if (event.data.type === 'rrhs-hunt-open' && config?.locations.some(egg => egg.id === event.data.id)) Promise.resolve(loading).then(() => window.RRHS_EASTER_HUNT?.open(event.data.id));
    }
  });
  if (!topLevel) parent.postMessage({ type: 'rrhs-hunt-parent-query' }, '*');
  const status = window.RRHS_HUNT_DEV ? Promise.resolve(true)
    : fetch(new URL('/api/v1/easter-hunt', base).href).then(response => response.json()).then(result => result.mode !== 'disabled');
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

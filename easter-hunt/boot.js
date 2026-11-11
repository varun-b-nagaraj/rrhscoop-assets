(function () {
  'use strict';
  if (window.__rrhsHuntBoot) return;
  window.__rrhsHuntBoot = true;
  // RRHS_HUNT_ENABLED in Vercel is the only switch: on for every visitor, or off for everyone.
  // The API reports it, since a browser cannot read server environment variables.
  const base = new URL('.', document.currentScript.src);
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
  function announce(target) { target.postMessage({ type: 'rrhs-hunt-parent' }, base.origin); }
  function broadcast() {
    if (!topLevel || !window.RRHS_HUNT_ACTIVE) return;
    for (const frame of document.querySelectorAll('iframe')) {
      try { const url = new URL(frame.src); if (url.origin === base.origin && url.pathname.startsWith('/iframes/')) announce(frame.contentWindow); } catch (_) {}
    }
  }
  function start(enabled) {
    window.RRHS_HUNT_ACTIVE = enabled;
    if (!window.RRHS_HUNT_ACTIVE) return;
    const css = document.createElement('link'); css.rel = 'stylesheet';
    css.href = new URL('hunt.css?v=13', base).href;
    const styled = new Promise((resolve, reject) => { css.onload = resolve; css.onerror = reject; document.head.append(css); });
    loading = styled.then(() => load('hunt.js?v=9')).then(() => topLevel ? load('experience.js?v=13') : undefined)
      .then(() => document.dispatchEvent(new CustomEvent('rrhs-hunt-toggle', { detail: { enabled: true } }))).catch(() => {});
    broadcast();
  }
  addEventListener('message', event => {
    if (!event.data || typeof event.data !== 'object') return;
    if (!topLevel && event.source === parent && allowedParents.has(event.origin) && event.data.type === 'rrhs-hunt-parent') {
      window.RRHS_HUNT_PARENT = event.origin;
    } else if (topLevel && window.RRHS_HUNT_ACTIVE && trustedFrame(event.source, event.origin)) {
      if (event.data.type === 'rrhs-hunt-parent-query') announce(event.source);
      if (event.data.type === 'rrhs-hunt-open' && config?.locations.some(egg => egg.id === event.data.id)) Promise.resolve(loading).then(() => window.RRHS_EASTER_HUNT?.open(event.data.id));
    }
  });
  if (!topLevel) parent.postMessage({ type: 'rrhs-hunt-parent-query' }, '*');
  const status = fetch(new URL('/api/v1/easter-hunt', base).href).then(response => response.json()).then(result => result.mode !== 'disabled');
  Promise.all([load('config.js?v=4'), status]).then(([, enabled]) => { config = window.RRHS_HUNT_CONFIG; start(enabled); })
    .catch(() => { /* Discovery never blocks shopping. */ });
})();

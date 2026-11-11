(function () {
  'use strict';
  if (window.__rrhsHuntBoot) return;
  window.__rrhsHuntBoot = true;
  const base = new URL('.', document.currentScript.src);
  const load = name => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL(name, base).href;
    script.onload = resolve; script.onerror = reject; document.head.append(script);
  });
  let override = window.RRHSOVERIDE === true, config, loading;
  try { override ||= sessionStorage.getItem('rrhs-hunt-override') === 'true'; } catch (_) {}
  const topLevel = window.parent === window;
  const allowedParents = new Set([base.origin, 'https://rrhscoop.roundrockisd.org']);
  if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) allowedParents.add(location.origin);
  function trustedFrame(source, origin) {
    return origin === base.origin && [...document.querySelectorAll('iframe')].some(frame => {
      try { const url = new URL(frame.src); return frame.contentWindow === source && url.origin === base.origin && url.pathname.startsWith('/iframes/'); }
      catch (_) { return false; }
    });
  }
  function broadcast() {
    if (!topLevel) return;
    for (const frame of document.querySelectorAll('iframe')) {
      try { const url = new URL(frame.src); if (url.origin === base.origin && url.pathname.startsWith('/iframes/')) frame.contentWindow.postMessage({ type: 'rrhs-hunt-override', enabled: override }, base.origin); } catch (_) {}
    }
  }
  function reconcile() {
    if (!config) return;
    const enabled = config.HUNT_ENABLED || override;
    const changed = window.RRHS_HUNT_ACTIVE !== enabled;
    window.RRHS_HUNT_ACTIVE = enabled;
    if (enabled && !loading) {
      const css = document.createElement('link'); css.rel = 'stylesheet';
      css.href = new URL('hunt.css?v=3', base).href;
      const styled = new Promise((resolve, reject) => { css.onload = resolve; css.onerror = reject; document.head.append(css); });
      loading = styled.then(() => load('hunt.js?v=3')).then(() => topLevel ? load('experience.js?v=1') : undefined).catch(() => { loading = null; });
    }
    if (changed) document.dispatchEvent(new CustomEvent('rrhs-hunt-toggle', { detail: { enabled } }));
    broadcast();
  }
  Object.defineProperty(window, 'RRHSOVERIDE', {
    configurable: true,
    get: () => override,
    set(value) {
      override = value === true;
      try { sessionStorage.setItem('rrhs-hunt-override', String(override)); } catch (_) {}
      reconcile();
    },
  });
  addEventListener('message', event => {
    if (!event.data || typeof event.data !== 'object') return;
    if (!topLevel && event.source === parent && allowedParents.has(event.origin) && event.data.type === 'rrhs-hunt-override') {
      window.RRHS_HUNT_PARENT = event.origin;
      window.RRHSOVERIDE = event.data.enabled === true;
    } else if (topLevel && trustedFrame(event.source, event.origin)) {
      if (event.data.type === 'rrhs-hunt-override-query') event.source.postMessage({ type: 'rrhs-hunt-override', enabled: override }, event.origin);
      if (event.data.type === 'rrhs-hunt-open' && window.RRHS_HUNT_ACTIVE && config?.locations.some(egg => egg.id === event.data.id)) window.RRHS_EASTER_HUNT?.open(event.data.id);
    }
  });
  if (!topLevel) parent.postMessage({ type: 'rrhs-hunt-override-query' }, '*');
  load('config.js?v=2').then(() => { config = window.RRHS_HUNT_CONFIG; reconcile(); }).catch(() => { /* Discovery never blocks shopping. */ });
})();

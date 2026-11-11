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
  load('config.js').then(() => {
    const config = window.RRHS_HUNT_CONFIG;
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    if (!config.HUNT_ENABLED && !(config.DEV_PREVIEW_ENABLED && local)) return;
    const css = document.createElement('link'); css.rel = 'stylesheet';
    css.href = new URL('hunt.css', base).href; document.head.append(css);
    return load('hunt.js');
  }).catch(() => { /* An optional discovery never blocks shopping. */ });
})();

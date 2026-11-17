/* rrhs-env.js - tells "staging" from "prod" on the one storefront domain.
 *
 * Ecwid only allows one storefront URL, so rrhscoop.company.site answers with a
 * 302 to rrhscoop.roundrockisd.org (keeping the path and query string). A page
 * that arrived through that cross-origin redirect is treated as staging:
 *
 *   - Browsers hide cross-origin redirects (redirectCount stays 0, no referrer),
 *     but the navigation entry's fetchStart is measured after the redirect, so it
 *     sits hundreds of ms after time zero instead of ~0 on a direct visit.
 *   - ?rrhs_env=staging forces staging and ?rrhs_env=prod forces prod. Ecwid keeps
 *     the query string through the redirect, so both domains accept it.
 *
 * The result is kept in sessionStorage, so later page loads in the same tab stay
 * staging, and a new tab opened on rrhscoop.roundrockisd.org starts as prod.
 * Exposed as window.RRHS_ENVIRONMENT and <html data-rrhs-env="...">.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') api.install(window);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const PROD_HOST = 'rrhscoop.roundrockisd.org';
  const STORAGE_KEY = 'rrhs_env';
  const SHOWN_KEY = 'rrhs_env_notice_shown';
  const PARAM = 'rrhs_env';
  // A direct visit starts fetching within a few ms; the company.site hop costs
  // a DNS lookup, TLS handshake and a round trip to Ecwid before that.
  const REDIRECT_MIN_MS = 25;

  function cameThroughRedirect(nav) {
    if (!nav || nav.type !== 'navigate') return false;
    // Same-origin redirects are visible and are not the company.site hop.
    if (nav.redirectCount > 0) return false;
    return Number(nav.fetchStart) >= REDIRECT_MIN_MS;
  }

  function detect({ hostname, search, nav, stored }) {
    const forced = new URLSearchParams(search || '').get(PARAM);
    if (forced === 'staging' || forced === 'prod') return { env: forced, reason: 'param' };
    if (stored === 'staging') return { env: 'staging', reason: 'session' };
    if (hostname === PROD_HOST && cameThroughRedirect(nav)) return { env: 'staging', reason: 'redirect' };
    return { env: 'prod', reason: 'direct' };
  }

  function storage(win) {
    try { return win.sessionStorage; } catch (e) { return null; }
  }

  function showNotice(win, reason) {
    const doc = win.document;
    if (doc.getElementById('rrhs-env-notice')) return;
    const how = reason === 'redirect'
      ? 'You came in through rrhscoop.company.site, so this tab is on staging.'
      : 'This tab is on staging.';

    const style = doc.createElement('style');
    style.textContent =
      '#rrhs-env-notice{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(20,20,20,.45);}' +
      '#rrhs-env-notice .rrhs-env-card{max-width:360px;width:100%;background:var(--rrhs-paper,#faf8f4);color:var(--rrhs-ink,#141414);border-radius:var(--rrhs-radius-card,16px);padding:24px;box-shadow:0 20px 50px rgba(0,0,0,.25);font-family:var(--rrhs-font-body,Georgia,serif);text-align:center;}' +
      '#rrhs-env-notice .rrhs-env-tag{display:inline-block;margin-bottom:12px;padding:4px 10px;border-radius:999px;background:var(--rrhs-maroon,#6e1f2a);color:#fff;font:600 12px/1.4 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;}' +
      '#rrhs-env-notice h2{margin:0 0 8px;font-family:var(--rrhs-font-title,Georgia,serif);font-size:24px;}' +
      '#rrhs-env-notice p{margin:0 0 20px;font-size:16px;line-height:1.45;}' +
      '#rrhs-env-notice button{border:0;border-radius:999px;padding:10px 22px;background:var(--rrhs-maroon,#6e1f2a);color:#fff;font:600 15px system-ui,sans-serif;cursor:pointer;}';

    const overlay = doc.createElement('div');
    overlay.id = 'rrhs-env-notice';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'rrhs-env-notice-title');
    overlay.innerHTML =
      '<div class="rrhs-env-card">' +
      '<span class="rrhs-env-tag">Staging</span>' +
      '<h2 id="rrhs-env-notice-title">It worked</h2>' +
      '<p>' + how + ' Open rrhscoop.roundrockisd.org in a new tab for prod.</p>' +
      '<button type="button">Got it</button>' +
      '</div>';
    overlay.appendChild(style);

    const close = () => {
      overlay.remove();
      doc.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('button').addEventListener('click', close);
    doc.addEventListener('keydown', onKey);
    doc.body.appendChild(overlay);
    overlay.querySelector('button').focus();
  }

  function install(win) {
    if (win.RRHS_ENVIRONMENT) return;
    const store = storage(win);
    let stored = null;
    try { stored = store && store.getItem(STORAGE_KEY); } catch (e) {}
    let nav = null;
    try { nav = win.performance.getEntriesByType('navigation')[0] || null; } catch (e) {}

    const { env, reason } = detect({
      hostname: win.location.hostname,
      search: win.location.search,
      nav,
      stored
    });

    win.RRHS_ENVIRONMENT = env;
    win.document.documentElement.setAttribute('data-rrhs-env', env);
    try {
      if (env === 'staging') store.setItem(STORAGE_KEY, 'staging');
      else store.removeItem(STORAGE_KEY);
    } catch (e) {}

    if (env !== 'staging') {
      try { store.removeItem(SHOWN_KEY); } catch (e) {}
      return;
    }
    // Show the notice once per tab, not on every page load.
    try {
      if (store.getItem(SHOWN_KEY)) return;
      store.setItem(SHOWN_KEY, '1');
    } catch (e) {}
    const show = () => showNotice(win, reason);
    if (win.document.body) show();
    else win.document.addEventListener('DOMContentLoaded', show, { once: true });
  }

  return { detect, cameThroughRedirect, install, PROD_HOST, REDIRECT_MIN_MS };
});

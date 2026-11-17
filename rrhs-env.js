/* rrhs-env.js - tells a staging tab from prod on the one storefront domain.
 *
 * Ecwid only allows one storefront URL, so staging is opened through a domain
 * we control: rrhscoop-staging.vercel.app (the Vercel project that deploys `main`)
 * redirects to rrhscoop.roundrockisd.org/?rrhs_env=staging (see vercel.json).
 *
 *   - ?rrhs_env=staging starts staging, ?rrhs_env=prod ends it.
 *   - The choice is kept in sessionStorage, so the rest of that tab stays on
 *     staging and a new tab opened on rrhscoop.roundrockisd.org starts as prod.
 *   - index.js reads the same flag and loads its scripts from the staging
 *     deployment instead of production.
 *
 * Exposed as window.RRHS_ENVIRONMENT and <html data-rrhs-env="...">.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') api.install(window);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const STORAGE_KEY = 'rrhs_env';
  const SHOWN_KEY = 'rrhs_env_notice_shown';
  const PARAM = 'rrhs_env';

  function detect({ search, stored }) {
    const forced = new URLSearchParams(search || '').get(PARAM);
    if (forced === 'staging' || forced === 'prod') return forced;
    return stored === 'staging' ? 'staging' : 'prod';
  }

  function storage(win) {
    try { return win.sessionStorage; } catch (e) { return null; }
  }

  function showNotice(win, scriptHost) {
    const doc = win.document;
    if (doc.getElementById('rrhs-env-notice')) return;
    // index.js falls back to production scripts if staging can't be reached.
    const how = /staging/.test(scriptHost)
      ? 'This tab is on staging, running the scripts from ' + scriptHost + '.'
      : 'This tab is on staging, but the staging scripts did not load, so it is running the production ones from ' + scriptHost + '.';

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
    let scriptHost = '';
    try { scriptHost = new URL(win.document.currentScript.src).host; } catch (e) {}
    const store = storage(win);
    let stored = null;
    try { stored = store && store.getItem(STORAGE_KEY); } catch (e) {}

    const env = detect({ search: win.location.search, stored });
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
    const show = () => showNotice(win, scriptHost);
    if (win.document.body) show();
    else win.document.addEventListener('DOMContentLoaded', show, { once: true });
  }

  return { detect, install };
});

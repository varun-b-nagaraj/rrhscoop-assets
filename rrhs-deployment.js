/* Central deployment identity and safe diagnostics for RRHS storefront scripts. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') api.install(window);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PRODUCTION_ORIGIN = 'https://rrhscoop-assets.vercel.app';
  const STAGING_ORIGINS = Object.freeze([
    'https://rrhscoop-staging.vercel.app',
    'https://rrhscoop-staging.roundrockisd.org',
  ]);
  const SESSION_KEY = 'rrhs_staging_session_v1';

  function normalizeOrigin(value) {
    try { return new URL(value).origin; } catch (_) { return ''; }
  }

  function describe({ scriptSrc, requestedEnvironment }) {
    const assetOrigin = normalizeOrigin(scriptSrc);
    const frontendEnvironment = STAGING_ORIGINS.includes(assetOrigin)
      ? 'staging'
      : assetOrigin === PRODUCTION_ORIGIN ? 'production' : 'development';
    const requested = requestedEnvironment === 'staging' ? 'staging' : 'production';
    return {
      requestedEnvironment: requested,
      frontendEnvironment,
      assetOrigin,
      apiOrigin: assetOrigin,
      stagingAssetsLoaded: frontendEnvironment === 'staging',
      fellBackToProduction: requested === 'staging' && frontendEnvironment === 'production',
    };
  }

  function install(win) {
    if (win.RRHS_DEPLOYMENT) return win.RRHS_DEPLOYMENT;
    const doc = win.document;
    const state = describe({
      scriptSrc: doc.currentScript && doc.currentScript.src,
      requestedEnvironment: win.RRHS_ENVIRONMENT,
    });
    state.commitSha = null;
    state.branch = null;
    state.apiConfiguration = null;
    state.iframeRewrites = 0;
    state.failures = [];

    const deployment = {
      productionOrigin: PRODUCTION_ORIGIN,
      stagingOrigins: STAGING_ORIGINS,
      get requestedEnvironment() { return state.requestedEnvironment; },
      get frontendEnvironment() { return state.frontendEnvironment; },
      get assetOrigin() { return state.assetOrigin; },
      get apiOrigin() { return state.apiOrigin; },
      get stagingAssetsLoaded() { return state.stagingAssetsLoaded; },
      get fellBackToProduction() { return state.fellBackToProduction; },
      assetUrl(path) { return new URL(path, state.assetOrigin + '/').href; },
      apiUrl(path) { return new URL(path, state.apiOrigin + '/').href; },
      sessionToken() {
        if (state.frontendEnvironment !== 'staging') return '';
        try { return win.sessionStorage.getItem(SESSION_KEY) || ''; } catch (_) { return ''; }
      },
      setSessionToken(token) {
        if (state.frontendEnvironment !== 'staging') return;
        try { token ? win.sessionStorage.setItem(SESSION_KEY, token) : win.sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
      },
      fetch(path, options) {
        const next = Object.assign({}, options || {});
        const headers = new win.Headers(next.headers || {});
        const token = deployment.sessionToken();
        if (token) headers.set('Authorization', `Bearer ${token}`);
        next.headers = headers;
        return win.fetch(deployment.apiUrl(path), next);
      },
      recordIframeRewrite() { state.iframeRewrites += 1; },
      recordFailure(component, message) {
        state.failures.push({ component: String(component), message: String(message) });
      },
      snapshot() {
        return JSON.parse(JSON.stringify(state));
      },
    };

    win.RRHS_DEPLOYMENT = deployment;
    // Backward compatibility for existing API callers. This now follows the loaded deployment.
    win.RRHS_API_ORIGIN = state.apiOrigin;
    if (state.fellBackToProduction && win.console) {
      win.console.error('[RRHS] Staging was requested, but production assets loaded. API calls remain on production.');
    }

    if (state.apiOrigin && typeof win.fetch === 'function') {
      win.fetch(deployment.apiUrl('/api/v1/environment'), { credentials: 'omit', cache: 'no-store' })
        .then(response => response.ok ? response.json() : Promise.reject(new Error('environment endpoint unavailable')))
        .then(info => {
          state.commitSha = typeof info.commitSha === 'string' ? info.commitSha : null;
          state.branch = typeof info.branch === 'string' ? info.branch : null;
          state.apiConfiguration = info.configuration && typeof info.configuration === 'object' ? info.configuration : null;
          if (info.environment && info.environment !== state.frontendEnvironment && state.frontendEnvironment !== 'development') {
            deployment.recordFailure('environment', `Frontend is ${state.frontendEnvironment}; API reports ${info.environment}`);
          }
        })
        .catch(error => deployment.recordFailure('environment', error.message));
    }
    win.dispatchEvent(new CustomEvent('rrhs:deployment-ready', { detail: deployment.snapshot() }));
    return deployment;
  }

  return { PRODUCTION_ORIGIN, STAGING_ORIGINS, describe, install };
});

/* Route only RRHS-owned iframe assets to the deployment active in this tab. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') api.install(window);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const RRHS_ORIGINS = new Set([
    'https://rrhscoop-assets.vercel.app',
    'https://rrhscoop-staging.vercel.app',
    'https://rrhscoop-staging.roundrockisd.org',
  ]);
  const ALLOWED_PATH = /^\/iframes\/(?:cfa|faq|home-intro|leadership|projects|teachers|why-coop)(?:\/|\.html|$)/;

  function routedUrl(value, targetOrigin, baseUrl) {
    let url;
    try { url = new URL(value, baseUrl); } catch (_) { return null; }
    if (!RRHS_ORIGINS.has(url.origin) || !ALLOWED_PATH.test(url.pathname)) return null;
    const target = new URL(targetOrigin);
    if (!RRHS_ORIGINS.has(target.origin)) return null;
    url.protocol = target.protocol;
    url.host = target.host;
    return url.href;
  }

  function install(win) {
    if (win.__RRHS_IFRAME_ROUTER__) return win.__RRHS_IFRAME_ROUTER__;
    const doc = win.document;
    const deployment = win.RRHS_DEPLOYMENT;
    if (!deployment || !deployment.assetOrigin) return null;
    const connected = new WeakMap();
    let scheduled = false;

    function route(frame) {
      if (!frame || frame.tagName !== 'IFRAME' || frame.hasAttribute('srcdoc')) return false;
      const source = frame.getAttribute('src');
      if (!source) return false;
      const next = routedUrl(source, deployment.assetOrigin, win.location.href);
      if (!next || new URL(source, win.location.href).href === next) return false;
      if (connected.get(frame) === next) return false;
      connected.set(frame, next);
      frame.dataset.rrhsEnvironmentRouting = 'pending';
      // Paste-in bridge scripts may already have initialized against production. Clearing these
      // markers lets the centralized bridge attach a listener for the routed origin.
      delete frame.dataset.bridgeReady;
      delete frame.dataset.cfaDrawerBridge;
      const loaded = () => {
        frame.dataset.rrhsEnvironmentRouting = 'loaded';
        frame.removeEventListener('load', loaded);
      };
      const failed = () => {
        frame.dataset.rrhsEnvironmentRouting = 'failed';
        deployment.recordFailure('iframe', `Could not load ${next}`);
        frame.setAttribute('title', `${frame.getAttribute('title') || 'RRHS content'} (failed to load)`);
        frame.removeEventListener('error', failed);
      };
      frame.addEventListener('load', loaded);
      frame.addEventListener('error', failed);
      frame.setAttribute('src', next);
      deployment.recordIframeRewrite();
      return true;
    }

    function scan(rootNode) {
      if (rootNode && rootNode.tagName === 'IFRAME') route(rootNode);
      if (rootNode && typeof rootNode.querySelectorAll === 'function') {
        rootNode.querySelectorAll('iframe[src]').forEach(route);
      }
    }

    function schedule(rootNode) {
      if (scheduled) return;
      scheduled = true;
      (win.requestAnimationFrame || win.setTimeout)(() => {
        scheduled = false;
        scan(rootNode || doc);
      });
    }

    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'attributes') route(record.target);
        else record.addedNodes.forEach(scan);
      }
    });
    observer.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    win.addEventListener('pageshow', () => schedule(doc));
    win.addEventListener('rrhs:environment-changed', () => schedule(doc));
    scan(doc);

    const router = { route, scan, disconnect() { observer.disconnect(); } };
    win.__RRHS_IFRAME_ROUTER__ = router;
    return router;
  }

  return { RRHS_ORIGINS, ALLOWED_PATH, routedUrl, install };
});

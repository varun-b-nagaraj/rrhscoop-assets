(function () {
  'use strict';
  if (window.RRHS_HUNT_DEMO) return;
  const assetOrigin = new URL(document.currentScript.src).origin;
  const store = window.RRHS_HUNT_DEMO_STORE.createDemoStore({ storage: localStorage, crypto, config: window.RRHS_HUNT_CONFIG });
  const allowed = new Set([assetOrigin, 'https://rrhscoop.roundrockisd.org']);
  if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) allowed.add(location.origin);
  let dashboardWindow;
  const subscribers = new Set();
  function notify() {
    document.dispatchEvent(new CustomEvent('rrhs-hunt-demo-changed'));
    for (const port of subscribers) { try { port.postMessage({ event: 'changed' }); } catch (_) { subscribers.delete(port); } }
    for (const iframe of document.querySelectorAll('iframe')) {
      try { const url = new URL(iframe.src); if (url.origin === assetOrigin && url.pathname.startsWith('/iframes/')) iframe.contentWindow.postMessage({ type: 'rrhs-hunt-demo-refresh' }, assetOrigin); } catch (_) {}
    }
  }
  async function request(action, input) {
    if (action === 'replay') { if (!window.RRHS_HUNT_INTRO) throw new Error('Wait for the storefront to finish loading, then replay the introduction.'); window.RRHS_HUNT_INTRO.replay(); return null; }
    if (action === 'availability' && window.parent !== window && window.RRHS_HUNT_PARENT) {
      return new Promise((resolve, reject) => {
        const channel = new MessageChannel();
        const timer = setTimeout(() => { channel.port1.close(); reject(new Error('Open the presentation dashboard and refresh the storefront.')); }, 5000);
        channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); event.data.error ? reject(new Error(event.data.error)) : resolve(event.data.result); };
        parent.postMessage({ type: 'rrhs-hunt-demo-availability' }, window.RRHS_HUNT_PARENT, [channel.port2]);
      });
    }
    if (!['availability', 'snapshot', 'claim', 'reset', 'restoreIfEmpty'].includes(action)) throw new Error('Unknown demo action.');
    const run = () => { const result = store[action](input); if (['claim', 'reset', 'restoreIfEmpty'].includes(action)) notify(); return result; };
    if (['claim', 'reset', 'restoreIfEmpty'].includes(action)) {
      if (!navigator.locks) throw new Error('Use a current Chrome, Edge, Firefox, or Safari browser for the presentation demo.');
      return navigator.locks.request('rrhs-hunt-personal-demo', run);
    }
    return run();
  }
  function openDashboard() {
    dashboardWindow = window.open(assetOrigin + '/easter-hunt/dashboard?sourceOrigin=' + encodeURIComponent(location.origin), 'rrhs-hunt-presenter-' + crypto.randomUUID());
    return dashboardWindow;
  }
  addEventListener('message', event => {
    if (event.data?.type !== 'rrhs-hunt-demo-connect' || !event.ports[0] || !allowed.has(event.origin) ||
        (event.source !== window.opener && event.source !== dashboardWindow)) return;
    const port = event.ports[0]; subscribers.add(port);
    port.onmessage = async message => {
      const { id, action, input } = message.data || {};
      try { port.postMessage({ id, result: await request(action, input) }); }
      catch (error) { port.postMessage({ id, error: error.message }); }
    };
    port.postMessage({ event: 'ready' });
  });
  addEventListener('storage', event => { if (event.key === window.RRHS_HUNT_DEMO_STORE.KEY || event.key === null) notify(); });
  window.RRHS_HUNT_DEMO = { request, openDashboard };
})();

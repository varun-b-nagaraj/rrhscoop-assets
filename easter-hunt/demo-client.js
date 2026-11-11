(function () {
  'use strict';
  if (window.RRHS_HUNT_DEMO) return;
  const assetOrigin = new URL(document.currentScript.src).origin;
  let store;
  const ownStore = () => store || (store = window.RRHS_HUNT_DEMO_STORE.createDemoStore({ storage: localStorage, crypto, config: window.RRHS_HUNT_CONFIG }));
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
    if (action === 'send-preview') { await deliver(input.claimId); return ownStore().snapshot(); }
    if (!['availability', 'snapshot', 'claim', 'reset', 'restoreIfEmpty', 'emailStatus'].includes(action)) throw new Error('Unknown demo action.');
    const run = () => { const result = ownStore()[action](input); if (['claim', 'reset', 'restoreIfEmpty', 'emailStatus'].includes(action)) notify(); return result; };
    if (['claim', 'reset', 'restoreIfEmpty', 'emailStatus'].includes(action)) {
      if (!navigator.locks) throw new Error('Use a current Chrome, Edge, Firefox, or Safari browser for the presentation demo.');
      const result = await navigator.locks.request('rrhs-hunt-personal-demo', run);
      return action === 'claim' ? deliver(result.claimId) : result;
    }
    return run();
  }
  async function deliver(claimId) {
    const record = ownStore().snapshot().records.find(r => r.id === claimId);
    if (!record) throw new Error('Preview claim not found.');
    if (record.emailStatus === 'sent') return ownStore().claim(record);
    await request('emailStatus', { claimId, status: 'pending' });
    try {
      const response = await fetch(assetOrigin + '/api/v1/easter-hunt', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send-preview', studentId: record.studentId, percentage: record.percentage, reference: record.reference }), signal: AbortSignal.timeout(25000) });
      const result = await response.json(); if (!response.ok || !result.ok) throw new Error(result.error || 'Preview email could not be confirmed.');
      return request('emailStatus', { claimId, status: 'sent' });
    } catch (error) { return request('emailStatus', { claimId, status: 'failed', error: error.message || 'Check your inbox before retrying.' }); }
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

(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const factory = window.RRHS_HUNT_DEMO_STORE;
  const own = factory.createDemoStore({ storage: localStorage, crypto, config: window.RRHS_HUNT_CONFIG });
  const allowed = new Set([location.origin, 'https://rrhscoop.roundrockisd.org']);
  let state, connected, sourceWindow, sourceOrigin, poll, sequence = 0, connectingPort;
  const waiting = new Map();
  const escape = value => { const span = document.createElement('span'); span.textContent = String(value); return span.innerHTML; };
  const lock = action => navigator.locks ? navigator.locks.request('rrhs-hunt-personal-demo', action) : Promise.reject(new Error('Use a current browser with Web Locks for the presentation.'));
  function saved() { return own.snapshot(); }
  function render(value) {
    state = value;
    $('found').textContent = value.records.length; $('remaining').textContent = 12 - value.records.length;
    $('promotion-status').textContent = 'Personal preview · no real coupons';
    $('empty').hidden = value.records.length > 0;
    $('claims').innerHTML = [...value.records].reverse().map(record => {
      const date = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(record.createdAt));
      return `<tr><td data-label="Student"><strong>${escape(record.studentId)}</strong><small>${escape(date)} Central</small></td><td data-label="Reward">${record.percentage}%</td><td data-label="Preview ref"><code>${escape(record.reference)}</code></td><td data-label="Email"><button type="button" data-email="${record.id}">View preview</button></td></tr>`;
    }).join('');
  }
  function mirror(value) {
    // The hosted page keeps a browser-only backup, never a server-side student log.
    localStorage.setItem(factory.KEY, JSON.stringify(value)); render(value);
  }
  function rpc(action, input) {
    if (!connected) return Promise.reject(new Error('Open the storefront from this dashboard to connect it.'));
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timeout = setTimeout(() => { waiting.delete(id); reject(new Error('The storefront connection timed out. Open it again from this dashboard.')); }, 6000);
      waiting.set(id, { resolve, reject, timeout }); connected.postMessage({ id, action, input });
    });
  }
  async function refresh() {
    try { if (connected) mirror(await rpc('snapshot')); else render(saved()); }
    catch (error) { $('notice').textContent = error.message; }
  }
  function connect(target, origin) {
    if (!target || !allowed.has(origin)) return;
    sourceWindow = target; sourceOrigin = origin; connected?.close(); connected = null; clearInterval(poll);
    $('connection').textContent = 'Connecting privately to your storefront tab…';
    const attempt = () => {
      if (target.closed) { clearInterval(poll); $('connection').textContent = 'Storefront closed. Your last presentation records are saved on this browser.'; return; }
      target.postMessage({ type: 'rrhs-hunt-presenter-enable' }, origin);
      connectingPort?.close(); const channel = new MessageChannel(); connectingPort = channel.port1;
      channel.port1.onmessage = async event => {
        if (event.data?.event === 'ready') {
          connected = channel.port1; clearInterval(poll);
          $('connection').textContent = 'Connected to your storefront. Records are saved only in this browser.';
          try {
            const current = await rpc('snapshot');
            if (localStorage.getItem('rrhs-hunt-demo-reset-pending') === 'true') {
              await rpc('reset'); localStorage.removeItem('rrhs-hunt-demo-reset-pending');
            } else if (current.updatedAt === 0 && saved().records.length) await rpc('restoreIfEmpty', saved());
            await refresh();
          } catch (error) { $('notice').textContent = error.message; }
        } else if (event.data?.event === 'changed') refresh();
        else {
          const pending = waiting.get(event.data?.id); if (!pending) return;
          clearTimeout(pending.timeout); waiting.delete(event.data.id);
          event.data.error ? pending.reject(new Error(event.data.error)) : pending.resolve(event.data.result);
        }
      };
      target.postMessage({ type: 'rrhs-hunt-demo-connect' }, origin, [channel.port2]);
    };
    attempt(); poll = setInterval(attempt, 1000);
    setTimeout(() => { if (!connected) { clearInterval(poll); $('connection').textContent = 'Not connected yet. Use Open storefront and allow the new tab to open.'; } }, 20000);
  }
  $('promo-toggle').checked = localStorage.getItem('rrhs-hunt-override') === 'true';
  $('promo-toggle').addEventListener('change', () => {
    if (!$('promo-toggle').checked) clearInterval(poll);
    window.RRHSOVERIDE = $('promo-toggle').checked;
    if (sourceWindow && !sourceWindow.closed) sourceWindow.postMessage({ type: 'rrhs-hunt-presenter-enable', enabled: $('promo-toggle').checked }, sourceOrigin);
    $('notice').textContent = $('promo-toggle').checked ? 'Promo preference saved on this browser.' : 'Promo hidden on this browser.';
  });
  $('open-store').addEventListener('click', () => {
    window.RRHSOVERIDE = true; $('promo-toggle').checked = true;
    const url = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
      ? location.origin + '/iframes/projects/index.html' : 'https://rrhscoop.roundrockisd.org';
    const opened = window.open(url, 'rrhs-hunt-store-' + crypto.randomUUID());
    if (!opened) { $('notice').textContent = 'Allow this dashboard to open the storefront tab, then try again.'; return; }
    connect(opened, new URL(url).origin);
  });
  $('replay').addEventListener('click', async () => {
    try { await rpc('replay'); } catch (error) { $('notice').textContent = error.message; }
  });
  $('reset').addEventListener('click', () => $('reset-dialog').showModal());
  $('cancel-reset').addEventListener('click', () => $('reset-dialog').close());
  $('confirm-reset').addEventListener('click', async () => {
    $('confirm-reset').disabled = true;
    try {
      const result = connected ? await rpc('reset') : await lock(() => own.reset());
      if (connected) localStorage.removeItem('rrhs-hunt-demo-reset-pending');
      else localStorage.setItem('rrhs-hunt-demo-reset-pending', 'true');
      mirror(result); $('reset-dialog').close(); $('notice').textContent = 'Demo reset. The testing sticker is available again.';
    } catch (error) { $('notice').textContent = error.message; }
    finally { $('confirm-reset').disabled = false; }
  });
  $('export').addEventListener('click', () => {
    if (!state) return;
    const blob = new Blob([JSON.stringify({ mode: 'personal-demo-only', ...state }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'coop-hunt-personal-demo.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('claims').addEventListener('click', async event => {
    const button = event.target.closest('[data-email]'); if (!button) return;
    const record = state.records.find(r => r.id === button.dataset.email); if (!record) return;
    button.disabled = true;
    try {
      const response = await fetch('/api/v1/easter-hunt?view=email-template&percentage=' + record.percentage);
      if (!response.ok) throw new Error('The email preview could not be loaded. Try again shortly.');
      const email = await response.json();
      const doc = new DOMParser().parseFromString(email.html, 'text/html');
      const code = [...doc.querySelectorAll('p')].find(p => p.textContent.includes('NO CODE · DEVELOPMENT PREVIEW'));
      if (code) code.textContent = record.reference + ' · PREVIEW ONLY';
      $('email-recipient').textContent = 'To: ' + record.studentId + '@student.roundrockisd.org · ' + email.subject;
      $('email-frame').srcdoc = doc.documentElement.outerHTML; $('email-dialog').showModal();
    } catch (error) { $('notice').textContent = error.message; }
    finally { button.disabled = false; }
  });
  $('close-email').addEventListener('click', () => { $('email-dialog').close(); $('email-frame').srcdoc = ''; });
  $('email-dialog').addEventListener('close', () => { $('email-frame').srcdoc = ''; });
  addEventListener('storage', event => {
    if (event.key === factory.KEY && !connected) refresh();
    if (event.key === 'rrhs-hunt-override') $('promo-toggle').checked = event.newValue === 'true';
  });
  addEventListener('message', event => {
    if (event.data?.type === 'rrhs-hunt-storefront-ready' && event.source === sourceWindow && event.origin === sourceOrigin) connect(sourceWindow, sourceOrigin);
  });
  refresh();
  const origin = new URLSearchParams(location.search).get('sourceOrigin');
  if (window.opener && allowed.has(origin)) connect(window.opener, origin);
})();

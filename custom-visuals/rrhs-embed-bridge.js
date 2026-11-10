/* Keep hosted embeds connected when the storefront replaces page content. */
(function () {
  if (window.__rrhsEmbedBridge) return;
  window.__rrhsEmbedBridge = true;
  const assetOrigin = new URL(document.currentScript.src).origin;
  const pages = {
    projects: 'projects/index.html', leadership: 'leadership/index.html',
    faq: 'faq/index.html', teachers: 'teachers/index.html',
    'cfa-preorder': 'teachers/chick-fil-a/index.html',
    cfa: 'cfa/index.html', 'why-coop': 'why-coop/index.html',
    'home-categories': 'home-intro/categories.html'
  };
  const connected = new WeakMap();
  function identify(frame) {
    try {
      const url = new URL(frame.src, location.href);
      if (url.origin !== assetOrigin) return;
      return Object.keys(pages).find(key => url.pathname === '/iframes/' + pages[key] || url.pathname === '/iframes/' + key + '.html');
    } catch (_) {}
  }
  function request(frame, key) {
    if (frame.isConnected) frame.contentWindow.postMessage({ type: 'rrhs-' + key + '-request-height' }, assetOrigin);
  }
  const visibility = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const key = identify(entry.target);
      if (!entry.target.isConnected) visibility.unobserve(entry.target);
      else if (entry.isIntersecting && key) request(entry.target, key);
    });
  });
  function connect() {
    document.querySelectorAll('iframe[src]').forEach(frame => {
      const key = identify(frame);
      if (!key || connected.get(frame) === frame.src) return;
      connected.set(frame, frame.src);
      const refresh = () => {
        request(frame, key);
        // Cover delayed child scripts and font/layout work after load.
        [250, 1000, 3000].forEach(delay => setTimeout(() => request(frame, key), delay));
      };
      frame.addEventListener('load', refresh);
      visibility.observe(frame);
      refresh();
    });
  }
  window.addEventListener('message', event => {
    if (event.origin !== assetOrigin || !event.data) return;
    const frame = Array.from(document.querySelectorAll('iframe[src]')).find(frame => frame.contentWindow === event.source);
    if (!frame) return;
    const key = identify(frame);
    if (!key) return;
    const data = event.data;
    if (data.type === 'rrhs-' + key + '-height' && Number.isFinite(data.height) && data.height > 0 && data.height < 200000) {
      frame.style.setProperty('height', Math.ceil(data.height) + 'px', 'important');
    }
    if (key === 'teachers' && data.type === 'rrhs-teachers-navigate') {
      // Allow only the faculty preorder page and the two pass destinations.
      if (data.href === 'https://rrhscoop.roundrockisd.org/teachers/chick-fil-a' || data.href === 'https://rrhscoop.roundrockisd.org/pass/teacher' || data.href === 'https://forms.gle/iiwbDnSHzayg5gaK8') location.assign(data.href);
    }
  });
  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; connect(); });
  }
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  function refreshAll() {
    connect();
    document.querySelectorAll('iframe[src]').forEach(frame => { const key = identify(frame); if (key) request(frame, key); });
  }
  window.addEventListener('pageshow', refreshAll);
  window.addEventListener('resize', refreshAll);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshAll(); });
  connect();
}());

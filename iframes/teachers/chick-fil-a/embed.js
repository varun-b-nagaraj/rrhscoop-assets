/* Resize the embedded menu and give its checkout drawer the storefront viewport. */
(function () {
  const frame = document.getElementById('rrhs-cfa-preorder-frame');
  if (!frame || frame.dataset.cfaDrawerBridge) return;
  const source = new URL(frame.src);
  if (source.pathname !== '/iframes/teachers/chick-fil-a/index.html') return;
  frame.dataset.cfaDrawerBridge = '1';
  const origin = source.origin;
  let overlay;

  function sendDrawerGeometry(bounds) {
    const viewport = frame.getBoundingClientRect();
    frame.contentWindow.postMessage({
      type: 'rrhs-cfa-preorder-drawer-ready',
      menu: { top: bounds.top - viewport.top, left: bounds.left - viewport.left, width: bounds.width },
    }, origin);
  }

  function openDrawer() {
    if (!frame.isConnected) return;
    if (overlay) {
      sendDrawerGeometry(overlay.placeholder.getBoundingClientRect());
      return;
    }
    const bounds = frame.getBoundingClientRect();
    const placeholder = document.createElement('div');
    placeholder.setAttribute('aria-hidden', 'true');
    placeholder.style.height = bounds.height + 'px';
    const root = document.documentElement;
    overlay = {
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      gutter: root.style.getPropertyValue('scrollbar-gutter'),
      gutterPriority: root.style.getPropertyPriority('scrollbar-gutter'),
      anchor: root.style.getPropertyValue('overflow-anchor'),
      anchorPriority: root.style.getPropertyPriority('overflow-anchor'),
      placeholder,
      style: frame.getAttribute('style'),
      overflow: document.body.style.getPropertyValue('overflow'),
      overflowPriority: document.body.style.getPropertyPriority('overflow'),
    };
    // Preserve the host's layout while taking the iframe out of document flow.
    root.style.setProperty('scrollbar-gutter', 'stable', 'important');
    root.style.setProperty('overflow-anchor', 'none', 'important');
    frame.before(placeholder);
    frame.dataset.cfaDrawerOpen = '1';
    const styles = {
      position: 'fixed', inset: '0', width: '100%', height: '100%',
      'max-width': 'none', 'max-height': 'none', margin: '0', background: 'transparent',
      'z-index': '2147483647',
    };
    Object.entries(styles).forEach(([key, value]) => frame.style.setProperty(key, value, 'important'));
    document.body.style.setProperty('overflow', 'hidden', 'important');
    restoreScroll(overlay);
    sendDrawerGeometry(bounds);
  }

  function restoreScroll({ scrollX, scrollY }) {
    if (window.scrollX !== scrollX || window.scrollY !== scrollY) {
      window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' });
    }
  }

  function closeDrawer() {
    if (!overlay) return;
    const saved = overlay;
    const { placeholder, style, overflow, overflowPriority } = saved;
    overlay = null;
    if (style === null) frame.removeAttribute('style');
    else frame.setAttribute('style', style);
    delete frame.dataset.cfaDrawerOpen;
    placeholder.remove();
    if (overflow) document.body.style.setProperty('overflow', overflow, overflowPriority);
    else document.body.style.removeProperty('overflow');
    const root = document.documentElement;
    root.style.setProperty('scrollbar-gutter', saved.gutter, saved.gutterPriority);
    root.style.setProperty('overflow-anchor', saved.anchor, saved.anchorPriority);
    restoreScroll(saved);
    frame.contentWindow?.postMessage({ type: 'rrhs-cfa-preorder-drawer-closed' }, origin);
  }

  window.addEventListener('message', event => {
    if (event.source !== frame.contentWindow || event.origin !== origin || !event.data) return;
    const { type, open, height } = event.data;
    if (type === 'rrhs-cfa-preorder-drawer') {
      if (open === true) openDrawer();
      else if (open === false) closeDrawer();
    }
    if (type === 'rrhs-cfa-preorder-height' && !overlay && Number.isFinite(height) && height > 0 && height < 100000) {
      frame.style.setProperty('height', Math.ceil(height) + 'px', 'important');
    }
  });

  const requestHeight = () => frame.contentWindow?.postMessage({ type: 'rrhs-cfa-preorder-request-height' }, origin);
  frame.addEventListener('load', requestHeight);
  window.addEventListener('pageshow', requestHeight);
  window.addEventListener('pagehide', closeDrawer);
  window.addEventListener('resize', () => {
    if (overlay) sendDrawerGeometry(overlay.placeholder.getBoundingClientRect());
  });
  new MutationObserver(() => {
    if (!frame.isConnected) closeDrawer();
  }).observe(document.body, { childList: true, subtree: true });
  requestHeight();
}());

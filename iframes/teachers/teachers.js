/* Resize the teacher page embed and route section links through its host page. */
(function () {
  const root = document.documentElement;
  const guide = document.querySelector('.jump-nav');
  function measureGuide() {
    root.style.setProperty('--teacher-nav-height', guide.getBoundingClientRect().height + 'px');
  }
  function setViewport(height) {
    root.style.setProperty('--teacher-viewport', Math.round(height) + 'px');
    root.classList.toggle('teacher-compact', height < 800);
  }
  // Use a fixed measurement so an auto-sized iframe cannot inflate its own hero.
  setViewport(window.innerHeight);
  measureGuide();
  new ResizeObserver(measureGuide).observe(guide);
  if (window.parent === window) {
    window.addEventListener('resize', () => setViewport(window.innerHeight));
    return;
  }
  let parentOrigin = '*';
  try { if (document.referrer) parentOrigin = new URL(document.referrer).origin; } catch (_) {}
  document.querySelectorAll('[data-pass-link]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      window.parent.postMessage({ type: 'rrhs-teachers-navigate', href: link.href }, parentOrigin);
    });
  });
  let lastHeight = 0;
  function sendHeight() {
    const height = Math.ceil(document.body.scrollHeight);
    if (height === lastHeight) return;
    lastHeight = height;
    window.parent.postMessage({ type: 'rrhs-teachers-height', height }, parentOrigin);
  }
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const target = document.getElementById(link.hash.slice(1));
      if (!target || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      window.parent.postMessage({ type: 'rrhs-teachers-scroll', top: target.getBoundingClientRect().top + window.scrollY }, parentOrigin);
    });
  });
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || (parentOrigin !== '*' && event.origin !== parentOrigin)) return;
    if (event.data && event.data.type === 'rrhs-teachers-viewport' &&
        Number.isFinite(event.data.height) && event.data.height >= 320 && event.data.height <= 10000) {
      setViewport(event.data.height);
    }
    if (event.data && event.data.type === 'rrhs-teachers-request-height') {
      lastHeight = 0;
      sendHeight();
    }
  });
  new ResizeObserver(sendHeight).observe(document.body);
  window.addEventListener("rrhs-embed-resize", sendHeight);
  window.addEventListener('load', sendHeight, { once: true });
  if (document.fonts) document.fonts.ready.then(sendHeight);
  sendHeight();
  window.parent.postMessage({ type: 'rrhs-teachers-ready' }, parentOrigin);
}());

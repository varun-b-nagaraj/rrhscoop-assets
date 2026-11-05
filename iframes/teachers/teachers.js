/* Resize the teacher page embed and route section links through its host page. */
(function () {
  if (window.parent === window) return;
  let parentOrigin = '*';
  try { if (document.referrer) parentOrigin = new URL(document.referrer).origin; } catch (_) {}
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
    if (event.data && event.data.type === 'rrhs-teachers-request-height') {
      lastHeight = 0;
      sendHeight();
    }
  });
  new ResizeObserver(sendHeight).observe(document.body);
  window.addEventListener('load', sendHeight, { once: true });
  if (document.fonts) document.fonts.ready.then(sendHeight);
  sendHeight();
}());

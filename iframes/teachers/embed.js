/* Host-page bridge for the paste-once teacher information embed. */
(function () {
  var frame = document.getElementById('rrhs-teachers-frame');
  if (!frame || frame.dataset.bridgeReady) return;
  frame.dataset.bridgeReady = '1';
  var origin = new URL(frame.src).origin;
  window.addEventListener('message', function (event) {
    if (event.source !== frame.contentWindow || event.origin !== origin || !event.data) return;
    if (event.data.type === 'rrhs-teachers-ready') sendViewport(true);
    if (event.data.type === 'rrhs-teachers-height' && Number.isFinite(event.data.height) && event.data.height > 0 && event.data.height < 50000) {
      frame.style.height = Math.ceil(event.data.height) + 'px';
    }
    if (event.data.type === 'rrhs-teachers-scroll' && Number.isFinite(event.data.top) && event.data.top >= 0 && event.data.top <= frame.offsetHeight) {
      var header = document.querySelector('.ins-header');
      var offset = header ? header.getBoundingClientRect().height + 16 : 24;
      var top = frame.getBoundingClientRect().top + window.scrollY + event.data.top - offset;
      window.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  });
  var lastViewportHeight = 0;
  var viewportPending = false;
  function sendViewport(force) {
    var header = document.querySelector('.ins-header');
    var headerHeight = header ? header.getBoundingClientRect().height : 0;
    var frameTop = frame.getBoundingClientRect().top + window.scrollY;
    var topInset = Math.max(headerHeight, frameTop, 0);
    var height = Math.round(Math.max(320, window.innerHeight - topInset));
    if (force !== true && height === lastViewportHeight) return;
    lastViewportHeight = height;
    frame.contentWindow.postMessage({ type: 'rrhs-teachers-viewport', height: height }, origin);
  }
  function scheduleViewport() {
    if (viewportPending) return;
    viewportPending = true;
    window.requestAnimationFrame(function () {
      viewportPending = false;
      sendViewport();
    });
  }
  // The launch banner can arrive after this bridge and move the entire iframe.
  new ResizeObserver(scheduleViewport).observe(document.body);
  new MutationObserver(scheduleViewport).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', scheduleViewport);
  window.addEventListener('load', scheduleViewport);
  window.addEventListener('pageshow', scheduleViewport);
  if (document.fonts) document.fonts.ready.then(scheduleViewport);
  function requestHeight() {
    sendViewport(true);
    frame.contentWindow.postMessage({ type: 'rrhs-teachers-request-height' }, origin);
  }
  frame.addEventListener('load', requestHeight);
  requestHeight();
}());

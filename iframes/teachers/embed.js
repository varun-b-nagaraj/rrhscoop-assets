/* Host-page bridge for the paste-once teacher information embed. */
(function () {
  var frame = document.getElementById('rrhs-teachers-frame');
  if (!frame || frame.dataset.bridgeReady) return;
  frame.dataset.bridgeReady = '1';
  var origin = new URL(frame.src).origin;
  window.addEventListener('message', function (event) {
    if (event.source !== frame.contentWindow || event.origin !== origin || !event.data) return;
    if (event.data.type === 'rrhs-teachers-ready') sendViewport();
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
  function sendViewport() {
    var header = document.querySelector('.ins-header');
    var headerHeight = header ? header.getBoundingClientRect().height : 0;
    var frameTop = frame.getBoundingClientRect().top + window.scrollY;
    var topInset = Math.max(headerHeight, frameTop, 0);
    var height = Math.max(320, window.innerHeight - topInset);
    frame.contentWindow.postMessage({ type: 'rrhs-teachers-viewport', height: height }, origin);
  }
  window.addEventListener('resize', sendViewport);
  function requestHeight() {
    sendViewport();
    frame.contentWindow.postMessage({ type: 'rrhs-teachers-request-height' }, origin);
  }
  frame.addEventListener('load', requestHeight);
  requestHeight();
}());

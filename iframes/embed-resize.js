/* Recheck content height after delayed assets, disclosures, and restored pages. */
(function () {
  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      window.dispatchEvent(new Event('rrhs-embed-resize'));
    });
  }
  new ResizeObserver(schedule).observe(document.body);
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('load', schedule, true);
  document.addEventListener('error', schedule, true);
  document.addEventListener('toggle', schedule, true);
  window.addEventListener('pageshow', schedule);
  if (document.fonts) {
    document.fonts.ready.then(schedule);
    document.fonts.addEventListener('loadingdone', schedule);
  }
  schedule();
}());

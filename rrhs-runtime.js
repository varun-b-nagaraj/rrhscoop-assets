/* rrhs-runtime.js - shared lightweight runtime utilities (DOM + timers) */
(function () {
  if (typeof window === "undefined") return;
  if (window.RRHS_RUNTIME && window.RRHS_RUNTIME.__installed) return;

  const runtime = {
    __installed: true
  };

  // ---- DOM change observer (shared) ----
  const domListeners = new Set();
  let domObserverInstalled = false;
  let domScheduled = false;

  const raf =
    (typeof window.requestAnimationFrame === "function")
      ? window.requestAnimationFrame.bind(window)
      : (fn) => setTimeout(fn, 0);

  function runDomListeners() {
    domScheduled = false;
    domListeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {}
    });
  }

  function scheduleDomRun() {
    if (domScheduled) return;
    domScheduled = true;
    raf(runDomListeners);
  }

  function installDomObserver() {
    if (domObserverInstalled) return;
    domObserverInstalled = true;

    try {
      const target = document.body || document.documentElement;
      if (target && typeof MutationObserver !== "undefined") {
        const observer = new MutationObserver(scheduleDomRun);
        observer.observe(target, { childList: true, subtree: true });
      }
    } catch (e) {}

    if (document && document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", scheduleDomRun, { once: true });
    }
  }

  runtime.onDomChanged = (fn, opts = null) => {
    if (typeof fn !== "function") return () => {};
    installDomObserver();
    domListeners.add(fn);
    if (!opts || opts.runNow !== false) scheduleDomRun();
    return () => domListeners.delete(fn);
  };

  // ---- Shared intervals ----
  const intervalMap = new Map(); // ms -> { id, listeners:Set }

  runtime.every = (ms, fn, opts = null) => {
    const intervalMs = Math.max(0, Math.floor(Number(ms) || 0));
    if (!intervalMs || typeof fn !== "function") return () => {};

    let entry = intervalMap.get(intervalMs);
    if (!entry) {
      entry = { id: null, listeners: new Set() };
      entry.id = setInterval(() => {
        entry.listeners.forEach((cb) => {
          try {
            cb();
          } catch (e) {}
        });
      }, intervalMs);
      intervalMap.set(intervalMs, entry);
    }

    entry.listeners.add(fn);
    if (opts && opts.runNow === true) {
      try {
        fn();
      } catch (e) {}
    }

    return () => {
      entry.listeners.delete(fn);
      if (entry.listeners.size === 0) {
        try {
          clearInterval(entry.id);
        } catch (e) {}
        intervalMap.delete(intervalMs);
      }
    };
  };

  runtime.raf = raf;
  runtime.scheduleDomRun = scheduleDomRun;

  window.RRHS_RUNTIME = runtime;
})();


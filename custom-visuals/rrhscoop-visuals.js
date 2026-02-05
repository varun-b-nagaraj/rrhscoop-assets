/* rrhscoop-visuals.js - extracted visuals module */
(function () {
  const RRHS_DEBUG =
    (typeof window !== "undefined" &&
      (window.RRHS_DEBUG === true ||
        (typeof localStorage !== "undefined" &&
          localStorage.getItem("RRHS_DEBUG") === "1"))) ||
    false;

  const log = (...args) => {
    if (RRHS_DEBUG) console.log(...args);
  };

  const BASE = "https://rrhscoop-assets.vercel.app/custom-visuals";
  const IMAGE_MAP = {
    "ins-tile__category-item-169641499": `${BASE}/snack.png?v=2`,
    "ins-tile__category-item-169641959": `${BASE}/beverage.png?v=2`,
    "ins-tile__category-item-189782257": `${BASE}/merch.png?v=2`,
    "ins-tile__category-item-194772751": `${BASE}/supplies.png?v=2`
  };

  function logContext() {
    if (!RRHS_DEBUG) return;
    log("=== RRHS VISUALS DEBUG START ===");
    log(
      "Has .ins-tile__category-collection?",
      !!document.querySelector(".ins-tile__category-collection"),
    );
    log(
      "Has .ins-tile__category-image-wrapper?",
      !!document.querySelector(".ins-tile__category-image-wrapper"),
    );
    for (const id in IMAGE_MAP) {
      log(`Has ${id}?`, !!document.getElementById(id));
    }
    log("=== RRHS VISUALS DEBUG END ===");
  }

  const preloadedImages = {};
  Object.values(IMAGE_MAP).forEach(url => {
    if (!preloadedImages[url]) {
      const img = new Image();
      img.src = url;
      preloadedImages[url] = img;
    }
  });

  function findTileRoot() {
    for (const id in IMAGE_MAP) {
      const el = document.getElementById(id);
      if (el) {
        return el.closest(".ins-tile__category-collection");
      }
    }
    return null;
  }

  function createOverlayImage(container) {
    const overlay = document.createElement("img");
    overlay.style.cssText = `
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      pointer-events: none !important;
      transition: opacity 50ms ease !important;
      opacity: 0 !important;
      z-index: 1 !important;
      display: block !important;
    `;
    overlay.dataset.rrhsOverlay = "1";
    overlay.alt = "Category image";
    return overlay;
  }

  function shouldRunImageSwap() {
    const hasCategoryTile = document.querySelector('.ins-tile__category-collection');
    const hasImageWrapper = document.querySelector('.ins-tile__category-image-wrapper');
    const inModal = document.querySelector('.ec-modal__content, .ec-popup');
    const inCheckout = document.querySelector('.ec-cart, .ec-cart-step, .ec-checkout');
    const hasContactForm = document.querySelector('.ec-form, input[name="email"], input[placeholder*="email" i]');
    const shouldRun = hasCategoryTile && hasImageWrapper && !inModal && !inCheckout && !hasContactForm;
    log('RRHS: visuals shouldRunImageSwap check:', { hasCategoryTile, hasImageWrapper, inModal: !!inModal, inCheckout: !!inCheckout, hasContactForm: !!hasContactForm, shouldRun });
    return shouldRun;
  }

  function initCategoryImageSwap() {
    if (!shouldRunImageSwap()) {
      log('RRHS: shouldRunImageSwap returned false, skipping visuals');
      return;
    }

    const root = findTileRoot();
    if (!root) {
      log('RRHS: Could not find tile root for visuals');
      return;
    }

    const existingOverlay = root.querySelector('img[data-rrhs-overlay="1"]');
    if (existingOverlay && existingOverlay.parentNode) {
      log('RRHS: Overlay already exists');
      return;
    }
    root.dataset.imgSwapInit = "1";

    let container = root.querySelector(".ins-tile__category-image");
    if (!container) container = root.querySelector(".ins-tile__image");
    if (!container) {
      const picture = root.querySelector("picture");
      if (picture) container = picture.parentElement;
    }

    const wrap = root.querySelector(".ins-tile__category-items-wrapper");
    if (!container || !wrap) {
      log('RRHS: Could not find container or wrapper', {container, wrap});
      return;
    }

    log('RRHS: Found container and wrapper, initializing image swap');

    const position = getComputedStyle(container).position;
    if (position === "static") container.style.position = "relative";
    container.style.overflow = "hidden";

    const overlay = createOverlayImage(container);
    container.appendChild(overlay);

    container.querySelectorAll("picture").forEach(pic => {
      pic.style.cssText = "opacity: 0 !important; pointer-events: none !important; position: absolute !important;";
    });
    container.querySelectorAll("img").forEach(img => { if (img !== overlay) img.style.cssText = "opacity: 0 !important; pointer-events: none !important;"; });

    let currentUrl = null;
    const setImage = (url) => {
      if (!url || currentUrl === url) return;
      currentUrl = url;
      log('RRHS: Setting image to', url);
      overlay.style.opacity = "0";
      setTimeout(() => {
        overlay.src = url;
        requestAnimationFrame(() => { overlay.style.opacity = "1"; });
      }, 50);
    };

    const active = root.querySelector(".ins-tile__category-item--active");
    let initialItem = active;
    if (!initialItem || !IMAGE_MAP[initialItem.id]) {
      for (const id in IMAGE_MAP) { const el = document.getElementById(id); if (el) { initialItem = el; break; } }
    }
    if (initialItem && IMAGE_MAP[initialItem.id]) {
      log('RRHS: Setting initial image for', initialItem.id);
      overlay.src = IMAGE_MAP[initialItem.id];
      overlay.style.opacity = "1";
      currentUrl = IMAGE_MAP[initialItem.id];
    }

    const handler = (e) => {
      const item = e.target.closest(".ins-tile__category-item");
      if (!item || !wrap.contains(item)) return;
      const url = IMAGE_MAP[item.id];
      if (url) setImage(url);
    };

    wrap.addEventListener("mouseover", handler);
    wrap.addEventListener("focusin", handler);
  }

  function boot() {
    try {
      logContext();
      initCategoryImageSwap();
    } catch (e) { log('RRHS visuals boot error', e); }
  }

  let bootScheduled = false;
  const raf = (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") ? window.requestAnimationFrame.bind(window) : (fn) => setTimeout(fn, 0);
  const scheduleBoot = () => {
    if (bootScheduled) return;
    bootScheduled = true;
    raf(() => { bootScheduled = false; boot(); });
  };

  scheduleBoot();
  const observer = new MutationObserver(scheduleBoot);
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scheduleBoot);

})();

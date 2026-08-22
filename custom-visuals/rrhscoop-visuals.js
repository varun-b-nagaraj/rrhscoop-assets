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

  const CATEGORY_CARD_MAP = {
    "ins-tile__category-item-169641499": {
      image: IMAGE_MAP["ins-tile__category-item-169641499"],
      background: "#141414",
      foreground: "#f1eee8"
    },
    "ins-tile__category-item-169641959": {
      image: IMAGE_MAP["ins-tile__category-item-169641959"],
      background: "#6e1f2a",
      foreground: "#f1eee8"
    },
    "ins-tile__category-item-189782257": {
      image: IMAGE_MAP["ins-tile__category-item-189782257"],
      background: "#2a2a28",
      foreground: "#f1eee8"
    },
    "ins-tile__category-item-194772751": {
      image: IMAGE_MAP["ins-tile__category-item-194772751"],
      background: "#141414",
      foreground: "#f1eee8"
    },
    "ins-tile__category-item-196956751": {
      image: null,
      background: "#ebebe2",
      foreground: "#6e1f2a",
      isCfa: true
    }
  };

  function ensureThemeTokens() {
    if (document.getElementById("rrhs-theme-tokens")) return;

    const link = document.createElement("link");
    link.id = "rrhs-theme-tokens";
    link.rel = "stylesheet";
    link.href = `${BASE}/theme-tokens.css?v=1`;
    (document.head || document.documentElement).appendChild(link);
  }

  function ensureCategoryCardStyles() {
    if (document.getElementById("rrhs-category-card-styles")) return;

    const style = document.createElement("style");
    style.id = "rrhs-category-card-styles";
    style.textContent = `
      .rrhs-category-cards {
        display: grid !important;
        grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
        gap: clamp(12px, 1.6vw, 22px) !important;
        align-items: stretch !important;
      }

      .rrhs-category-cards .ins-tile__category-item {
        width: auto !important;
        min-width: 0 !important;
        height: clamp(340px, 30vw, 430px) !important;
        margin: 0 !important;
        overflow: hidden !important;
        border-radius: var(--rrhs-radius-card, 16px) !important;
        background: var(--rrhs-card-bg, #141414) !important;
        box-shadow: 0 12px 30px rgb(20 20 20 / 0.08);
        opacity: 0;
        transform: translateY(32px);
        transition:
          opacity 700ms var(--rrhs-motion-standard, cubic-bezier(0.22, 1, 0.36, 1)),
          transform 700ms var(--rrhs-motion-standard, cubic-bezier(0.22, 1, 0.36, 1)),
          box-shadow 400ms ease;
        transition-delay: var(--rrhs-card-delay, 0ms);
      }

      .rrhs-category-cards.rrhs-category-cards--visible .ins-tile__category-item {
        opacity: 1;
        transform: translateY(0);
      }

      .rrhs-category-cards .ins-tile__category-link {
        position: relative !important;
        display: flex !important;
        width: 100% !important;
        height: 100% !important;
        min-height: 0 !important;
        overflow: hidden !important;
        color: var(--rrhs-card-fg, #f1eee8) !important;
        isolation: isolate;
      }

      .rrhs-category-cards .ins-tile__category-image,
      .rrhs-category-cards .ins-tile__image {
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        min-height: 0 !important;
        margin: 0 !important;
        background: transparent !important;
      }

      .rrhs-category-cards picture {
        display: none !important;
      }

      .rrhs-category-card__visual {
        position: absolute;
        inset: 5%;
        display: block;
        width: 90%;
        height: 90%;
        object-fit: contain;
        pointer-events: none;
        transform: scale(0.96);
        transition: transform 650ms var(--rrhs-motion-standard, cubic-bezier(0.22, 1, 0.36, 1));
      }

      .rrhs-category-card--cfa .rrhs-category-card__visual {
        inset: 14%;
        width: 72%;
        height: 72%;
        object-fit: contain;
        filter: brightness(1.2) contrast(1.1) saturate(1.5);
        mix-blend-mode: multiply;
      }

      .rrhs-category-cards .ins-tile__category-link::after {
        content: "";
        position: absolute;
        z-index: 1;
        inset: 38% 0 0;
        background: linear-gradient(to bottom, transparent, rgb(20 20 20 / 0.56));
        pointer-events: none;
      }

      .rrhs-category-cards .rrhs-category-card--cfa .ins-tile__category-link::after {
        background: linear-gradient(to bottom, transparent, rgb(110 31 42 / 0.08));
      }

      .rrhs-category-cards .ins-tile__category-content {
        position: absolute !important;
        z-index: 2;
        right: 0;
        bottom: 0;
        left: 0;
        display: block !important;
        width: auto !important;
        margin: 0 !important;
        padding: 24px 20px !important;
        background: transparent !important;
        text-align: left !important;
        color: inherit !important;
      }

      .rrhs-category-cards .ins-tile__category-name {
        display: flex;
        gap: 10px;
        align-items: center;
        justify-content: space-between;
        margin: 0 !important;
        color: inherit !important;
        font-family: var(--rrhs-font-title, "Raleway", Arial, sans-serif) !important;
        font-size: clamp(15px, 1.25vw, 19px) !important;
        font-weight: 700 !important;
        line-height: 1.15 !important;
        letter-spacing: -0.02em !important;
        text-align: left !important;
        text-transform: uppercase;
      }

      .rrhs-category-cards .ins-tile__category-name::after {
        content: "→";
        flex: 0 0 auto;
        font-family: Arial, sans-serif;
        font-size: 1.25em;
        font-weight: 400;
        transition: transform 300ms ease;
      }

      .rrhs-category-cards .ins-tile__category-link:hover .rrhs-category-card__visual,
      .rrhs-category-cards .ins-tile__category-link:focus-visible .rrhs-category-card__visual {
        transform: scale(1.025);
      }

      .rrhs-category-cards .ins-tile__category-link:hover .ins-tile__category-name::after,
      .rrhs-category-cards .ins-tile__category-link:focus-visible .ins-tile__category-name::after {
        transform: translateX(5px);
      }

      .rrhs-category-cards .ins-tile__category-item:hover,
      .rrhs-category-cards .ins-tile__category-item:focus-within {
        transform: translateY(-8px);
        box-shadow: 0 22px 45px rgb(20 20 20 / 0.16);
      }

      @media screen and (max-width: 1099px) {
        .rrhs-category-cards {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        }

        .rrhs-category-cards .ins-tile__category-item {
          height: 390px !important;
        }
      }

      @media screen and (max-width: 699px) {
        .rrhs-category-cards {
          grid-template-columns: none !important;
          grid-auto-flow: column;
          grid-auto-columns: min(82vw, 300px);
          justify-content: start !important;
          overflow-x: auto;
          padding: 0 4px 16px !important;
          scroll-snap-type: x mandatory;
          scrollbar-width: thin;
        }

        .rrhs-category-cards .ins-tile__category-item {
          height: 390px !important;
          scroll-snap-align: start;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .rrhs-category-cards .ins-tile__category-item,
        .rrhs-category-card__visual,
        .rrhs-category-cards .ins-tile__category-name::after {
          opacity: 1;
          transform: none !important;
          transition: none !important;
        }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function revealCategoryCards(collection) {
    if (collection.dataset.rrhsRevealInit === "1") return;
    collection.dataset.rrhsRevealInit = "1";

    if (typeof IntersectionObserver !== "function") {
      collection.classList.add("rrhs-category-cards--visible");
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      collection.classList.add("rrhs-category-cards--visible");
      observer.disconnect();
    }, { threshold: 0.18 });
    observer.observe(collection);
  }

  function initCategoryCards() {
    ensureThemeTokens();
    ensureCategoryCardStyles();

    const firstItem = document.getElementById(Object.keys(CATEGORY_CARD_MAP)[0]);
    const collection = firstItem && firstItem.closest(".ins-tile__category-collection");
    if (!collection || collection.dataset.rrhsCardsInit === "1") return;

    const items = Array.from(collection.querySelectorAll(":scope > .ins-tile__category-item"));
    const isMatchingCollection = items.length >= 4 && items.every((item) => CATEGORY_CARD_MAP[item.id]);
    if (!isMatchingCollection) return;

    collection.dataset.rrhsCardsInit = "1";
    collection.classList.add("rrhs-category-cards");

    items.forEach((item, index) => {
      const config = CATEGORY_CARD_MAP[item.id];
      const imageContainer = item.querySelector(".ins-tile__image");
      if (!config || !imageContainer) return;

      const nativeImage = imageContainer.querySelector(".ins-picture--full img, img");
      const visual = document.createElement("img");
      visual.className = "rrhs-category-card__visual";
      visual.src = config.image || (nativeImage && (nativeImage.currentSrc || nativeImage.src));
      visual.alt = "";
      visual.loading = index === 0 ? "eager" : "lazy";
      visual.decoding = "async";

      item.style.setProperty("--rrhs-card-bg", config.background);
      item.style.setProperty("--rrhs-card-fg", config.foreground);
      item.style.setProperty("--rrhs-card-delay", `${index * 85}ms`);
      item.classList.toggle("rrhs-category-card--cfa", Boolean(config.isCfa));
      imageContainer.appendChild(visual);
    });

    revealCategoryCards(collection);
  }

  const HERO_HEADLINE = "BUILT FOR DRAGONS";

  function ensureHeroLayoutStyles() {
    if (document.getElementById("rrhs-hero-layout-styles")) return;

    const style = document.createElement("style");
    style.id = "rrhs-hero-layout-styles";
    style.textContent = `
      @media screen and (min-width: 900px) {
        .rrhs-balanced-hero .ins-tile__wrap,
        .rrhs-balanced-hero .grid-container-item > .flex.relative.flex-col,
        .rrhs-balanced-hero__content {
          justify-content: center !important;
        }

        .rrhs-balanced-hero .ins-tile__tagline,
        .rrhs-balanced-hero .ins-tile__headline,
        .rrhs-balanced-hero .ins-tile__footer {
          width: 48% !important;
        }

        .rrhs-balanced-hero .ins-tile__tagline {
          flex: 0 0 auto !important;
        }

        .rrhs-balanced-hero .ins-tile__spacer {
          display: none !important;
        }

        .rrhs-balanced-hero .ins-tile__headline:not(:first-child),
        .rrhs-balanced-hero .ins-tile__footer:not(:first-child) .ins-tile__description {
          margin-top: 48px !important;
        }

        .rrhs-balanced-hero .ins-tile__footer:not(:first-child) .ins-tile__buttons,
        .rrhs-balanced-hero .ins-tile__buttons:not(:first-child) {
          margin-top: 48px !important;
        }
      }

      @media screen and (min-width: 1200px) {
        .rrhs-balanced-hero__content {
          transform: translateX(clamp(24px, 3vw, 56px));
        }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function balanceHeroLayout() {
    ensureHeroLayoutStyles();

    document.querySelectorAll(".ins-tile--cover").forEach((tile) => {
      const headline = tile.querySelector(".ins-tile__headline");
      const headlineText = headline
        ? headline.textContent.replace(/\s+/g, " ").trim().toUpperCase()
        : "";
      const isTargetHero = headlineText === HERO_HEADLINE;

      tile.classList.toggle("rrhs-balanced-hero", isTargetHero);
      if (headline && headline.parentElement) {
        headline.parentElement.classList.toggle("rrhs-balanced-hero__content", isTargetHero);
      }
    });
  }

  function ensureMinimalMarqueeStyles() {
    if (document.getElementById("rrhs-minimal-marquee-styles")) return;

    const style = document.createElement("style");
    style.id = "rrhs-minimal-marquee-styles";
    style.textContent = `
      .rrhs-full-width-marquee > .section__animation > .section__container {
        padding-left: 0 !important;
        padding-right: 0 !important;
      }

      .rrhs-full-width-marquee > .section__animation > .section__container > .section__content {
        width: 100% !important;
        max-width: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function fixMinimalMarqueeWidth() {
    ensureMinimalMarqueeStyles();

    document
      .querySelectorAll(".ins-tile--feature-list.ins-tile--minimal")
      .forEach((tile) => {
        const body = tile.querySelector(".ins-tile__body");
        const isTextOnlyMarquee =
          body &&
          !body.classList.contains("ins-tile__body--has-icon") &&
          body.querySelectorAll(":scope > .ins-tile__item").length > 1;

        tile.classList.toggle("rrhs-full-width-marquee", Boolean(isTextOnlyMarquee));
      });
  }

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
      balanceHeroLayout();
      fixMinimalMarqueeWidth();
      initCategoryCards();
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

  const runtime = (typeof window !== "undefined") ? window.RRHS_RUNTIME : null;
  if (runtime && typeof runtime.onDomChanged === "function") {
    runtime.onDomChanged(scheduleBoot, { runNow: true });
  } else {
    scheduleBoot();
    const observer = new MutationObserver(scheduleBoot);
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scheduleBoot);
  }

})();

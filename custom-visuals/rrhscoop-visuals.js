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

  function getAssetBase() {
    try {
      const script =
        document.currentScript ||
        document.querySelector('script[src*="custom-visuals/rrhscoop-visuals.js"]');
      if (script && script.src) return new URL(".", script.src).href.replace(/\/$/, "");
    } catch (e) {
      log("RRHS: could not resolve asset base from current script", e);
    }
    return "https://rrhscoop-assets.vercel.app/custom-visuals";
  }

  const BASE = getAssetBase();
  const ASSET_VERSION = "5";
  const assetUrl = (file) => `${BASE}/${file}?v=${ASSET_VERSION}`;
  const IMAGE_MAP = {
    "ins-tile__category-item-169641499": assetUrl("snack.png"),
    "ins-tile__category-item-169641959": assetUrl("beverage.png"),
    "ins-tile__category-item-189782257": assetUrl("merch.png"),
    "ins-tile__category-item-194772751": assetUrl("supplies.png")
  };
  const PHOTO_MAP = {
    "ins-tile__category-item-169641499": assetUrl("category-backgrounds/food.jpg"),
    "ins-tile__category-item-169641959": assetUrl("category-backgrounds/drink.jpg"),
    "ins-tile__category-item-189782257": assetUrl("category-backgrounds/merchandise.jpg"),
    "ins-tile__category-item-194772751": assetUrl("category-backgrounds/supplies.jpg"),
    "ins-tile__category-item-196956751": assetUrl("category-backgrounds/chick-fil-a.jpg")
  };

  const CATEGORY_CARD_MAP = {
    "ins-tile__category-item-169641499": {
      image: IMAGE_MAP["ins-tile__category-item-169641499"],
      photo: PHOTO_MAP["ins-tile__category-item-169641499"],
      background: "#221817",
      foreground: "#faf8f4",
      wash: "rgb(20 20 20 / 0.48)",
      labelBackground: "rgb(20 20 20 / 0.78)",
      visualFilter: "brightness(0) invert(1)"
    },
    "ins-tile__category-item-169641959": {
      image: IMAGE_MAP["ins-tile__category-item-169641959"],
      photo: PHOTO_MAP["ins-tile__category-item-169641959"],
      background: "#6e1f2a",
      foreground: "#faf8f4",
      wash: "rgb(110 31 42 / 0.48)",
      labelBackground: "rgb(110 31 42 / 0.84)",
      visualFilter: "brightness(0) invert(1)"
    },
    "ins-tile__category-item-189782257": {
      image: IMAGE_MAP["ins-tile__category-item-189782257"],
      photo: PHOTO_MAP["ins-tile__category-item-189782257"],
      background: "#2a2a28",
      foreground: "#faf8f4",
      wash: "rgb(42 42 40 / 0.44)",
      labelBackground: "rgb(42 42 40 / 0.76)",
      visualFilter: "brightness(0) invert(1)"
    },
    "ins-tile__category-item-194772751": {
      image: IMAGE_MAP["ins-tile__category-item-194772751"],
      photo: PHOTO_MAP["ins-tile__category-item-194772751"],
      background: "#ebebe2",
      foreground: "#6e1f2a",
      wash: "rgb(235 235 226 / 0.66)",
      labelBackground: "rgb(235 235 226 / 0.9)",
      visualFilter: "brightness(0) saturate(100%) invert(14%) sepia(40%) saturate(2515%) hue-rotate(326deg) brightness(90%) contrast(87%)"
    },
    "ins-tile__category-item-196956751": {
      image: null,
      photo: PHOTO_MAP["ins-tile__category-item-196956751"],
      background: "#faf8f4",
      foreground: "#6e1f2a",
      wash: "rgb(250 248 244 / 0.62)",
      labelBackground: "rgb(250 248 244 / 0.9)",
      visualFilter: "none",
      isCfa: true
    }
  };

  function ensureThemeTokens() {
    if (document.getElementById("rrhs-theme-tokens")) return;

    const link = document.createElement("link");
    link.id = "rrhs-theme-tokens";
    link.rel = "stylesheet";
    link.href = assetUrl("theme-tokens.css");
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
        width: min(1480px, calc(100vw - 96px)) !important;
        max-width: none !important;
        position: relative;
        left: 50%;
        transform: translateX(-50%);
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
        background: var(--rrhs-card-bg, #141414) !important;
        isolation: isolate;
      }

      .rrhs-category-cards .ins-tile__category-link::before {
        content: "";
        position: absolute;
        inset: 0;
        z-index: 1;
        background: var(--rrhs-card-wash, rgb(20 20 20 / 0.42));
        pointer-events: none;
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

      .rrhs-category-card__photo {
        position: absolute;
        inset: 0;
        z-index: 0;
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0.96;
        transform: scale(1.01);
        transition: transform 650ms var(--rrhs-motion-standard, cubic-bezier(0.22, 1, 0.36, 1));
      }

      .rrhs-category-card__visual {
        position: absolute;
        inset: 14% 10% 24%;
        z-index: 2;
        display: block;
        width: 80%;
        height: 62%;
        object-fit: contain;
        opacity: 0.88;
        filter: var(--rrhs-card-visual-filter, brightness(0) invert(1));
        pointer-events: none;
        transform: scale(0.96);
        transition: transform 650ms var(--rrhs-motion-standard, cubic-bezier(0.22, 1, 0.36, 1));
      }

      .rrhs-category-card--cfa .rrhs-category-card__visual {
        inset: 14%;
        width: 72%;
        height: 72%;
        object-fit: contain;
        filter: brightness(1.08) contrast(1.08) saturate(1.3);
        mix-blend-mode: multiply;
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
        background: var(--rrhs-card-label-bg, rgb(20 20 20 / 0.78)) !important;
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
        letter-spacing: 0 !important;
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

      .rrhs-category-cards .ins-tile__category-link:hover .rrhs-category-card__photo,
      .rrhs-category-cards .ins-tile__category-link:focus-visible .rrhs-category-card__photo {
        transform: scale(1.065);
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
          width: 100% !important;
          left: auto;
          transform: none;
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
        .rrhs-category-card__photo,
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

  function firstSrcFromSrcset(srcset) {
    if (!srcset) return "";
    return srcset.split(",")[0].trim().split(/\s+/)[0] || "";
  }

  function nativeImageUrl(imageContainer) {
    const img = imageContainer.querySelector(
      ".ins-picture--full img, img:not(.rrhs-category-card__photo):not(.rrhs-category-card__visual)",
    );
    if (img && (img.currentSrc || img.src)) return img.currentSrc || img.src;

    const source = imageContainer.querySelector("source[srcset]");
    if (source) return firstSrcFromSrcset(source.getAttribute("srcset"));

    return "";
  }

  function resolveCardImage(config, imageContainer) {
    return config.image || nativeImageUrl(imageContainer);
  }

  function ensureCardPhoto(imageContainer, config) {
    if (!config.photo) return;

    let photo = imageContainer.querySelector(":scope > .rrhs-category-card__photo");
    if (!photo) {
      photo = document.createElement("img");
      photo.className = "rrhs-category-card__photo";
      imageContainer.insertBefore(photo, imageContainer.firstChild);
    }

    if (photo.getAttribute("src") !== config.photo) photo.src = config.photo;
    photo.removeAttribute("style");
    photo.alt = "";
    photo.loading = "lazy";
    photo.decoding = "async";
    photo.dataset.rrhsPhoto = "1";
  }

  function ensureCardVisual(item, config, index) {
    const imageContainer = item.querySelector(".ins-tile__image");
    if (!config || !imageContainer) return;

    ensureCardPhoto(imageContainer, config);

    let visual = imageContainer.querySelector(":scope > .rrhs-category-card__visual");
    if (!visual) {
      visual = document.createElement("img");
      visual.className = "rrhs-category-card__visual";
      imageContainer.appendChild(visual);
    }

    const src = resolveCardImage(config, imageContainer);
    if (src && visual.getAttribute("src") !== src) visual.src = src;

    visual.removeAttribute("style");
    visual.alt = "";
    visual.loading = index === 0 ? "eager" : "lazy";
    visual.decoding = "async";
    visual.dataset.rrhsVisual = "1";

    visual.onerror = () => {
      const fallback = nativeImageUrl(imageContainer);
      if (fallback && visual.getAttribute("src") !== fallback) visual.src = fallback;
    };

    item.style.setProperty("--rrhs-card-bg", config.background);
    item.style.setProperty("--rrhs-card-fg", config.foreground);
    item.style.setProperty("--rrhs-card-wash", config.wash);
    item.style.setProperty("--rrhs-card-label-bg", config.labelBackground);
    item.style.setProperty("--rrhs-card-visual-filter", config.visualFilter);
    item.style.setProperty("--rrhs-card-delay", `${index * 85}ms`);
    item.classList.toggle("rrhs-category-card--cfa", Boolean(config.isCfa));
  }

  function initCategoryCards() {
    ensureThemeTokens();
    ensureCategoryCardStyles();

    const firstItem = document.getElementById(Object.keys(CATEGORY_CARD_MAP)[0]);
    const collection = firstItem && firstItem.closest(".ins-tile__category-collection");
    if (!collection) return;

    const items = Array.from(collection.querySelectorAll(":scope > .ins-tile__category-item"));
    const isMatchingCollection = items.length >= 4 && items.every((item) => CATEGORY_CARD_MAP[item.id]);
    if (!isMatchingCollection) return;

    collection.dataset.rrhsCardsInit = "1";
    collection.classList.add("rrhs-category-cards");

    items.forEach((item, index) => {
      const config = CATEGORY_CARD_MAP[item.id];
      ensureCardVisual(item, config, index);
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
        .rrhs-balanced-hero {
          display: grid !important;
          place-items: center !important;
          min-height: calc(100svh - 96px) !important;
        }

        .rrhs-balanced-hero .ins-tile__wrap,
        .rrhs-balanced-hero .grid-container-item > .flex.relative.flex-col,
        .rrhs-balanced-hero__content {
          width: min(1180px, calc(100vw - 96px)) !important;
          margin-left: auto !important;
          margin-right: auto !important;
          justify-content: center !important;
          transform: none !important;
        }

        .rrhs-balanced-hero .ins-tile__tagline,
        .rrhs-balanced-hero .ins-tile__headline,
        .rrhs-balanced-hero .ins-tile__footer {
          width: min(50%, 540px) !important;
          margin-left: 0 !important;
          margin-right: auto !important;
          text-align: left !important;
        }

        .rrhs-balanced-hero .ins-tile__tagline {
          flex: 0 0 auto !important;
        }

        .rrhs-balanced-hero .ins-tile__background {
          inset: 0 !important;
          width: min(1180px, calc(100vw - 96px)) !important;
          margin-left: auto !important;
          margin-right: auto !important;
          left: 50% !important;
          right: auto !important;
          transform: translateX(-50%) !important;
          pointer-events: none !important;
        }

        .rrhs-balanced-hero .ins-picture,
        .rrhs-balanced-hero .ins-tile__image,
        .rrhs-balanced-hero picture {
          background-position: right center !important;
          background-size: min(44vw, 470px) auto !important;
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
        .rrhs-balanced-hero .ins-tile__wrap,
        .rrhs-balanced-hero .grid-container-item > .flex.relative.flex-col,
        .rrhs-balanced-hero__content,
        .rrhs-balanced-hero .ins-tile__background {
          width: min(1220px, calc(100vw - 112px)) !important;
        }
      }

      @media screen and (max-width: 899px) {
        .rrhs-balanced-hero,
        .rrhs-balanced-hero__content {
          min-height: auto !important;
          transform: none !important;
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
    if (document.querySelector(".rrhs-category-cards")) return false;

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

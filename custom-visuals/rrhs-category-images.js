/* rrhs-category-images.js - sharp category collages + thin card border
 *
 * Ecwid serves category images to the storefront grid at 300x400 (1x) and
 * 600x800 (2x), which looks soft on ~360px-wide cards. This swaps each card's
 * image for the full 1080x1440 collage hosted here, and gives the cards a thin
 * border so the white collages sit cleanly on the page background.
 *
 * To update a collage: replace the file in custom-visuals/category-collages/,
 * bump VERSION, and (optionally) upload it to the Ecwid category as well.
 */
(function () {
  if (window.__rrhsCategoryImagesInstalled) return;
  window.__rrhsCategoryImagesInstalled = true;

  const VERSION = "2";
  const COLLAGES = {
    176456552: "merchandise",
    176829765: "school-supplies",
    196908210: "chick-fil-a",
    207074251: "snacks",
    207074751: "drinks",
    207074752: "accessories",
    209045861: "bars",
    209045862: "soda",
    209045863: "water",
    209045866: "short-sleeves",
    209048120: "chips",
    209048121: "juice",
    209048122: "long-sleeves",
    209048129: "protein-shakes",
    209048239: "clothing",
    209048610: "gum-mints",
    209048611: "energy-drinks",
    209048623: "snacks-drinks"
  };

  const base = (function () {
    try {
      const cur = document.currentScript;
      if (cur && cur.src) return new URL("category-collages/", cur.src).href;
    } catch (e) {}
    return "https://rrhscoop-assets.vercel.app/custom-visuals/category-collages/";
  })();

  function ensureStyles() {
    if (document.getElementById("rrhs-category-image-styles")) return;
    const style = document.createElement("style");
    style.id = "rrhs-category-image-styles";
    // Selectors start with ".ec-size .ec-store" to outrank Ecwid's own rules.
    style.textContent = `
      .ec-size .ec-store .grid__categories .grid-category__wrap-inner {
        transition: transform .3s cubic-bezier(.22, 1, .36, 1), box-shadow .3s ease !important;
      }
      .ec-size .ec-store .grid__categories .grid-category__card {
        position: relative !important;
        overflow: hidden !important;
        background: #fff !important;
      }
      /* Border drawn on top of the image so nothing inside can cover it. */
      .ec-size .ec-store .grid__categories .grid-category__card::after {
        content: "";
        position: absolute;
        inset: 0;
        z-index: 5;
        border: 2px solid #6e1f2a;
        pointer-events: none;
      }
      .ec-size .ec-store .grid__categories .grid-category__bg-color {
        background-color: #fff !important;
      }

      /* Hover: grow the whole card instead of zooming the picture inside it. */
      .ec-size .ec-store .grid__categories .grid-category__wrap-inner:hover .grid-category__bg-image,
      .ec-size .ec-store .grid__categories .grid-category__wrap-inner:hover .grid-category__picture,
      .ec-size .ec-store .grid__categories .grid-category__wrap-inner:hover .grid-category__picture-img {
        transform: none !important;
        filter: none !important;
      }
      .ec-size .ec-store .grid__categories .grid-category__wrap-inner:hover {
        transform: scale(1.03) !important;
        box-shadow: 0 18px 36px rgba(20, 10, 10, .16) !important;
        z-index: 2;
      }
      @media (prefers-reduced-motion: reduce) {
        .ec-size .ec-store .grid__categories .grid-category__wrap-inner { transition: none !important; }
        .ec-size .ec-store .grid__categories .grid-category__wrap-inner:hover { transform: none !important; }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function categoryId(card) {
    const link = card.querySelector("[data-category-id]");
    if (link) return link.getAttribute("data-category-id");
    const m = String(card.className).match(/grid-category--id-(\d+)/);
    return m ? m[1] : null;
  }

  function swap() {
    const cards = document.querySelectorAll("#ecwid-products .grid-category");
    if (!cards.length) return;
    ensureStyles();
    cards.forEach((card) => {
      const slug = COLLAGES[categoryId(card)];
      if (!slug) return;
      const url = `${base}${slug}.jpg?v=${VERSION}`;
      card.querySelectorAll("img.grid-category__picture-img").forEach((img) => {
        if (img.dataset.rrhsCollage === url) return;
        img.dataset.rrhsCollage = url;
        img.removeAttribute("srcset");
        img.src = url;
      });
    });
  }

  const runtime = window.RRHS_RUNTIME;
  if (runtime && typeof runtime.onDomChanged === "function") runtime.onDomChanged(swap);
  else if (typeof MutationObserver !== "undefined") {
    new MutationObserver(swap).observe(document.documentElement, { childList: true, subtree: true });
  }
  swap();
})();

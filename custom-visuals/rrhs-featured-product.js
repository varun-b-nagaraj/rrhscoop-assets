/* rrhs-featured-product.js - sets the product shown in the homepage "New This Week" tile
 *
 * The tile is an Ecwid custom-code block rendering an iframe with srcdoc (same
 * origin as the storefront). This script swaps the product it features, so the
 * featured drop can be changed from this repo by editing FEATURED below.
 */
(function () {
  if (window.__rrhsFeaturedProductInstalled) return;
  window.__rrhsFeaturedProductInstalled = true;

  const FEATURED = {
    name: "Print Paper",
    price: "$0.25",
    url: "https://rrhscoop.roundrockisd.org/products/Print-Paper-p876651487",
    image: "https://d2j6dbq0eux0bg.cloudfront.net/images/104841648/products/876651487/6394103799.png"
  };
  const FRAME_SELECTOR = 'iframe[title="RRHS CO-OP featured product"]';

  function apply(frame) {
    let doc;
    try {
      doc = frame.contentDocument;
    } catch (e) {
      return false;
    }
    const root = doc && doc.querySelector(".product-feature__title");
    if (!root) return false;
    if (doc.documentElement.dataset.rrhsFeatured === FEATURED.url) return true;

    const q = (sel) => doc.querySelector(sel);
    const image = q(".product-feature__image");
    if (image) {
      image.src = FEATURED.image;
      image.alt = FEATURED.name;
    }
    root.textContent = FEATURED.name;
    const price = q(".product-feature__price");
    if (price) price.textContent = FEATURED.price;
    const button = q(".product-feature__button");
    if (button) button.href = FEATURED.url;

    doc.documentElement.dataset.rrhsFeatured = FEATURED.url;
    return true;
  }

  function attach(frame) {
    if (apply(frame)) return;
    if (frame.__rrhsFeaturedLoadBound) return;
    frame.__rrhsFeaturedLoadBound = true;
    frame.addEventListener("load", () => apply(frame));
  }

  function scan() {
    document.querySelectorAll(FRAME_SELECTOR).forEach(attach);
  }

  const runtime = window.RRHS_RUNTIME;
  if (runtime && typeof runtime.onDomChanged === "function") runtime.onDomChanged(scan);
  else if (typeof MutationObserver !== "undefined") {
    new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  }
  scan();
})();

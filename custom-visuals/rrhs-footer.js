/* rrhs-footer.js - branded navigation footer for the RRHS CO-OP storefront */
(function () {
  const FOOTER_SELECTOR = '.ins-tile--footer[tile-type="FOOTER"], section.ins-tile--footer';
  const FOOTER_VERSION = "3";
  const STYLE_ID = "rrhs-editorial-footer-styles-v3";
  const EMAIL = "rrhs_coop_store@roundrockisd.org";

  function assetUrl(file) {
    try {
      const script =
        document.currentScript ||
        document.querySelector('script[src*="custom-visuals/rrhs-footer.js"]');
      return new URL(
        file,
        script && script.src
          ? script.src
          : "https://rrhscoop-assets.vercel.app/custom-visuals/"
      ).href;
    } catch (_) {
      return `https://rrhscoop-assets.vercel.app/custom-visuals/${file}`;
    }
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .ins-tile--footer.rrhs-editorial-footer,
      .ins-tile--footer.rrhs-editorial-footer footer,
      .ins-tile--footer.rrhs-editorial-footer .section__animation,
      .ins-tile--footer.rrhs-editorial-footer .section__container {
        color: #f5eee2 !important;
        background: #65101c !important;
      }

      .ins-tile--footer.rrhs-editorial-footer .section__container {
        display: block !important;
        padding: 0 32px !important;
      }

      .ins-tile--footer.rrhs-editorial-footer .section__content {
        width: min(1360px, 100%) !important;
        max-width: none !important;
        margin: 0 auto !important;
        padding: clamp(54px, 6vw, 82px) 0 30px !important;
        color: #f5eee2 !important;
        font-family: "Spectral", Georgia, serif !important;
      }

      .rrhs-footer-main {
        display: grid;
        grid-template-columns: minmax(240px, 1.25fr) repeat(4, minmax(145px, 1fr));
        gap: clamp(30px, 4vw, 68px);
        align-items: start;
        padding-bottom: clamp(48px, 5vw, 70px);
      }

      .rrhs-footer-brand-lockup {
        display: inline-flex;
        align-items: center;
        gap: 15px;
        color: #fffaf1 !important;
        text-decoration: none !important;
      }

      .rrhs-footer-logo {
        display: block;
        width: 52px;
        height: 60px;
        padding: 5px;
        object-fit: contain;
        background: #f7f0e4;
      }

      .rrhs-footer-wordmark strong {
        display: block;
        color: #fffaf1;
        font-family: "Playfair Display", Georgia, serif;
        font-size: 23px;
        font-weight: 700;
        line-height: 1;
        letter-spacing: .01em;
      }

      .rrhs-footer-wordmark span {
        display: block;
        margin-top: 7px;
        color: rgba(255, 250, 241, .66);
        font-size: 8px;
        font-weight: 500;
        letter-spacing: .28em;
      }

      .rrhs-footer-description {
        max-width: 265px;
        margin: 21px 0 18px;
        color: rgba(245, 238, 226, .72);
        font-size: 15px;
        line-height: 1.62;
      }

      .rrhs-footer-email {
        display: inline-block;
        max-width: 100%;
        overflow-wrap: anywhere;
        color: rgba(255, 250, 241, .88) !important;
        font-size: 14px;
      }

      .rrhs-footer-column h2 {
        margin: 3px 0 21px;
        color: rgba(255, 250, 241, .7);
        font: 600 10px/1.2 "Spectral", Georgia, serif;
        letter-spacing: .23em;
        text-transform: uppercase;
      }

      .rrhs-footer-column nav {
        display: grid;
        gap: 12px;
      }

      .rrhs-footer-link,
      .rrhs-footer-cookie {
        position: relative;
        display: inline-block !important;
        width: fit-content !important;
        max-width: 100%;
        margin: 0 !important;
        padding: 0 0 3px !important;
        border: 0 !important;
        color: rgba(255, 250, 241, .82) !important;
        background: transparent !important;
        font: 400 15px/1.35 "Spectral", Georgia, serif !important;
        text-align: left !important;
        text-decoration: none !important;
        cursor: pointer;
      }

      .rrhs-footer-link::after,
      .rrhs-footer-cookie::after {
        position: absolute;
        right: 0;
        bottom: 0;
        left: 0;
        height: 1px;
        background: #fffaf1;
        content: "";
        transform: scaleX(0);
        transform-origin: right center;
        transition: transform 220ms cubic-bezier(.22, 1, .36, 1);
      }

      .rrhs-footer-link:hover,
      .rrhs-footer-link:focus-visible,
      .rrhs-footer-cookie:hover,
      .rrhs-footer-cookie:focus-visible {
        color: #fff !important;
        outline: none;
      }

      .rrhs-footer-link:hover::after,
      .rrhs-footer-link:focus-visible::after,
      .rrhs-footer-cookie:hover::after,
      .rrhs-footer-cookie:focus-visible::after {
        transform: scaleX(1);
        transform-origin: left center;
      }

      .rrhs-footer-link--parent {
        color: #fffaf1 !important;
        font-weight: 600 !important;
      }

      .rrhs-footer-link--sub {
        margin-left: 12px !important;
        color: rgba(255, 250, 241, .65) !important;
        font-size: 14px !important;
      }

      .rrhs-footer-bottom {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 12px 30px;
        padding-top: 4px;
        color: rgba(245, 238, 226, .55);
        font-size: 11px;
        line-height: 1.5;
        letter-spacing: .015em;
      }

      .rrhs-footer-bottom-right {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 20px;
      }

      .rrhs-footer-bottom a {
        color: inherit !important;
        text-decoration: none !important;
      }

      .rrhs-footer-bottom a:hover,
      .rrhs-footer-bottom a:focus-visible {
        color: #fff !important;
        outline: none;
      }

      @media (max-width: 1080px) {
        .rrhs-footer-main {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        .rrhs-footer-brand {
          grid-column: 1 / -1;
        }
        .rrhs-footer-description {
          max-width: 420px;
        }
      }

      @media (max-width: 720px) {
        .ins-tile--footer.rrhs-editorial-footer .section__container {
          padding: 0 22px !important;
        }
        .rrhs-footer-main {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 40px 28px;
        }
        .rrhs-footer-bottom {
          display: grid;
        }
      }

      @media (max-width: 430px) {
        .rrhs-footer-main {
          grid-template-columns: 1fr;
        }
        .rrhs-footer-brand {
          grid-column: auto;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .rrhs-footer-link::after,
        .rrhs-footer-cookie::after {
          transition: none;
        }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function link(href, label, extraClass) {
    return `<a class="rrhs-footer-link${extraClass ? ` ${extraClass}` : ""}" href="${href}">${label}</a>`;
  }

  function enhanceFooter() {
    const section = document.querySelector(FOOTER_SELECTOR);
    if (!section) return;

    const content = section.querySelector(".section__content");
    if (!content) return;

    const isCurrent =
      content.dataset.rrhsEditorialFooter === FOOTER_VERSION &&
      content.querySelector(".rrhs-footer-main") &&
      content.querySelector(".rrhs-footer-policies");
    if (isCurrent) return;

    const cookieButton = content.querySelector(
      'button.ins-tile__link[aria-label*="cookie" i], button.rrhs-footer-cookie'
    );
    const year = new Date().getFullYear();

    content.dataset.rrhsEditorialFooter = FOOTER_VERSION;
    section.classList.add("rrhs-editorial-footer");
    content.innerHTML = `
      <div class="rrhs-footer-main">
        <section class="rrhs-footer-brand" aria-label="RRHS CO-OP">
          <a class="rrhs-footer-brand-lockup" href="/" aria-label="RRHS CO-OP home">
            <img class="rrhs-footer-logo" src="${assetUrl("rrhs-header-logo.webp?v=18")}" alt="Official RRHS CO-OP water tower logo">
            <span class="rrhs-footer-wordmark"><strong>RRHS CO-OP</strong><span>SCHOOL STORE</span></span>
          </a>
          <p class="rrhs-footer-description">The student-operated store of Round Rock High School.</p>
          <a class="rrhs-footer-link rrhs-footer-email" href="mailto:${EMAIL}">${EMAIL}</a>
        </section>

        <section class="rrhs-footer-column">
          <h2>Snacks &amp; Drinks</h2>
          <nav aria-label="Snack and drink categories">
            ${link("/products/Snacks-c169641499", "Snacks", "rrhs-footer-link--parent")}
            ${link("/products/Chips-c194225502", "Chips", "rrhs-footer-link--sub")}
            ${link("/products/Gum-c194225751", "Gum", "rrhs-footer-link--sub")}
            ${link("/products/Bar-c194226001", "Bars", "rrhs-footer-link--sub")}
            ${link("/products/Drink-c169641959", "Drinks", "rrhs-footer-link--parent")}
            ${link("/products/Soda-c194119752", "Soda", "rrhs-footer-link--sub")}
            ${link("/products/Water-c194120003", "Water", "rrhs-footer-link--sub")}
            ${link("/products/Juice-c194120004", "Juice", "rrhs-footer-link--sub")}
            ${link("/products/Energy-Drinks-c194120005", "Energy Drinks", "rrhs-footer-link--sub")}
          </nav>
        </section>

        <section class="rrhs-footer-column">
          <h2>Shop</h2>
          <nav aria-label="Store categories">
            ${link("/products/Merchandise-c189782257", "Merchandise", "rrhs-footer-link--parent")}
            ${link("/products/T-Shirts-c189782259", "T-Shirts", "rrhs-footer-link--sub")}
            ${link("/products/Long-Sleeves-c189785506", "Long Sleeves", "rrhs-footer-link--sub")}
            ${link("/products/Accessories-c189785755", "Accessories", "rrhs-footer-link--sub")}
            ${link("/products/School-Supplies-c194772751", "School Supplies", "rrhs-footer-link--parent")}
            ${link("/products/Chick-fil-A-c196956751", "Chick-fil-A", "rrhs-footer-link--parent")}
          </nav>
        </section>

        <section class="rrhs-footer-column">
          <h2>Store Info</h2>
          <nav aria-label="Store information">
            ${link("/about", "About the CO-OP")}
            ${link("/leadership", "Current Leadership")}
            ${link("/team-25-26", "2025–26 Leadership")}
            ${link("/student-projects", "Student Projects")}
            ${link("/FAQ", "FAQ")}
            ${link(`mailto:${EMAIL}?subject=Order%20Support`, "Order Support")}
          </nav>
        </section>

        <section class="rrhs-footer-column rrhs-footer-policies">
          <h2>Policies</h2>
          <nav aria-label="Policies and settings">
            ${link("/products/pages/terms", "Terms &amp; Conditions")}
            ${link("/products/pages/privacy-policy", "Privacy Policy")}
            ${link("/products/pages/shipping-payment", "Payment Methods")}
            ${link("/products/pages/returns", "Shipping &amp; Returns")}
            <span class="rrhs-footer-cookie-slot"></span>
            ${link("/report-abuse?lang=en", "Report Abuse")}
          </nav>
        </section>
      </div>

      <div class="rrhs-footer-bottom">
        <span>© ${year} RRHS CO-OP · Round Rock High School</span>
        <span class="rrhs-footer-bottom-right">
          <span>Designed &amp; operated by students.</span>
          <a href="https://www.lightspeedhq.com/?utm_source=instantsite&amp;utm_medium=powered-by-link&amp;utm_campaign=stores" target="_blank" rel="noopener">Powered by Lightspeed</a>
        </span>
      </div>`;

    const cookieSlot = content.querySelector(".rrhs-footer-cookie-slot");
    if (cookieButton && cookieSlot) {
      cookieButton.textContent = "Cookie Settings";
      cookieButton.className = "ins-tile__link rrhs-footer-cookie";
      cookieSlot.replaceWith(cookieButton);
    } else if (cookieSlot) {
      cookieSlot.remove();
    }
  }

  let scheduled = false;
  function boot() {
    scheduled = false;
    ensureStyles();
    enhanceFooter();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(boot);
  }

  schedule();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule, { once: true });
  }
  window.addEventListener("pageshow", schedule);
  window.addEventListener("popstate", schedule);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") schedule();
  });

  if (window.RRHS_RUNTIME && typeof window.RRHS_RUNTIME.onDomChanged === "function") {
    window.RRHS_RUNTIME.onDomChanged(schedule);
  } else {
    new MutationObserver(schedule).observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
}());

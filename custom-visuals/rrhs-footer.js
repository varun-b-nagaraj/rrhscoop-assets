/* rrhs-footer.js - editorial site footer for the RRHS CO-OP storefront */
(function () {
  const FOOTER_SELECTOR = '.ins-tile--footer[tile-type="FOOTER"], section.ins-tile--footer';
  const EMAIL = "rrhs_coop_store@roundrockisd.org";

  function assetUrl(file) {
    try {
      const script =
        document.currentScript ||
        document.querySelector('script[src*="custom-visuals/rrhs-footer.js"]');
      return new URL(file, script && script.src ? script.src : "https://rrhscoop-assets.vercel.app/custom-visuals/").href;
    } catch (_) {
      return `https://rrhscoop-assets.vercel.app/custom-visuals/${file}`;
    }
  }

  function ensureStyles() {
    if (document.getElementById("rrhs-editorial-footer-styles")) return;
    const style = document.createElement("style");
    style.id = "rrhs-editorial-footer-styles";
    style.textContent = `
      .ins-tile--footer.rrhs-editorial-footer,
      .ins-tile--footer.rrhs-editorial-footer footer,
      .ins-tile--footer.rrhs-editorial-footer .section__animation,
      .ins-tile--footer.rrhs-editorial-footer .section__container {
        color: #eee7db !important;
        background: #5b0e18 !important;
      }

      .ins-tile--footer.rrhs-editorial-footer .section__container {
        display: block !important;
        padding: 0 32px !important;
      }

      .ins-tile--footer.rrhs-editorial-footer .section__content {
        width: min(1240px, 100%) !important;
        max-width: none !important;
        margin: 0 auto !important;
        padding: 68px 0 28px !important;
        color: #eee7db !important;
        font-family: "Spectral", Georgia, serif !important;
      }

      .rrhs-footer-main {
        display: grid;
        grid-template-columns: minmax(270px, 1.35fr) repeat(3, minmax(150px, 1fr));
        gap: clamp(44px, 6vw, 92px);
        padding-bottom: 62px;
      }

      .rrhs-footer-brand-lockup {
        display: inline-flex;
        align-items: center;
        gap: 15px;
        color: #f7f0e4 !important;
        text-decoration: none !important;
      }

      .rrhs-footer-logo {
        width: 25px;
        height: 36px;
        object-fit: contain;
        filter: brightness(0) invert(1);
      }

      .rrhs-footer-wordmark strong {
        display: block;
        color: #f7f0e4;
        font-family: "Playfair Display", Georgia, serif;
        font-size: 23px;
        font-weight: 700;
        line-height: 1;
        letter-spacing: .01em;
      }

      .rrhs-footer-wordmark span {
        display: block;
        margin-top: 7px;
        color: rgba(247, 240, 228, .68);
        font-size: 8px;
        font-weight: 500;
        letter-spacing: .28em;
      }

      .rrhs-footer-description {
        max-width: 290px;
        margin: 20px 0 23px;
        color: rgba(238, 231, 219, .72);
        font-size: 16px;
        line-height: 1.62;
      }

      .rrhs-footer-quick-actions { display: flex; gap: 10px; }
      .rrhs-footer-icon-link {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        border: 1px solid rgba(238, 231, 219, .25);
        color: #f7f0e4 !important;
        background: transparent;
        text-decoration: none !important;
        transition: color .18s ease, background .18s ease, border-color .18s ease;
      }
      .rrhs-footer-icon-link:hover,
      .rrhs-footer-icon-link:focus-visible {
        color: #6e1f2a !important;
        border-color: #eee7db;
        background: #eee7db;
        outline: none;
      }
      .rrhs-footer-icon-link svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.6; }

      .rrhs-footer-column h2 {
        margin: 2px 0 22px;
        color: rgba(247, 240, 228, .72);
        font-family: "Spectral", Georgia, serif;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: .22em;
        text-transform: uppercase;
      }

      .rrhs-footer-column nav { display: grid; gap: 14px; }
      .rrhs-footer-column a {
        width: fit-content;
        color: rgba(247, 240, 228, .88) !important;
        font-size: 16px;
        line-height: 1.35;
        text-decoration: none !important;
        transition: color .18s ease;
      }
      .rrhs-footer-column a:hover,
      .rrhs-footer-column a:focus-visible {
        color: #fff !important;
        text-decoration: underline !important;
        text-decoration-thickness: 1px !important;
        text-underline-offset: 5px !important;
        outline: none;
      }

      .rrhs-footer-tagline {
        padding: 26px 18px;
        border-top: 1px solid rgba(238, 231, 219, .22);
        border-bottom: 1px solid rgba(238, 231, 219, .13);
        color: #f7f0e4;
        font-family: "Playfair Display", Georgia, serif;
        font-size: 16px;
        text-align: center;
      }

      .rrhs-footer-meta {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        padding: 27px 0 18px;
        color: rgba(238, 231, 219, .62);
        font-size: 12px;
        letter-spacing: .015em;
      }

      .rrhs-footer-legal {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px 18px;
        padding-top: 16px;
        border-top: 1px solid rgba(238, 231, 219, .1);
      }
      .rrhs-footer-legal a,
      .rrhs-footer-legal button {
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        color: rgba(238, 231, 219, .5) !important;
        background: transparent !important;
        font: 500 10px/1.4 "Spectral", Georgia, serif !important;
        text-decoration: none !important;
        cursor: pointer;
      }
      .rrhs-footer-legal a:hover,
      .rrhs-footer-legal button:hover,
      .rrhs-footer-legal a:focus-visible,
      .rrhs-footer-legal button:focus-visible { color: #fff !important; outline: none; }

      @media (max-width: 900px) {
        .rrhs-footer-main { grid-template-columns: 1.3fr repeat(2, 1fr); }
        .rrhs-footer-support { grid-column: 2 / 4; }
      }

      @media (max-width: 640px) {
        .ins-tile--footer.rrhs-editorial-footer .section__container { padding: 0 22px !important; }
        .ins-tile--footer.rrhs-editorial-footer .section__content { padding-top: 48px !important; }
        .rrhs-footer-main { grid-template-columns: repeat(2, 1fr); gap: 42px 26px; padding-bottom: 44px; }
        .rrhs-footer-brand { grid-column: 1 / -1; }
        .rrhs-footer-support { grid-column: auto; }
        .rrhs-footer-description { max-width: 360px; }
        .rrhs-footer-meta { display: grid; gap: 7px; }
      }

      @media (max-width: 420px) {
        .rrhs-footer-main { grid-template-columns: 1fr; }
        .rrhs-footer-brand, .rrhs-footer-support { grid-column: auto; }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function enhanceFooter() {
    const section = document.querySelector(FOOTER_SELECTOR);
    if (!section) return;
    const content = section.querySelector(".section__content");
    if (!content || content.dataset.rrhsEditorialFooter === "1") return;

    const cookieButton = content.querySelector('button.ins-tile__link[aria-label*="cookie" i]');
    const year = new Date().getFullYear();
    content.dataset.rrhsEditorialFooter = "1";
    section.classList.add("rrhs-editorial-footer");
    content.innerHTML = `
      <div class="rrhs-footer-main">
        <section class="rrhs-footer-brand" aria-label="RRHS CO-OP">
          <a class="rrhs-footer-brand-lockup" href="/" aria-label="RRHS CO-OP home">
            <img class="rrhs-footer-logo" src="${assetUrl("rrhs-header-logo.webp?v=18")}" alt="">
            <span class="rrhs-footer-wordmark"><strong>RRHS CO-OP</strong><span>SCHOOL STORE</span></span>
          </a>
          <p class="rrhs-footer-description">The official Round Rock High School student store — designed, managed, and delivered by students.</p>
          <div class="rrhs-footer-quick-actions">
            <a class="rrhs-footer-icon-link" href="mailto:${EMAIL}" aria-label="Email the RRHS CO-OP">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14"></rect><path d="m4 7 8 6 8-6"></path></svg>
            </a>
            <a class="rrhs-footer-icon-link" href="/about#visit" aria-label="Visit the RRHS CO-OP">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>
            </a>
          </div>
        </section>

        <section class="rrhs-footer-column">
          <h2>Shop</h2>
          <nav aria-label="Footer shop links">
            <a href="/products/Merchandise-c189782257">Merchandise</a>
            <a href="/products/Merchandise-c189782257">T-Shirts</a>
            <a href="/products/Merchandise-c189782257">Hoodies &amp; Crews</a>
            <a href="/products/Merchandise-c189782257">Accessories</a>
            <a href="/products/Food-c169641499">Snacks &amp; Drinks</a>
            <a href="/products/Chick-fil-A-c196956751">Chick-fil-A</a>
          </nav>
        </section>

        <section class="rrhs-footer-column">
          <h2>CO-OP</h2>
          <nav aria-label="Footer CO-OP links">
            <a href="/about">About Us</a>
            <a href="/student-projects">Student Projects</a>
            <a href="/leadership">Meet the Leadership</a>
            <a href="/about#visit">Visit &amp; Hours</a>
            <a href="/FAQ">FAQ</a>
          </nav>
        </section>

        <section class="rrhs-footer-column rrhs-footer-support">
          <h2>Support</h2>
          <nav aria-label="Footer support links">
            <a href="mailto:${EMAIL}?subject=Order%20Support">Order Support</a>
            <a href="mailto:${EMAIL}">${EMAIL}</a>
            <a href="/FAQ">Pickup &amp; Delivery</a>
            <a href="/products/pages/returns">Returns &amp; Exchanges</a>
            <a href="/products/pages/privacy-policy">Privacy &amp; Terms</a>
          </nav>
        </section>
      </div>

      <div class="rrhs-footer-tagline">• RRHS CO-OP • Your Official RRHS Student Store •</div>
      <div class="rrhs-footer-meta"><span>© ${year} RRHS CO-OP · Round Rock High School</span><span>Designed &amp; operated by students.</span></div>
      <div class="rrhs-footer-legal" aria-label="Legal and site information">
        <a href="/products/pages/terms">Terms</a>
        <a href="/products/pages/privacy-policy">Privacy Policy</a>
        <a href="/products/pages/shipping-payment">Payment Methods</a>
        <a href="/products/pages/returns">Shipping &amp; Returns</a>
        <a href="/report-abuse?lang=en" target="_blank" rel="noopener">Report Abuse</a>
        <a href="https://www.lightspeedhq.com/?utm_source=instantsite&amp;utm_medium=powered-by-link&amp;utm_campaign=stores" target="_blank" rel="noopener">Powered by Lightspeed</a>
      </div>`;

    if (cookieButton) {
      cookieButton.textContent = "Cookie Settings";
      cookieButton.classList.add("rrhs-footer-cookie");
      content.querySelector(".rrhs-footer-legal").insertBefore(cookieButton, content.querySelector('.rrhs-footer-legal a[href="/report-abuse?lang=en"]'));
    }
  }

  function boot() {
    ensureStyles();
    enhanceFooter();
  }

  const schedule = () => requestAnimationFrame(boot);
  schedule();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
}());

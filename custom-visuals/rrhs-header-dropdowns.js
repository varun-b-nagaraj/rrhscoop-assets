/* Keep header navigation links square while leaving the site in control of the menu. */
(function () {
  const STYLE_ID = "rrhs-square-header-nav-links";

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .ins-header .ins-header__menu-link-title,
      .ins-header .ins-header__dropdown-wrap,
      .ins-header .ins-header__dropdown-bg,
      .ins-header .ins-header__dropdown-inner,
      .ins-header .ins-header__dropdown-link,
      .ins-header .ins-header__dropdown-link-wrapper,
      .ins-header .ins-header__dropdown-link-title {
        border-radius: 0 !important;
      }

      .ins-header .ins-header__dropdown-link-title {
        transition:
          background-color 180ms ease,
          color 180ms ease !important;
      }

      .ins-header .ins-header__dropdown-link-title:hover,
      .ins-header .ins-header__dropdown-link-title:focus-visible,
      .ins-header .ins-header__dropdown-link-title--active {
        color: #7d2836 !important;
        background-color: #f1ede3 !important;
        box-shadow: none !important;
        transform: none !important;
      }

      @media (prefers-reduced-motion: reduce) {
        .ins-header .ins-header__dropdown-link-title {
          transition: none !important;
        }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  ensureStyles();
}());

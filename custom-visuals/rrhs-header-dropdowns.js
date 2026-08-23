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
        transform: translateX(0) !important;
        transition:
          transform 180ms cubic-bezier(.22, .61, .36, 1),
          box-shadow 180ms cubic-bezier(.22, .61, .36, 1),
          background-color 180ms ease,
          color 180ms ease !important;
      }

      .ins-header .ins-header__dropdown-link-title:hover,
      .ins-header .ins-header__dropdown-link-title:focus-visible,
      .ins-header .ins-header__dropdown-link-title--active {
        box-shadow: inset 3px 0 0 currentColor !important;
        transform: translateX(3px) !important;
      }

      @media (prefers-reduced-motion: reduce) {
        .ins-header .ins-header__dropdown-link-title {
          transition: none !important;
        }

        .ins-header .ins-header__dropdown-link-title:hover,
        .ins-header .ins-header__dropdown-link-title:focus-visible,
        .ins-header .ins-header__dropdown-link-title--active {
          transform: none !important;
        }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  ensureStyles();
}());

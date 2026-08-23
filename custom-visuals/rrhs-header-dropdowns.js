/* Keep header navigation links square while leaving the site in control of the menu. */
(function () {
  const STYLE_ID = "rrhs-square-header-nav-links";

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .ins-header .ins-header__menu-link-title,
      .ins-header .ins-header__dropdown-link,
      .ins-header .ins-header__dropdown-link-wrapper,
      .ins-header .ins-header__dropdown-link-title {
        border-radius: 0 !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  ensureStyles();
}());

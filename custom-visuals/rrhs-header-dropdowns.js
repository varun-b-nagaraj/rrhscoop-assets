/* rrhs-header-dropdowns.js - global RRHS CO-OP header dropdown enhancer */
(function () {
  const STYLE_ID = "rrhs-global-header-dropdown-styles";
  const INIT_ATTR = "data-rrhs-dropdown-init";
  const PANEL_CLASS = "rrhs-header-dropdown";
  const OPEN_CLASS = "rrhs-header-menu-link--open";
  const MOBILE_OPEN_CLASS = "rrhs-header-menu-link--mobile-open";
  const MOBILE_QUERY = "(max-width: 980px)";

  const MENU_DATA = {
    "food & drink": [
      { label: "Shop Food & Drink", href: "/" },
      { label: "Snacks", href: "/products/Food-c169641499" },
      { label: "Drinks", href: "/products/Drink-c169641959" },
      { label: "Chick-fil-A", href: "/products/Chick-fil-A-c196956751" }
    ],
    "apparel & accessories": [
      { label: "Shop Apparel & Accessories", href: "/products/Merchandise-c189782257" },
      { label: "Merchandise", href: "/products/Merchandise-c189782257" }
    ],
    "store info": [
      { label: "Leadership", href: "/leadership" },
      { label: "Student Projects", href: "/projects" },
      { label: "FAQ", href: "/faq" },
      { label: "About Us", href: "/products/pages/about" },
      { label: "Terms & Conditions", href: "/products/pages/terms" },
      { label: "Privacy Policy", href: "/products/pages/privacy-policy" },
      { label: "Payment Methods", href: "/products/pages/shipping-payment" },
      { label: "Shipping & Returns", href: "/products/pages/returns" }
    ]
  };

  function normalizeLabel(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      :root {
        --rrhs-nav-maroon: #6e1f2a;
        --rrhs-nav-dark: #141414;
        --rrhs-nav-light: #faf8f4;
        --rrhs-nav-alt: #ebebe2;
        --rrhs-nav-border: rgba(20,20,20,0.12);
        --rrhs-nav-dur: 260ms;
        --rrhs-nav-ease: cubic-bezier(.22,.61,.36,1);
      }

      .ins-header__menu-wrap .ins-header__menu-inner {
        display: flex !important;
        align-items: center !important;
        gap: clamp(18px, 2.2vw, 32px) !important;
      }

      .ins-header__menu-wrap .ins-header__menu-link {
        position: relative !important;
        padding-bottom: 4px !important;
        outline: 0 !important;
      }

      .ins-header__menu-wrap .ins-header__menu-link-title {
        position: relative !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 6px !important;
        padding: 10px 2px !important;
        color: var(--rrhs-nav-dark) !important;
        font-family: var(--rrhs-font-title, Raleway, Arial, sans-serif) !important;
        font-size: 13px !important;
        font-weight: 700 !important;
        line-height: 1.2 !important;
        letter-spacing: .08em !important;
        text-decoration: none !important;
        text-transform: uppercase !important;
        transition: color var(--rrhs-nav-dur) var(--rrhs-nav-ease) !important;
      }

      .ins-header__menu-wrap .ins-header__menu-link-title::after {
        content: "" !important;
        position: absolute !important;
        right: 0 !important;
        bottom: 2px !important;
        left: 0 !important;
        height: 2px !important;
        background: var(--rrhs-nav-maroon) !important;
        transform: scaleX(0) !important;
        transform-origin: left !important;
        transition: transform var(--rrhs-nav-dur) var(--rrhs-nav-ease) !important;
      }

      .ins-header__menu-wrap .ins-header__menu-link:hover > .ins-header__menu-link-title,
      .ins-header__menu-wrap .ins-header__menu-link:focus-within > .ins-header__menu-link-title,
      .ins-header__menu-wrap .rrhs-header-menu-link--open > .ins-header__menu-link-title,
      .ins-header__menu-wrap .rrhs-header-menu-link--mobile-open > .ins-header__menu-link-title {
        color: var(--rrhs-nav-maroon) !important;
      }

      .ins-header__menu-wrap .ins-header__menu-link:hover > .ins-header__menu-link-title::after,
      .ins-header__menu-wrap .ins-header__menu-link:focus-within > .ins-header__menu-link-title::after,
      .ins-header__menu-wrap .rrhs-header-menu-link--open > .ins-header__menu-link-title::after,
      .ins-header__menu-wrap .rrhs-header-menu-link--mobile-open > .ins-header__menu-link-title::after {
        transform: scaleX(1) !important;
      }

      .ins-header__menu-wrap .ins-header__menu-link-icon {
        width: 9px !important;
        height: 9px !important;
        opacity: .7 !important;
        background: none !important;
        transform: none !important;
        transition: transform var(--rrhs-nav-dur) var(--rrhs-nav-ease), opacity var(--rrhs-nav-dur) var(--rrhs-nav-ease) !important;
      }

      .ins-header__menu-wrap .ins-header__menu-link-icon::before {
        content: "" !important;
        display: block !important;
        width: 9px !important;
        height: 9px !important;
        border-right: 1.5px solid currentColor !important;
        border-bottom: 1.5px solid currentColor !important;
        transform: translateY(-2px) rotate(45deg) !important;
      }

      .ins-header__menu-wrap .ins-header__menu-link:hover .ins-header__menu-link-icon,
      .ins-header__menu-wrap .ins-header__menu-link:focus-within .ins-header__menu-link-icon,
      .ins-header__menu-wrap .rrhs-header-menu-link--open .ins-header__menu-link-icon,
      .ins-header__menu-wrap .rrhs-header-menu-link--mobile-open .ins-header__menu-link-icon {
        opacity: 1 !important;
        transform: rotate(180deg) !important;
      }

      .ins-header__menu-wrap .${PANEL_CLASS} {
        position: absolute !important;
        z-index: 1100 !important;
        top: calc(100% + 14px) !important;
        left: 50% !important;
        min-width: 220px !important;
        padding: 16px !important;
        border: 1px solid var(--rrhs-nav-border) !important;
        background: var(--rrhs-nav-light) !important;
        box-shadow: 0 18px 40px rgba(20,20,20,.08) !important;
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
        transform: translateX(-50%) translateY(6px) !important;
        transition:
          opacity var(--rrhs-nav-dur) var(--rrhs-nav-ease),
          transform var(--rrhs-nav-dur) var(--rrhs-nav-ease),
          visibility var(--rrhs-nav-dur) !important;
      }

      .ins-header__menu-wrap .${PANEL_CLASS}::before {
        content: "" !important;
        position: absolute !important;
        right: 0 !important;
        left: 0 !important;
        top: -16px !important;
        height: 16px !important;
      }

      .ins-header__menu-wrap .ins-header__menu-link:hover > .${PANEL_CLASS},
      .ins-header__menu-wrap .ins-header__menu-link:focus-within > .${PANEL_CLASS},
      .ins-header__menu-wrap .rrhs-header-menu-link--open > .${PANEL_CLASS} {
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        transform: translateX(-50%) translateY(0) !important;
      }

      .ins-header__menu-wrap .${PANEL_CLASS} a {
        display: block !important;
        min-height: 40px !important;
        padding: 11px 14px !important;
        color: var(--rrhs-nav-dark) !important;
        background: transparent !important;
        border-radius: 2px !important;
        font-family: var(--rrhs-font-title, Raleway, Arial, sans-serif) !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        line-height: 1.25 !important;
        text-decoration: none !important;
        transition:
          background var(--rrhs-nav-dur),
          color var(--rrhs-nav-dur),
          padding-left var(--rrhs-nav-dur) !important;
      }

      .ins-header__menu-wrap .${PANEL_CLASS} a:hover,
      .ins-header__menu-wrap .${PANEL_CLASS} a:focus-visible {
        color: var(--rrhs-nav-maroon) !important;
        background: var(--rrhs-nav-alt) !important;
        outline: 0 !important;
        padding-left: 18px !important;
      }

      @media screen and (max-width: 980px) {
        .ins-header__menu-wrap .ins-header__menu-inner {
          align-items: stretch !important;
          gap: 0 !important;
        }

        .ins-header__menu-wrap .ins-header__menu-link {
          width: 100% !important;
          padding-bottom: 0 !important;
          border-bottom: 1px solid var(--rrhs-nav-border) !important;
        }

        .ins-header__menu-wrap .ins-header__menu-link-title {
          width: 100% !important;
          justify-content: space-between !important;
          padding: 20px 0 !important;
        }

        .ins-header__menu-wrap .${PANEL_CLASS} {
          position: static !important;
          min-width: 0 !important;
          max-height: 0 !important;
          overflow: hidden !important;
          padding: 0 !important;
          border: 0 !important;
          box-shadow: none !important;
          opacity: 1 !important;
          visibility: visible !important;
          pointer-events: none !important;
          transform: none !important;
          transition: max-height var(--rrhs-nav-dur) var(--rrhs-nav-ease), padding-bottom var(--rrhs-nav-dur) var(--rrhs-nav-ease) !important;
        }

        .ins-header__menu-wrap .${PANEL_CLASS}::before {
          display: none !important;
        }

        .ins-header__menu-wrap .ins-header__menu-link:hover > .${PANEL_CLASS},
        .ins-header__menu-wrap .ins-header__menu-link:focus-within > .${PANEL_CLASS} {
          transform: none !important;
        }

        .ins-header__menu-wrap .rrhs-header-menu-link--mobile-open > .${PANEL_CLASS} {
          max-height: 520px !important;
          padding-bottom: 16px !important;
          pointer-events: auto !important;
        }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function findExistingPanel(link) {
    const direct = Array.from(link.children).find((child) => {
      if (!child || !child.classList) return false;
      if (child.classList.contains(PANEL_CLASS)) return true;
      return /submenu|dropdown|sub-menu|menu-dropdown/i.test(child.className);
    });
    if (direct) return direct;
    return null;
  }

  function createPanel(items) {
    const panel = document.createElement("div");
    panel.className = PANEL_CLASS;
    panel.setAttribute("role", "menu");
    items.forEach((item) => {
      const anchor = document.createElement("a");
      anchor.href = item.href;
      anchor.target = "_self";
      anchor.textContent = item.label;
      anchor.setAttribute("role", "menuitem");
      panel.appendChild(anchor);
    });
    return panel;
  }

  function closeOtherLinks(activeLink) {
    document.querySelectorAll(`.ins-header__menu-link.${OPEN_CLASS}, .ins-header__menu-link.${MOBILE_OPEN_CLASS}`).forEach((link) => {
      if (link === activeLink) return;
      link.classList.remove(OPEN_CLASS, MOBILE_OPEN_CLASS);
      const title = link.querySelector(".ins-header__menu-link-title");
      if (title) title.setAttribute("aria-expanded", "false");
    });
  }

  function enhanceLink(link) {
    if (!link || link.getAttribute(INIT_ATTR) === "1") return;

    const title = link.querySelector(":scope > .ins-header__menu-link-title");
    if (!title) return;

    const label = normalizeLabel(title.getAttribute("aria-label") || title.textContent);
    const data = MENU_DATA[label];
    let panel = findExistingPanel(link);

    if (!panel && data) {
      panel = createPanel(data);
      link.appendChild(panel);
    }
    if (!panel) return;

    panel.classList.add(PANEL_CLASS);
    if (!panel.id) panel.id = `rrhs-header-dropdown-${label.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "menu"}`;
    title.setAttribute("aria-haspopup", "true");
    title.setAttribute("aria-expanded", "false");
    title.setAttribute("aria-controls", panel.id);

    link.addEventListener("mouseenter", () => {
      if (window.matchMedia(MOBILE_QUERY).matches) return;
      closeOtherLinks(link);
      link.classList.add(OPEN_CLASS);
      title.setAttribute("aria-expanded", "true");
    });

    link.addEventListener("mouseleave", () => {
      if (window.matchMedia(MOBILE_QUERY).matches) return;
      link.classList.remove(OPEN_CLASS);
      title.setAttribute("aria-expanded", "false");
    });

    link.addEventListener("focusin", () => {
      if (window.matchMedia(MOBILE_QUERY).matches) return;
      closeOtherLinks(link);
      link.classList.add(OPEN_CLASS);
      title.setAttribute("aria-expanded", "true");
    });

    link.addEventListener("focusout", (event) => {
      if (window.matchMedia(MOBILE_QUERY).matches) return;
      if (link.contains(event.relatedTarget)) return;
      link.classList.remove(OPEN_CLASS);
      title.setAttribute("aria-expanded", "false");
    });

    title.addEventListener("click", (event) => {
      if (!window.matchMedia(MOBILE_QUERY).matches) return;
      event.preventDefault();
      const nextOpen = !link.classList.contains(MOBILE_OPEN_CLASS);
      closeOtherLinks(link);
      link.classList.toggle(MOBILE_OPEN_CLASS, nextOpen);
      title.setAttribute("aria-expanded", String(nextOpen));
    });

    title.addEventListener("keydown", (event) => {
      if (!["ArrowDown", "Enter", " "].includes(event.key)) return;
      event.preventDefault();
      closeOtherLinks(link);
      const openClass = window.matchMedia(MOBILE_QUERY).matches ? MOBILE_OPEN_CLASS : OPEN_CLASS;
      link.classList.add(openClass);
      title.setAttribute("aria-expanded", "true");
      const firstItem = panel.querySelector("a, button, [tabindex]:not([tabindex='-1'])");
      if (firstItem) firstItem.focus();
    });

    panel.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      link.classList.remove(OPEN_CLASS, MOBILE_OPEN_CLASS);
      title.setAttribute("aria-expanded", "false");
      title.focus();
    });

    link.setAttribute(INIT_ATTR, "1");
  }

  function initHeaderDropdowns() {
    ensureStyles();
    document.querySelectorAll(".ins-header__menu-wrap .ins-header__menu-link").forEach(enhanceLink);
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest(".ins-header__menu-link")) return;
    closeOtherLinks(null);
  });

  const schedule = () => requestAnimationFrame(initHeaderDropdowns);

  if (window.RRHS_RUNTIME && typeof window.RRHS_RUNTIME.onDomChanged === "function") {
    window.RRHS_RUNTIME.onDomChanged(schedule, { runNow: true });
  } else {
    schedule();
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule);
    const observer = new MutationObserver(schedule);
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  }
}());

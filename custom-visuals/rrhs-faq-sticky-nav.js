/* rrhs-faq-sticky-nav.js - keeps FAQ topic navigation visible across iframe scrolling */
(function () {
  const STYLE_ID = "rrhs-faq-host-nav-styles";
  const NAV_ID = "rrhs-faq-sticky-nav";
  const FRAME_SELECTOR = "iframe[src*='/iframes/faq']";
  const FAQ_FRAME_VERSION = "8";
  const TOP_OFFSET = 72;
  const topics = [
    ["faq", "All topics", "46"],
    ["group-top", "Top Questions", "5"],
    ["group-about", "About the CO-OP", "5"],
    ["group-shopping", "Shopping & Products", "5"],
    ["group-ordering", "Ordering", "6"],
    ["group-pickup", "Pickup & Delivery", "5"],
    ["group-payments", "Payments", "5"],
    ["group-returns", "Returns & Problems", "5"],
    ["group-students", "Students & Projects", "5"],
    ["group-privacy", "Privacy & Website", "5"],
    ["contact", "Still need help?", "↓"]
  ];

  let frame = null;
  let nav = null;
  let navHost = null;
  let metrics = null;
  let ticking = false;
  let hostNavEnabled = null;

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${NAV_ID} {
        position: absolute !important;
        z-index: 2147482500 !important;
        top: var(--rrhs-faq-nav-top, 0px) !important;
        left: max(32px, calc((100vw - 1240px) / 2)) !important;
        width: 250px !important;
        box-sizing: border-box !important;
        padding: 18px !important;
        border: 1px solid rgba(36,26,23,.14) !important;
        border-radius: 0 !important;
        color: #241a17 !important;
        background: #fbf8f2 !important;
        box-shadow: none !important;
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
        transform: none !important;
        transition: none !important;
      }
      #${NAV_ID}.is-ready {
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
      }
      #${NAV_ID}.is-fixed {
        position: fixed !important;
        top: ${TOP_OFFSET}px !important;
        max-height: calc(100vh - ${TOP_OFFSET + 24}px) !important;
        overflow: auto !important;
      }
      #${NAV_ID} p {
        margin: 0 0 14px !important;
        color: #4d111c !important;
        font: 700 10px/1.2 "DM Sans", Arial, sans-serif !important;
        letter-spacing: .13em !important;
        text-transform: uppercase !important;
      }
      #${NAV_ID} button {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        gap: 12px !important;
        width: 100% !important;
        min-height: 39px !important;
        margin: 0 !important;
        padding: 9px 10px !important;
        border: 0 !important;
        border-radius: 0 !important;
        color: #70635e !important;
        background: transparent !important;
        box-shadow: none !important;
        font: 700 12px/1.2 "DM Sans", Arial, sans-serif !important;
        text-align: left !important;
        text-transform: none !important;
        cursor: pointer !important;
        transition: color .2s ease, background .2s ease, padding-left .2s ease !important;
      }
      #${NAV_ID} .rrhs-faq-host-filter-list {
        display: grid !important;
        gap: 7px !important;
      }
      #${NAV_ID} .rrhs-faq-host-filter-list button:hover {
        color: #6e1f2a !important;
        background: #ebe6da !important;
        padding-left: 14px !important;
      }
      #${NAV_ID} .rrhs-faq-host-filter-list button.is-active {
        color: #fff !important;
        background: #6e1f2a !important;
      }
      #${NAV_ID} .rrhs-faq-host-contact {
        margin-top: 18px !important;
        padding-top: 16px !important;
        border-top: 1px solid rgba(36,26,23,.14) !important;
      }
      #${NAV_ID} .rrhs-faq-host-contact button {
        display: inline-flex !important;
        min-height: 0 !important;
        padding: 0 !important;
        color: #6e1f2a !important;
        background: transparent !important;
        font-size: 11px !important;
        letter-spacing: .08em !important;
        text-transform: uppercase !important;
      }
      #${NAV_ID} .rrhs-faq-host-contact button:hover {
        color: #4d111c !important;
      }
      @media (max-width: 920px) {
        #${NAV_ID} { display: none !important; }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function createNav() {
    const element = document.createElement("nav");
    element.id = NAV_ID;
    element.dataset.rrhsFaqHostOwned = "1";
    element.setAttribute("aria-label", "FAQ quick navigation");
    const host = frame && frame.parentElement ? frame.parentElement : document.body;
    host.insertBefore(element, frame || null);
    return element;
  }

  function populateNav(element) {
    const filters = topics.slice(0, -1);
    const contact = topics[topics.length - 1];
    element.innerHTML = `<p>Browse by topic</p><div class="rrhs-faq-host-filter-list">${filters.map(([target, label, count], index) => `
      <button type="button" data-target="${target}"${index === 0 ? ' class="is-active"' : ""}>
        <span>${label}</span><span>${count}</span>
      </button>
    `).join("")}</div><div class="rrhs-faq-host-contact">
      <button type="button" data-target="${contact[0]}"><span>${contact[1]}</span><span>${contact[2]}</span></button>
    </div>`;
  }

  function setIframeMenuHidden(hidden) {
    if (!frame || !frame.contentWindow || hidden === hostNavEnabled) return;
    hostNavEnabled = hidden;
    frame.contentWindow.postMessage({ type: "rrhs-faq-host-nav-active", active: hidden }, "*");
    frame.contentWindow.postMessage({ type: "rrhs-faq-sticky-active", active: hidden }, "*");
  }

  function updatePosition() {
    ticking = false;
    if (!frame || !nav || !metrics) return;
    const mobile = window.matchMedia("(max-width: 920px)").matches;
    setIframeMenuHidden(!mobile);
    if (mobile) {
      nav.classList.remove("is-ready", "is-fixed");
      return;
    }

    const frameRect = frame.getBoundingClientRect();
    const hostRect = (navHost || frame.parentElement || document.body).getBoundingClientRect();
    const stickyStart = Number(metrics.stickyStart || metrics.faqTop || 0);
    const contactTop = Number(metrics.contactTop || metrics.height || frameRect.height);
    const navHeight = nav.offsetHeight;
    const startInViewport = frameRect.top + stickyStart;
    const endInViewport = frameRect.top + contactTop;
    const startInHost = frameRect.top - hostRect.top + stickyStart;
    const endInHost = frameRect.top - hostRect.top + contactTop - navHeight - 24;

    if (startInViewport <= TOP_OFFSET && endInViewport > TOP_OFFSET + navHeight + 24) {
      nav.classList.add("is-fixed");
    } else {
      nav.classList.remove("is-fixed");
      nav.style.setProperty("--rrhs-faq-nav-top", `${Math.max(0, endInViewport <= TOP_OFFSET + navHeight + 24 ? endInHost : startInHost)}px`);
    }
    nav.classList.add("is-ready");
  }

  function schedulePosition() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(updatePosition);
  }

  function bindNav() {
    if (!nav || nav.dataset.rrhsFaqHostBound === "1") return;
    nav.dataset.rrhsFaqHostBound = "1";
    nav.querySelectorAll("button[data-target]").forEach((button) => {
      button.addEventListener("click", () => {
        nav.querySelectorAll("button[data-target]").forEach((other) => other.classList.remove("is-active"));
        button.classList.add("is-active");
        if (frame && frame.contentWindow) {
          frame.contentWindow.postMessage({ type: "rrhs-faq-scroll-to-id", id: button.dataset.target }, "*");
        }
      });
    });
  }

  function init() {
    const nextFrame = document.querySelector(FRAME_SELECTOR);
    if (!nextFrame) return;
    frame = nextFrame;
    try {
      const frameUrl = new URL(frame.src, window.location.href);
      if (frameUrl.searchParams.get("v") !== FAQ_FRAME_VERSION) {
        frameUrl.searchParams.set("v", FAQ_FRAME_VERSION);
        frame.src = frameUrl.href;
      }
    } catch (_) {}
    ensureStyles();
    const existingNav = document.getElementById(NAV_ID);
    if (existingNav && existingNav.dataset.rrhsFaqHostOwned !== "1") {
      nav = existingNav.cloneNode(true);
      nav.dataset.rrhsFaqHostOwned = "1";
      existingNav.replaceWith(nav);
    } else {
      nav = existingNav || createNav();
    }
    navHost = frame.parentElement || document.body;
    if (nav.parentElement !== navHost) navHost.insertBefore(nav, frame);
    if (nav.dataset.rrhsFaqHostMarkup !== "1") {
      populateNav(nav);
      nav.dataset.rrhsFaqHostMarkup = "1";
    }
    if (getComputedStyle(navHost).position === "static") navHost.style.position = "relative";
    bindNav();
    if (frame.dataset.rrhsFaqHostBound !== "1") {
      frame.dataset.rrhsFaqHostBound = "1";
      frame.addEventListener("load", () => {
        metrics = null;
        hostNavEnabled = null;
        frame.contentWindow.postMessage({ type: "rrhs-faq-request-height" }, "*");
      });
    }
    frame.contentWindow.postMessage({ type: "rrhs-faq-request-height" }, "*");
    schedulePosition();
  }

  window.addEventListener("message", (event) => {
    if (!frame || event.source !== frame.contentWindow || !event.data) return;
    if (event.data.type === "rrhs-faq-metrics") {
      metrics = event.data;
      schedulePosition();
    }
  });
  window.addEventListener("scroll", schedulePosition, { passive: true });
  window.addEventListener("resize", schedulePosition);

  const scheduleInit = () => requestAnimationFrame(init);
  scheduleInit();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scheduleInit);
  new MutationObserver(scheduleInit).observe(document.documentElement, { childList: true, subtree: true });
}());

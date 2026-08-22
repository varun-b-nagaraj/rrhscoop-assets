/* rrhs-faq-sticky-nav.js - keeps FAQ topic navigation visible across iframe scrolling */
(function () {
  const STYLE_ID = "rrhs-faq-host-nav-styles";
  const NAV_ID = "rrhs-faq-sticky-nav";
  const FRAME_SELECTOR = "iframe[src*='/iframes/faq']";
  const TOP_OFFSET = 112;
  const topics = [
    ["faq", "All topics", "45"],
    ["group-top", "Top Questions", "5"],
    ["group-about", "About the CO-OP", "5"],
    ["group-shopping", "Shopping & Products", "5"],
    ["group-ordering", "Ordering", "5"],
    ["group-pickup", "Pickup & Delivery", "5"],
    ["group-payments", "Payments", "5"],
    ["group-returns", "Returns & Problems", "5"],
    ["group-students", "Students & Projects", "5"],
    ["group-privacy", "Privacy & Website", "5"],
    ["contact", "Still need help?", "↓"]
  ];

  let frame = null;
  let nav = null;
  let metrics = null;
  let ticking = false;
  let stickyActive = false;

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${NAV_ID} {
        position: fixed !important;
        z-index: 2147482500 !important;
        top: ${TOP_OFFSET}px !important;
        left: max(32px, calc((100vw - 1240px) / 2)) !important;
        width: 250px !important;
        max-height: calc(100vh - ${TOP_OFFSET + 24}px) !important;
        overflow: auto !important;
        box-sizing: border-box !important;
        padding: 18px !important;
        border: 1px solid rgba(36,26,23,.14) !important;
        border-radius: 0 !important;
        color: #241a17 !important;
        background: #fbf8f2 !important;
        box-shadow: 0 12px 30px rgba(36,26,23,.07) !important;
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
        transform: translateY(8px) !important;
        transition: opacity .18s ease, transform .18s ease, visibility .18s ease !important;
      }
      #${NAV_ID}.is-visible {
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        transform: translateY(0) !important;
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
      }
      #${NAV_ID} button:hover,
      #${NAV_ID} button.is-active {
        color: #fff !important;
        background: #4d111c !important;
      }
      #${NAV_ID} button[data-target="contact"] {
        margin-top: 16px !important;
        padding-top: 16px !important;
        border-top: 1px solid rgba(36,26,23,.14) !important;
        color: #4d111c !important;
      }
      #${NAV_ID} button[data-target="contact"]:hover,
      #${NAV_ID} button[data-target="contact"].is-active {
        color: #fff !important;
        border-top-color: #4d111c !important;
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
    element.innerHTML = `<p>Browse by topic</p>${topics.map(([target, label, count], index) => `
      <button type="button" data-target="${target}"${index === 0 ? ' class="is-active"' : ""}>
        <span>${label}</span><span>${count}</span>
      </button>
    `).join("")}`;
    document.body.appendChild(element);
    return element;
  }

  function updateVisibility() {
    ticking = false;
    if (!frame || !nav || !metrics) return;
    const rect = frame.getBoundingClientRect();
    const start = rect.top + Number(metrics.stickyStart || metrics.faqTop || 0);
    const end = rect.top + Number(metrics.contactTop || metrics.height || rect.height);
    const visible = !window.matchMedia("(max-width: 920px)").matches &&
      start <= TOP_OFFSET && end > TOP_OFFSET + nav.offsetHeight + 24;
    nav.classList.toggle("is-visible", visible);
    if (visible !== stickyActive) {
      stickyActive = visible;
      frame.contentWindow.postMessage({ type: "rrhs-faq-sticky-active", active: visible }, "*");
    }
  }

  function scheduleVisibility() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(updateVisibility);
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
    ensureStyles();
    const existingNav = document.getElementById(NAV_ID);
    if (existingNav && existingNav.dataset.rrhsFaqHostOwned !== "1") {
      nav = existingNav.cloneNode(true);
      nav.dataset.rrhsFaqHostOwned = "1";
      existingNav.replaceWith(nav);
    } else {
      nav = existingNav || createNav();
    }
    bindNav();
    if (frame.dataset.rrhsFaqHostBound !== "1") {
      frame.dataset.rrhsFaqHostBound = "1";
      frame.addEventListener("load", () => {
        metrics = null;
        stickyActive = false;
        frame.contentWindow.postMessage({ type: "rrhs-faq-request-height" }, "*");
      });
    }
    frame.contentWindow.postMessage({ type: "rrhs-faq-request-height" }, "*");
    scheduleVisibility();
  }

  window.addEventListener("message", (event) => {
    if (!frame || event.source !== frame.contentWindow || !event.data) return;
    if (event.data.type === "rrhs-faq-height" && !metrics) {
      const height = Number(event.data.height || frame.offsetHeight || 6200);
      metrics = {
        height,
        stickyStart: Math.min(760, height * .12),
        contactTop: Math.max(0, height - 900)
      };
      scheduleVisibility();
    }
    if (event.data.type === "rrhs-faq-metrics") {
      metrics = event.data;
      scheduleVisibility();
    }
  });
  window.addEventListener("scroll", scheduleVisibility, { passive: true });
  window.addEventListener("resize", scheduleVisibility);

  const scheduleInit = () => requestAnimationFrame(init);
  scheduleInit();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scheduleInit);
  new MutationObserver(scheduleInit).observe(document.documentElement, { childList: true, subtree: true });
}());

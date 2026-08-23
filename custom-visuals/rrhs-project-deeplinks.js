/* rrhs-project-deeplinks.js - connects homepage project cards to exact case studies */
(function () {
  const CARD_PROJECTS = {
    "systems behind the store": "digital-commerce",
    "planning the experience": "retail-redesign",
    "solving real constraints": "cafeteria-kiosk"
  };
  const FRAME_SELECTOR = "iframe[src*='/iframes/projects']";
  const PROJECT_FRAME_VERSION = "4";

  function requestedProject() {
    const url = new URL(window.location.href);
    return url.searchParams.get("project") || new URLSearchParams(url.hash.replace(/^#/, "")).get("project") || "";
  }

  function enhanceHomepageCards() {
    document.querySelectorAll("a.project-card").forEach((card) => {
      const heading = card.querySelector("h3");
      const key = heading ? heading.textContent.replace(/\s+/g, " ").trim().toLowerCase() : "";
      const projectId = CARD_PROJECTS[key];
      if (!projectId) return;
      try {
        const url = new URL(card.href, window.location.href);
        url.searchParams.set("project", projectId);
        card.href = url.href;
        card.dataset.rrhsProjectLink = projectId;
      } catch (_) {}
    });
  }

  function connectProjectsFrame() {
    const projectId = requestedProject();
    if (!projectId) return;
    const frame = document.querySelector(FRAME_SELECTOR);
    if (!frame) return;

    let url;
    try {
      url = new URL(frame.src, window.location.href);
    } catch (_) {
      return;
    }

    const needsReload = url.searchParams.get("project") !== projectId || url.searchParams.get("v") !== PROJECT_FRAME_VERSION;
    if (needsReload) {
      url.searchParams.set("v", PROJECT_FRAME_VERSION);
      url.searchParams.set("project", projectId);
      frame.src = url.href;
    }

    if (frame.dataset.rrhsProjectDeepLinkBound !== "1") {
      frame.dataset.rrhsProjectDeepLinkBound = "1";
      frame.addEventListener("load", () => {
        frame.contentWindow.postMessage({ type: "rrhs-projects-open-id", id: requestedProject() }, "*");
      });
    }

    frame.contentWindow.postMessage({ type: "rrhs-projects-open-id", id: projectId }, "*");
  }

  function init() {
    enhanceHomepageCards();
    connectProjectsFrame();
  }

  const schedule = () => requestAnimationFrame(init);
  schedule();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
}());

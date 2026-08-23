/* rrhs-project-deeplinks.js - connects homepage project cards to exact case studies */
(function () {
  const CARD_PROJECTS = {
    "systems behind the store": "digital-commerce",
    "planning the experience": "retail-redesign",
    "solving real constraints": "cafeteria-kiosk"
  };
  const FRAME_SELECTOR = "iframe[src*='/iframes/projects']";
  const PROJECT_FRAME_VERSION = "7";

  function ensureProjectModalStyles() {
    if (document.getElementById("rrhs-project-modal-bridge-styles")) return;
    const style = document.createElement("style");
    style.id = "rrhs-project-modal-bridge-styles";
    style.textContent = `
      #rrhs-project-modal, #rrhs-project-modal * { box-sizing: border-box; }
      #rrhs-project-modal {
        position: fixed; inset: 0; z-index: 2147483000; display: flex;
        align-items: center; justify-content: center; padding: 28px;
        visibility: hidden; opacity: 0; overflow: auto;
        background: rgba(24, 15, 13, .72); transition: opacity .2s ease, visibility .2s ease;
      }
      #rrhs-project-modal.is-open { visibility: visible; opacity: 1; }
      #rrhs-project-modal .rpm-panel {
        position: relative; display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr);
        width: min(1080px, 100%); max-height: calc(100vh - 56px); overflow: auto;
        color: #241a17; background: #fffdf8; box-shadow: 0 28px 90px rgba(20, 9, 7, .35);
      }
      #rrhs-project-modal .rpm-close {
        position: absolute; top: 15px; right: 15px; z-index: 2; width: 42px; height: 42px;
        border: 1px solid rgba(110, 31, 42, .22); border-radius: 0; color: #6e1f2a;
        background: #fffdf8; font: 28px/1 Georgia, serif; cursor: pointer;
      }
      #rrhs-project-modal .rpm-close:hover { color: #fff; background: #8a2d3c; }
      #rrhs-project-modal .rpm-visual { position: sticky; top: 0; min-height: 680px; background: #4d111c; }
      #rrhs-project-modal .rpm-visual img { display: block; width: 100%; height: 100%; min-height: 680px; object-fit: cover; }
      #rrhs-project-modal .rpm-content { padding: 55px 52px 50px; font-family: "Spectral", Georgia, serif; }
      #rrhs-project-modal .rpm-kicker { margin: 0 0 14px; color: #6e1f2a; font-size: 10px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase; }
      #rrhs-project-modal h2 { margin: 0 45px 18px 0; font-family: "Playfair Display", Georgia, serif; font-size: clamp(40px, 4.2vw, 62px); font-weight: 600; line-height: .96; letter-spacing: -.035em; }
      #rrhs-project-modal .rpm-summary { margin: 0 0 27px; color: #6f625d; font-size: 17px; line-height: 1.65; }
      #rrhs-project-modal .rpm-credit { margin: 0 0 25px; padding: 15px 17px; border-left: 3px solid #6e1f2a; background: #f3ecdf; font-size: 12px; font-weight: 700; line-height: 1.55; }
      #rrhs-project-modal .rpm-metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px; margin: 0 0 28px; border: 1px solid rgba(36, 26, 23, .13); background: rgba(36, 26, 23, .13); }
      #rrhs-project-modal .rpm-metric { padding: 16px; background: #fff; }
      #rrhs-project-modal .rpm-metric strong { display: block; margin-bottom: 3px; color: #6e1f2a; font-family: "Playfair Display", Georgia, serif; font-size: 29px; }
      #rrhs-project-modal .rpm-metric span { color: #6f625d; font-size: 9px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
      #rrhs-project-modal h3 { margin: 27px 0 12px; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; }
      #rrhs-project-modal .rpm-overview { margin: 0; color: #6f625d; font-size: 13px; line-height: 1.72; }
      #rrhs-project-modal ul { margin: 0; padding: 0; list-style: none; border-top: 1px solid rgba(36, 26, 23, .13); }
      #rrhs-project-modal li { position: relative; padding: 11px 0 11px 20px; border-bottom: 1px solid rgba(36, 26, 23, .13); color: #554844; font-size: 12px; line-height: 1.55; }
      #rrhs-project-modal li::before { content: "→"; position: absolute; left: 0; color: #6e1f2a; }
      #rrhs-project-modal .rpm-tags { display: flex; flex-wrap: wrap; gap: 7px; }
      #rrhs-project-modal .rpm-tag { padding: 7px 10px; border: 1px solid rgba(110, 31, 42, .2); color: #6e1f2a; font-size: 9px; font-weight: 700; }
      @media (max-width: 720px) {
        #rrhs-project-modal { align-items: flex-end; padding: 10px; }
        #rrhs-project-modal .rpm-panel { display: block; max-height: calc(100vh - 20px); }
        #rrhs-project-modal .rpm-visual, #rrhs-project-modal .rpm-visual img { position: relative; height: 230px; min-height: 230px; }
        #rrhs-project-modal .rpm-content { padding: 30px 23px 34px; }
        #rrhs-project-modal h2 { font-size: 39px; }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function fillList(container, values, className) {
    container.textContent = "";
    (values || []).forEach((value) => {
      const element = document.createElement(className === "rpm-tag" ? "span" : "li");
      element.className = className || "";
      element.textContent = value;
      container.appendChild(element);
    });
  }

  function ensureProjectModal() {
    ensureProjectModalStyles();
    let modal = document.getElementById("rrhs-project-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "rrhs-project-modal";
      modal.setAttribute("aria-hidden", "true");
      modal.innerHTML = `
        <section class="rpm-panel" role="dialog" aria-modal="true" aria-labelledby="rpm-title">
          <button class="rpm-close" type="button" aria-label="Close project details">×</button>
          <div class="rpm-visual"><img src="" alt=""></div>
          <div class="rpm-content">
            <p class="rpm-kicker"></p><h2 id="rpm-title"></h2><p class="rpm-summary"></p>
            <p class="rpm-credit" hidden></p><div class="rpm-metrics" hidden></div>
            <h3>Project overview</h3><p class="rpm-overview"></p>
            <h3>What students built</h3><ul class="rpm-highlights"></ul>
            <h3>Skills &amp; systems</h3><div class="rpm-tags"></div>
          </div>
        </section>`;
      document.body.appendChild(modal);
    }

    if (modal.dataset.rrhsProjectBridgeBound !== "1") {
      modal.dataset.rrhsProjectBridgeBound = "1";
      const close = () => {
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        document.documentElement.style.overflow = modal.dataset.previousOverflow || "";
      };
      modal.querySelector(".rpm-close").addEventListener("click", close);
      modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && modal.classList.contains("is-open")) close();
      });
    }
    return modal;
  }

  function openProjectModal(project) {
    if (!project) return;
    const modal = ensureProjectModal();
    const image = modal.querySelector(".rpm-visual img");
    image.src = project.image || "";
    image.alt = project.imageAlt || "";
    modal.querySelector(".rpm-kicker").textContent = [project.category, project.status].filter(Boolean).join(" · ");
    modal.querySelector("#rpm-title").textContent = project.title || "Student project";
    modal.querySelector(".rpm-summary").textContent = project.summary || "";
    modal.querySelector(".rpm-overview").textContent = project.overview || "";

    const credit = modal.querySelector(".rpm-credit");
    credit.hidden = !project.credits;
    credit.textContent = project.credits || "";

    const metrics = modal.querySelector(".rpm-metrics");
    metrics.textContent = "";
    metrics.hidden = !project.metrics || !project.metrics.length;
    (project.metrics || []).forEach((metric) => {
      const block = document.createElement("div");
      block.className = "rpm-metric";
      const value = document.createElement("strong");
      const label = document.createElement("span");
      value.textContent = metric.value;
      label.textContent = metric.label;
      block.append(value, label);
      metrics.appendChild(block);
    });

    fillList(modal.querySelector(".rpm-highlights"), project.highlights, "");
    fillList(modal.querySelector(".rpm-tags"), project.tags, "rpm-tag");
    modal.dataset.previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    window.setTimeout(() => modal.querySelector(".rpm-close").focus(), 20);
  }

  function connectProjectModalBridge() {
    const frame = document.querySelector(FRAME_SELECTOR);
    if (!frame || frame.dataset.rrhsProjectModalBridge === "1") return;
    frame.dataset.rrhsProjectModalBridge = "1";
    window.addEventListener("message", (event) => {
      if (event.source !== frame.contentWindow || !event.data) return;
      if (event.data.type === "rrhs-project-open" && event.data.project) {
        openProjectModal(event.data.project);
      }
      if (event.data.type === "rrhs-projects-navigate" && event.data.href) {
        try {
          const destination = new URL(event.data.href, window.location.href);
          if (destination.protocol === "http:" || destination.protocol === "https:") {
            window.location.assign(destination.href);
          }
        } catch (_) {}
      }
    });
  }

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
    const frame = document.querySelector(FRAME_SELECTOR);
    if (!frame) return;

    let url;
    try {
      url = new URL(frame.src, window.location.href);
    } catch (_) {
      return;
    }

    const needsReload =
      url.searchParams.get("v") !== PROJECT_FRAME_VERSION ||
      (projectId && url.searchParams.get("project") !== projectId);
    if (needsReload) {
      url.searchParams.set("v", PROJECT_FRAME_VERSION);
      if (projectId) url.searchParams.set("project", projectId);
      frame.src = url.href;
    }

    if (projectId && frame.dataset.rrhsProjectDeepLinkBound !== "1") {
      frame.dataset.rrhsProjectDeepLinkBound = "1";
      frame.addEventListener("load", () => {
        frame.contentWindow.postMessage({ type: "rrhs-projects-open-id", id: requestedProject() }, "*");
      });
    }

    if (projectId) frame.contentWindow.postMessage({ type: "rrhs-projects-open-id", id: projectId }, "*");
  }

  function init() {
    enhanceHomepageCards();
    connectProjectsFrame();
    connectProjectModalBridge();
  }

  const schedule = () => requestAnimationFrame(init);
  schedule();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
}());

// rrhscoop-assistant.js - Enhanced with Animated Product Links
(() => {
  if (window.__RRHS_ASSISTANT__) return;
  window.__RRHS_ASSISTANT__ = true;

  const DEFAULT_CONFIG = {
    apiUrl: "https://v2-chatbot.vercel.app/chat",
    apiKey: "",
    apiKeyHeader: "Authorization",
    apiKeyPrefix: "Bearer "
  };
  const CONFIG = Object.assign({}, DEFAULT_CONFIG, window.RRHS_ASSISTANT_CONFIG || {});
  const API_URL = CONFIG.apiUrl;
  const API_KEY = CONFIG.apiKey;
  const API_KEY_HEADER = CONFIG.apiKeyHeader || "Authorization";
  const API_KEY_PREFIX = CONFIG.apiKeyPrefix == null ? "Bearer " : String(CONFIG.apiKeyPrefix);
  const SEND_SESSION_ID = CONFIG.sendSessionId === true;
  const CART_ACTIONS_ENABLED = CONFIG.cartActionsEnabled !== false;
  const REQUEST_STREAM = CONFIG.stream !== false && !/\/chat-tools(?:\/)?$/i.test(API_URL);
  const Z = 2147483647;
  const PING_URLS = Array.isArray(CONFIG.pingUrls)
    ? CONFIG.pingUrls.filter(Boolean)
    : [];
  const PING_INTERVAL_MS = 5 * 60 * 1000;

  function init() {
    if (!document.body) {
      setTimeout(init, 50);
      return;
    }

    // ---------- ENHANCED STYLES WITH ANIMATED PRODUCT LINKS ----------
    const style = document.createElement("style");
    style.id = "rrhs-assistant-styles";
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');

      @keyframes rrhs-fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      #rrhs-assistant-panel {
        --rrhs-collapsed-width: 150px;
        --rrhs-collapsed-height: 38px;
        --rrhs-expanded-width: 340px;
        --rrhs-expanded-height: 480px;
        --rrhs-duration: 420ms;
        --rrhs-ease: cubic-bezier(0.22, 1, 0.36, 1);
        position: fixed !important;
        right: 18px !important;
        bottom: 18px !important;
        width: var(--rrhs-collapsed-width) !important;
        height: var(--rrhs-collapsed-height) !important;
        z-index: ${Z} !important;
        background: #670000 !important;
        border: 1px solid transparent !important;
        border-radius: 999px !important;
        box-shadow: 0 6px 16px rgba(0,0,0,.18) !important;
        overflow: hidden !important;
        font-family: "Poppins", system-ui, -apple-system, sans-serif !important;
        box-sizing: border-box !important;
        transform: translateY(0) !important;
        transition:
          width var(--rrhs-duration) var(--rrhs-ease),
          height var(--rrhs-duration) var(--rrhs-ease),
          border-radius var(--rrhs-duration) var(--rrhs-ease),
          background-color var(--rrhs-duration) var(--rrhs-ease),
          border-color var(--rrhs-duration) var(--rrhs-ease),
          box-shadow var(--rrhs-duration) var(--rrhs-ease),
          transform 0.2s ease !important;
        will-change: width, height, border-radius, background-color, border-color, box-shadow, transform !important;
        cursor: pointer !important;
      }

      #rrhs-assistant-panel:hover:not(.rrhs-expanded) {
        background: #7a0000 !important;
        box-shadow: 0 10px 24px rgba(0,0,0,.25) !important;
        transform: translateY(-2px) !important;
      }

      #rrhs-assistant-panel.rrhs-expanded {
        width: var(--rrhs-expanded-width) !important;
        height: var(--rrhs-expanded-height) !important;
        background: #FFFFFF !important;
        border: none !important;
        border-radius: 14px !important;
        box-shadow: 0 12px 30px rgba(0,0,0,.18) !important;
        cursor: default !important;
        transform: translateY(0) !important;
      }

      #rrhs-pill-label {
        position: absolute !important;
        inset: 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        color: #F9F9F9 !important;
        transition: opacity 0.2s ease, transform 0.2s ease !important;
      }

      #rrhs-pill-text {
        padding: 10px 14px !important;
        font-size: 13px !important;
        font-weight: 600 !important;
        letter-spacing: 0.2px !important;
        white-space: nowrap !important;
        user-select: none !important;
      }

      #rrhs-assistant-panel.rrhs-expanded #rrhs-pill-label {
        opacity: 0 !important;
        transform: scale(0.98) !important;
        pointer-events: none !important;
      }

      #rrhs-panel-body {
        position: absolute !important;
        inset: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        height: 100% !important;
        min-height: 0 !important;
        width: 100% !important;
        opacity: 0 !important;
        pointer-events: none !important;
        transition: opacity 0.2s ease !important;
      }

      #rrhs-assistant-panel.rrhs-expanded #rrhs-panel-body {
        opacity: 1 !important;
        pointer-events: auto !important;
        transition-delay: 0.12s !important;
      }

      #rrhs-assistant-header {
        background: #670000 !important;
        color: #F9F9F9 !important;
        padding: 14px 16px !important;
        font-weight: 600 !important;
        font-size: 15px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        flex-shrink: 0 !important;
      }
      
      #rrhs-close {
        cursor: pointer !important;
        font-size: 22px !important;
        line-height: 1 !important;
        padding: 4px 8px !important;
        border-radius: 6px !important;
        background: transparent !important;
        border: none !important;
        color: #F9F9F9 !important;
        transition: all 0.2s ease !important;
      }
      #rrhs-close:hover {
        background: rgba(255,255,255,.15) !important;
      }

      #rrhs-messages {
        flex: 1 !important;
        min-height: 0 !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        padding: 14px !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 10px !important;
        scroll-behavior: smooth !important;
      }
      
      .rrhs-msg {
        max-width: 80% !important;
        display: inline-flex !important;
        flex-direction: column !important;
        padding: 10px 12px !important;
        border-radius: 12px !important;
        font-size: 13px !important;
        line-height: 1.55 !important;
        height: auto !important;
        min-height: fit-content !important;
        overflow: visible !important;
        overflow-wrap: break-word !important;
        word-break: break-word !important;
        box-sizing: border-box !important;
        animation: rrhs-fadeIn 0.2s ease-out !important;
      }

      .rrhs-msg-content {
        position: relative !important;
        white-space: pre-wrap !important;
        overflow-wrap: break-word !important;
        word-break: break-word !important;
      }

      .rrhs-bot .rrhs-msg-content strong {
        font-weight: 800 !important;
      }
      
      .rrhs-user {
        align-self: flex-end !important;
        background: #670000 !important;
        color: #F9F9F9 !important;
      }
      
      .rrhs-bot {
        align-self: flex-start !important;
        background: #FFFFFF !important;
        color: #1F1F1F !important;
        border: 1px solid rgba(0,0,0,.06) !important;
      }
      
      .rrhs-bot.rrhs-streaming {
        opacity: 0.95 !important;
      }
      
      .rrhs-product-link {
        color: #670000 !important;
        text-decoration: underline !important;
        text-decoration-color: #670000 !important;
        text-decoration-thickness: 2px !important;
        text-underline-offset: 3px !important;
        font-weight: 600 !important;
        transition: color 0.2s ease !important;
        display: inline-block !important;
        padding-bottom: 1px !important;
        text-decoration-skip-ink: auto !important;
      }

      .rrhs-product-link:hover {
        color: #7a0000 !important;
      }

      .rrhs-typing-indicator {
        display: flex !important;
        gap: 4px !important;
        padding: 8px 0 !important;
      }
      
      .rrhs-typing-dot {
        width: 8px !important;
        height: 8px !important;
        background: #670000 !important;
        border-radius: 50% !important;
        animation: rrhs-typing 1.4s infinite !important;
      }
      
      .rrhs-typing-dot:nth-child(2) {
        animation-delay: 0.2s !important;
      }
      
      .rrhs-typing-dot:nth-child(3) {
        animation-delay: 0.4s !important;
      }
      
      @keyframes rrhs-typing {
        0%, 60%, 100% {
          transform: translateY(0);
          opacity: 0.7;
        }
        30% {
          transform: translateY(-10px);
          opacity: 1;
        }
      }

      #rrhs-input-row {
        display: flex !important;
        gap: 10px !important;
        padding: 12px !important;
        border-top: 1px solid rgba(0,0,0,.08) !important;
        flex-shrink: 0 !important;
      }
      
      #rrhs-input {
        flex: 1 !important;
        padding: 10px 12px !important;
        border: 1px solid rgba(0,0,0,.18) !important;
        border-radius: 12px !important;
        font-size: 13px !important;
        outline: none !important;
        font-family: "Poppins", system-ui, -apple-system, sans-serif !important;
        transition: all 0.2s ease !important;
      }
      #rrhs-input:focus {
        border-color: #670000 !important;
        box-shadow: 0 0 0 3px rgba(103,0,0,.12) !important;
      }
      
      #rrhs-send {
        background: #670000 !important;
        color: #F9F9F9 !important;
        border: none !important;
        padding: 10px 18px !important;
        border-radius: 12px !important;
        font-size: 13px !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        font-family: "Poppins", system-ui, -apple-system, sans-serif !important;
        transition: all 0.2s ease !important;
      }
      #rrhs-send:hover:not(:disabled) {
        background: #7a0000 !important;
        transform: translateY(-1px) !important;
        box-shadow: 0 6px 14px rgba(103,0,0,.22) !important;
      }
      #rrhs-send:active:not(:disabled) {
        transform: translateY(0) !important;
      }
      #rrhs-send:disabled {
        opacity: .6 !important;
        cursor: not-allowed !important;
      }
      
      /* Smooth scroll behavior for messages */
      #rrhs-messages::-webkit-scrollbar {
        width: 6px !important;
      }
      
      #rrhs-messages::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.05) !important;
        border-radius: 3px !important;
      }
      
      #rrhs-messages::-webkit-scrollbar-thumb {
        background: rgba(103, 0, 0, 0.3) !important;
        border-radius: 3px !important;
      }
      
      #rrhs-messages::-webkit-scrollbar-thumb:hover {
        background: rgba(103, 0, 0, 0.5) !important;
      }

      #rrhs-retry-toast {
        position: fixed !important;
        right: 18px !important;
        bottom: 84px !important;
        max-width: 320px !important;
        background: #FFFFFF !important;
        color: #1F1F1F !important;
        border: 1px solid rgba(0,0,0,.1) !important;
        border-radius: 12px !important;
        box-shadow: 0 10px 26px rgba(0,0,0,.2) !important;
        padding: 12px 14px !important;
        display: flex !important;
        gap: 10px !important;
        align-items: center !important;
        z-index: ${Z} !important;
        font-family: "Poppins", system-ui, -apple-system, sans-serif !important;
      }

      #rrhs-retry-toast p {
        margin: 0 !important;
        font-size: 12px !important;
        line-height: 1.4 !important;
        flex: 1 !important;
      }

      #rrhs-retry-toast button {
        border: none !important;
        background: #670000 !important;
        color: #F9F9F9 !important;
        padding: 6px 10px !important;
        border-radius: 8px !important;
        font-size: 12px !important;
        font-weight: 600 !important;
        cursor: pointer !important;
      }

      #rrhs-retry-toast button:hover {
        background: #7a0000 !important;
      }

      #rrhs-retry-close {
        background: transparent !important;
        color: #1F1F1F !important;
        padding: 0 4px !important;
        font-size: 16px !important;
        line-height: 1 !important;
        cursor: pointer !important;
      }

      #rrhs-assistant-nudge {
        position: fixed !important;
        right: 176px !important;
        bottom: 22px !important;
        background: #FFFFFF !important;
        color: #670000 !important;
        border: 1px solid rgba(103,0,0,.25) !important;
        border-radius: 999px !important;
        box-shadow: 0 10px 24px rgba(0,0,0,.18) !important;
        padding: 8px 12px !important;
        font-size: 12px !important;
        font-weight: 700 !important;
        font-family: "Poppins", system-ui, -apple-system, sans-serif !important;
        letter-spacing: 0.2px !important;
        z-index: ${Z} !important;
        cursor: pointer !important;
        user-select: none !important;
        opacity: 0 !important;
        transform: translateY(6px) scale(0.98) !important;
        transition: opacity 180ms ease, transform 180ms ease !important;
      }

      #rrhs-assistant-nudge.rrhs-visible {
        opacity: 1 !important;
        transform: translateY(0) scale(1) !important;
      }

      #rrhs-assistant-nudge::after {
        content: "" !important;
        position: absolute !important;
        right: -7px !important;
        top: 50% !important;
        transform: translateY(-50%) rotate(45deg) !important;
        width: 12px !important;
        height: 12px !important;
        background: #FFFFFF !important;
        border-top: 1px solid rgba(103,0,0,.25) !important;
        border-right: 1px solid rgba(103,0,0,.25) !important;
      }
    `;
    document.head.appendChild(style);

    // ---------- CREATE ELEMENTS ----------
    const panel = document.createElement("div");
    panel.id = "rrhs-assistant-panel";
    panel.className = "";
    
    panel.innerHTML = `
      <div id="rrhs-pill-label"><span id="rrhs-pill-text">Ask the Store</span></div>
      <div id="rrhs-panel-body">
        <div id="rrhs-assistant-header">
          <div>Store Assistant</div>
          <button id="rrhs-close" type="button">×</button>
        </div>
        <div id="rrhs-messages"></div>
        <div id="rrhs-input-row">
          <input id="rrhs-input" type="text" placeholder="What should I buy?" autocomplete="off" />
          <button id="rrhs-send" type="button">Send</button>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    const messagesEl = document.getElementById("rrhs-messages");
    const inputEl = document.getElementById("rrhs-input");
    const sendBtn = document.getElementById("rrhs-send");
    const closeBtn = document.getElementById("rrhs-close");
    const pillLabel = document.getElementById("rrhs-pill-label");
    const pillText = document.getElementById("rrhs-pill-text");
    const STORAGE_KEY = "rrhs_assistant_chat_log_v1";
    const SESSION_ID_KEY = "rrhs_assistant_session_id_v1";
    const PENDING_KEY = "rrhs_assistant_pending_v1";
    const PRODUCT_INFO_KEY = "rrhs_assistant_product_info_v1";
    const NUDGE_KEY = "rrhs_assistant_nudge_seen_v1";
    let sessionLog = [];
    let pendingChoice = null;
    let productInfoCache = null;
    let storageWarned = false;
    let lastUserMessage = "";
    let retryToastEl = null;
    let nudgeEl = null;
    let nudgeHideTimer = null;
    let isNewConversationCall = true;

    function getStorageTarget() {
      const candidates = [];
      if (window.top && window.top !== window) {
        candidates.push({ label: "top-session", get: () => window.top.sessionStorage });
      }
      candidates.push({ label: "self-session", get: () => window.sessionStorage });

      for (const candidate of candidates) {
        try {
          const storage = candidate.get();
          if (!storage) continue;
          const testKey = "__rrhs_storage_test__";
          storage.setItem(testKey, "1");
          storage.removeItem(testKey);
          return { storage, label: candidate.label };
        } catch (e) {
          // Try next candidate
        }
      }
      return { storage: null, label: "unavailable" };
    }

    const storageTarget = getStorageTarget();
    const storageRef = storageTarget.storage;
    if (storageTarget.label !== "unavailable") {
      window.__RRHS_STORAGE_TARGET__ = storageTarget.label;
      console.log("[RRHS Assistant] Storage target:", storageTarget.label);
    } else {
      console.warn("[RRHS Assistant] Storage unavailable; chat history won't persist.");
    }
    const sessionId = (() => {
      if (!SEND_SESSION_ID) return null;
      if (!storageRef) return `rrhs_${Math.random().toString(36).slice(2)}_${Date.now()}`;
      try {
        const existing = storageRef.getItem(SESSION_ID_KEY);
        if (existing) return existing;
        const generated = (typeof crypto !== "undefined" && crypto.randomUUID)
          ? crypto.randomUUID()
          : `rrhs_${Math.random().toString(36).slice(2)}_${Date.now()}`;
        storageRef.setItem(SESSION_ID_KEY, generated);
        return generated;
      } catch (e) {
        return `rrhs_${Math.random().toString(36).slice(2)}_${Date.now()}`;
      }
    })();

    function pingEndpoints() {
      PING_URLS.forEach((url) => {
        try {
          fetch(url, {
            method: "GET",
            mode: "no-cors",
            cache: "no-store",
            keepalive: true
          }).catch(() => {});
        } catch (e) {
          // Ignore ping errors
        }
      });
    }

    function schedulePings() {
      if (window.__RRHS_PING_TIMER__) return;
      pingEndpoints();
      const runtime = window.RRHS_RUNTIME;
      if (runtime && typeof runtime.every === "function") {
        // Use shared interval if available (fewer timers overall).
        window.__RRHS_PING_TIMER__ = runtime.every(PING_INTERVAL_MS, pingEndpoints);
      } else {
        window.__RRHS_PING_TIMER__ = setInterval(pingEndpoints, PING_INTERVAL_MS);
      }
    }

    schedulePings();

    function wasNudgeSeen() {
      try {
        if (!storageRef) return false;
        return storageRef.getItem(NUDGE_KEY) === "1";
      } catch (e) {
        return false;
      }
    }

    function markNudgeSeen() {
      try {
        if (!storageRef) return;
        storageRef.setItem(NUDGE_KEY, "1");
      } catch (e) {
        // Ignore storage failures.
      }
    }

    function hideNudge() {
      if (nudgeHideTimer) {
        clearTimeout(nudgeHideTimer);
        nudgeHideTimer = null;
      }
      if (!nudgeEl) return;
      nudgeEl.remove();
      nudgeEl = null;
    }

    function showNudge() {
      if (panel.classList.contains("rrhs-expanded")) return;
      if (wasNudgeSeen()) return;
      if (nudgeEl) return;

      nudgeEl = document.createElement("button");
      nudgeEl.id = "rrhs-assistant-nudge";
      nudgeEl.type = "button";
      nudgeEl.textContent = "Check me out";
      nudgeEl.setAttribute("aria-label", "Open store assistant");
      nudgeEl.addEventListener("click", () => {
        markNudgeSeen();
        hideNudge();
        openPanel();
      });
      document.body.appendChild(nudgeEl);

      requestAnimationFrame(() => {
        if (nudgeEl) nudgeEl.classList.add("rrhs-visible");
      });

      nudgeHideTimer = setTimeout(() => {
        hideNudge();
      }, 8000);
    }

    // ---------- PANEL STATE ----------
    const PANEL_DURATION = 420;

    function prefersReducedMotion() {
      return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    function applyMotionPreference() {
      panel.style.setProperty("--rrhs-duration", prefersReducedMotion() ? "0ms" : `${PANEL_DURATION}ms`);
    }

    function updatePanelSizes() {
      if (!pillText) return;
      const collapsedWidth = Math.ceil(pillText.scrollWidth) + 2;
      const collapsedHeight = Math.ceil(pillText.scrollHeight) + 2;
      const maxWidth = Math.max(0, window.innerWidth - 36);
      const maxHeight = Math.max(0, window.innerHeight - 36);
      const expandedWidth = Math.max(collapsedWidth, Math.min(340, maxWidth));
      const expandedHeight = Math.max(collapsedHeight, Math.min(480, maxHeight));

      panel.style.setProperty("--rrhs-collapsed-width", `${collapsedWidth}px`);
      panel.style.setProperty("--rrhs-collapsed-height", `${collapsedHeight}px`);
      panel.style.setProperty("--rrhs-expanded-width", `${expandedWidth}px`);
      panel.style.setProperty("--rrhs-expanded-height", `${expandedHeight}px`);
    }

    applyMotionPreference();
    updatePanelSizes();

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => updatePanelSizes());
    }

    window.addEventListener("resize", updatePanelSizes);

    if (window.matchMedia) {
      const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (typeof motionQuery.addEventListener === "function") {
        motionQuery.addEventListener("change", applyMotionPreference);
      } else if (typeof motionQuery.addListener === "function") {
        motionQuery.addListener(applyMotionPreference);
      }
    }

    setTimeout(showNudge, 700);

    function openPanel() {
      if (panel.classList.contains("rrhs-expanded")) return;
      console.log("[RRHS Assistant] 🟢 OPENING");
      markNudgeSeen();
      hideNudge();
      updatePanelSizes();
      relinkIfMissing();
      hydrateSessionMessages();
      panel.classList.add("rrhs-expanded");
      setTimeout(() => inputEl && inputEl.focus(), 150);
    }

    function closePanel() {
      if (!panel.classList.contains("rrhs-expanded")) return;
      console.log("[RRHS Assistant] 🔴 CLOSING");
      panel.classList.remove("rrhs-expanded");
    }

    // ---------- EVENTS ----------
    pillLabel.addEventListener("click", (e) => {
      console.log("[RRHS Assistant] PILL CLICKED");
      e.preventDefault();
      e.stopPropagation();
      openPanel();
    });

    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closePanel();
    });

    document.addEventListener("click", (e) => {
      const isVisible = panel.classList.contains("rrhs-expanded");
      if (!isVisible) return;
      if (panel.contains(e.target)) return;
      // Intentionally do nothing; keep panel open when clicking outside.
    });

    // ---------- MESSAGE FUNCTIONS ----------
    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function applyAsteriskBold(html) {
      let output = html.replace(/\*\*(.+?)\*\*/gs, "<strong>$1</strong>");
      output = output.replace(/\*(?!\s)([^*]+?)\*(?!\*)/gs, "<strong>$1</strong>");
      return output;
    }

    function escapeRegex(value) {
      return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function normalizeProducts(products) {
      if (!Array.isArray(products)) return [];
      return products
        .map((product) => {
          if (!product) return null;
          const id = Number(product.id || 0);
          const combinationId = Number(product.combinationId || 0);
          const price = Number(product.price);
          return {
            id: Number.isFinite(id) ? id : 0,
            name: product.name || "",
            combinationId: Number.isFinite(combinationId) ? combinationId : 0,
            variantKey: product.variantKey || "",
            variantLabel: product.variantLabel || "",
            price: Number.isFinite(price) ? price : NaN,
            sku: product.sku || "",
            url: product.url || ""
          };
        })
        .filter(Boolean)
        .filter((product) => product.name);
    }

    function uniqueProducts(products) {
      const normalized = normalizeProducts(products);
      const seen = new Set();
      return normalized.filter((product) => {
        const key = `${product.id}:${product.combinationId}:${product.name.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function extractProductsFromToolCalls(toolCalls) {
      if (!Array.isArray(toolCalls)) return [];
      const extracted = [];
      toolCalls.forEach((call) => {
        if (!call || typeof call !== "object") return;
        const result = call.result && typeof call.result === "object" ? call.result : null;
        const items = result && Array.isArray(result.items) ? result.items : [];
        items.forEach((item) => {
          if (!item || typeof item !== "object") return;
          extracted.push({
            id: Number(item.id || 0),
            name: item.name || "",
            combinationId: 0,
            variantKey: "",
            variantLabel: "",
            price: Number(item.price),
            sku: item.sku || "",
            url: item.url || ""
          });
        });
      });
      return uniqueProducts(extracted);
    }

    function normalizeActionList(payload) {
      if (!payload || typeof payload !== "object") return [];
      const direct = payload.cart_actions || payload.cartActions || payload.actions;
      return Array.isArray(direct) ? direct : [];
    }

    function linkifyProducts(escapedText, products = []) {
      if (!products || products.length === 0) return escapedText;

      const replacements = [];
      let tokenIndex = 0;
      const sorted = products
        .filter(product => product && product.name && product.url)
        .sort((a, b) => b.name.length - a.name.length);

      let output = escapedText;
      sorted.forEach(product => {
        const safeName = escapeHtml(product.name);
        const safeUrl = escapeHtml(product.url);
        const regex = new RegExp(escapeRegex(safeName), "gi");
        output = output.replace(regex, (match) => {
          const token = `__RRHS_LINK_${tokenIndex++}__`;
          replacements.push({
            token,
            html: `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="rrhs-product-link">${match}</a>`
          });
          return token;
        });
      });

      replacements.forEach(({ token, html }) => {
        output = output.split(token).join(html);
      });

      return output;
    }

    const SKU_TAG_REGEX = /\[(?:V:\d+:\d+|[A-Za-z0-9_-]{1,32})\]\s*/g;

    function stripSkuTags(text) {
      return String(text)
        .replace(SKU_TAG_REGEX, "")
        .replace(/ {2,}/g, " ");
    }

    function formatMessage(text, products = []) {
      const escaped = escapeHtml(text);
      const linked = linkifyProducts(escaped, products);
      return applyAsteriskBold(linked);
    }

    function formatStreamingMessage(text) {
      return applyAsteriskBold(escapeHtml(text));
    }

    function normalizeStoredProducts(products) {
      if (!Array.isArray(products)) return [];
      return products
        .map((product) => {
          if (!product || typeof product !== "object") return null;
          const name = String(product.name || "").trim();
          const url = String(product.url || "").trim();
          if (!name) return null;
          return { name, url };
        })
        .filter(Boolean);
    }

    function normalizeStoredEntry(entry) {
      if (!entry || typeof entry !== "object") return null;
      const role = entry.role === "assistant" || entry.role === "user" ? entry.role : null;
      const text = typeof entry.text === "string" ? entry.text : "";
      if (!role || !text) return null;
      const stored = { role, text };
      const products = normalizeStoredProducts(entry.products);
      if (products.length) stored.products = products;
      return stored;
    }

    function loadSessionLog() {
      try {
        if (!storageRef) return [];
        const raw = storageRef.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(normalizeStoredEntry).filter(Boolean);
      } catch (e) {
        return [];
      }
    }

    function saveSessionLog() {
      try {
        if (!storageRef) {
          if (!storageWarned) {
            storageWarned = true;
            console.warn("[RRHS Assistant] Storage unavailable; skipping save.");
          }
          return;
        }
        storageRef.setItem(STORAGE_KEY, JSON.stringify(sessionLog));
      } catch (e) {
        if (!storageWarned) {
          storageWarned = true;
          console.warn("[RRHS Assistant] Storage write failed:", e);
        }
      }
    }

    function pushSessionLog(entry) {
      if (!entry) return;
      sessionLog.push(entry);
      saveSessionLog();
    }

    function normalizePendingChoice(pending) {
      if (!pending || typeof pending !== "object" || Array.isArray(pending)) return null;
      try {
        // Keep backend-provided pending shape intact, but store a plain JSON-safe clone.
        return JSON.parse(JSON.stringify(pending));
      } catch (e) {
        return null;
      }
    }

    function loadPendingChoice() {
      try {
        if (!storageRef) return null;
        const raw = storageRef.getItem(PENDING_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return normalizePendingChoice(parsed);
      } catch (e) {
        return null;
      }
    }

    function savePendingChoice(pending) {
      if (!storageRef) return;
      if (!pending) {
        try {
          storageRef.removeItem(PENDING_KEY);
        } catch (e) {
          // Ignore storage failures
        }
        return;
      }
      try {
        storageRef.setItem(PENDING_KEY, JSON.stringify(pending));
      } catch (e) {
        // Ignore storage failures
      }
    }

    function setPendingChoice(pending) {
      pendingChoice = normalizePendingChoice(pending);
      savePendingChoice(pendingChoice);
    }

    function normalizeProductInfo(payload) {
      if (!payload || typeof payload !== "object") return null;
      const products = Array.isArray(payload.products)
        ? payload.products
        : (Array.isArray(payload.results) ? payload.results : null);
      if (!products) return null;

      const normalized = {
        products,
        totalProducts: Number.isFinite(Number(payload.totalProducts))
          ? Number(payload.totalProducts)
          : products.length
      };

      if (typeof payload.sourceTool === "string") normalized.sourceTool = payload.sourceTool;
      if (typeof payload.fetchedAt === "string") normalized.fetchedAt = payload.fetchedAt;

      const meta = (payload.meta && typeof payload.meta === "object") ? Object.assign({}, payload.meta) : {};
      if (typeof payload.feedbackUrl === "string") meta.feedbackUrl = payload.feedbackUrl;
      if (payload.execution && typeof payload.execution === "object") meta.execution = payload.execution;
      if (typeof payload.isPreview === "boolean") meta.isPreview = payload.isPreview;
      if (typeof payload.generatedJqFilter === "string") meta.generatedJqFilter = payload.generatedJqFilter;
      if (Object.keys(meta).length) normalized.meta = meta;

      return normalized;
    }

    function loadProductInfoCache() {
      try {
        if (!storageRef) return null;
        const raw = storageRef.getItem(PRODUCT_INFO_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return normalizeProductInfo(parsed);
      } catch (e) {
        return null;
      }
    }

    function saveProductInfoCache(payload) {
      if (!storageRef) return;
      if (!payload) {
        try {
          storageRef.removeItem(PRODUCT_INFO_KEY);
        } catch (e) {
          // Ignore storage failures
        }
        return;
      }
      try {
        storageRef.setItem(PRODUCT_INFO_KEY, JSON.stringify(payload));
      } catch (e) {
        // Ignore storage failures
      }
    }

    function setProductInfoCache(payload) {
      productInfoCache = normalizeProductInfo(payload);
      saveProductInfoCache(productInfoCache);
    }

    function hydrateSessionMessages() {
      if (!messagesEl) return false;
      if (messagesEl.childElementCount > 0) return true;
      if (!sessionLog.length) return false;
      sessionLog.forEach((entry) => {
        addMessage(entry.role, entry.text, entry.products || [], { persist: false });
      });
      return true;
    }

    function hasStoredProductLinks() {
      return sessionLog.some((entry) =>
        Array.isArray(entry.products) && entry.products.some((p) => p && p.url)
      );
    }

    function relinkIfMissing() {
      if (!messagesEl || !sessionLog.length) return;
      if (messagesEl.querySelector(".rrhs-product-link")) return;
      if (!hasStoredProductLinks()) return;
      messagesEl.innerHTML = "";
      messagesEl.dataset.rrhsIntroShown = "0";
      hydrateSessionMessages();
    }

    function addMessage(role, text, products = [], options = {}) {
      console.log("[RRHS] Adding message:", { role, text, products });
      
      const bubble = document.createElement("div");
      bubble.className = `rrhs-msg ${role === "user" ? "rrhs-user" : "rrhs-bot"}`;

      const content = document.createElement("div");
      content.className = "rrhs-msg-content";
      const displayText = role === "user" ? text : stripSkuTags(text);
      const displayProducts = role === "assistant" ? normalizeProducts(products) : [];
      content.innerHTML = formatMessage(displayText, displayProducts);
      bubble.appendChild(content);
      
      messagesEl.appendChild(bubble);
      messagesEl.scrollTop = messagesEl.scrollHeight;

      const shouldPersist = options.persist !== false;
      if (shouldPersist && (role === "user" || role === "assistant") && text) {
        const entryText = options.persistText != null ? options.persistText : text;
        const entry = { role, text: entryText };
        if (role === "assistant") {
          const storedProducts = normalizeStoredProducts(products);
          if (storedProducts.length) entry.products = storedProducts;
        }
        pushSessionLog(entry);
      }
      return bubble;
    }

    function isAddConfirmation(text) {
      if (!text) return false;
      const normalized = String(text).toLowerCase();
      return normalized.includes("added") && normalized.includes("cart");
    }

    function isVaruBabyTrigger(text) {
      if (!text) return false;
      const cleaned = String(text)
        .replace(/\[\s*\d{1,2}:\d{2}\s*(?:am|pm)\s*\]\s*$/i, "")
        .trim()
        .toLowerCase();
      return cleaned === "varu baby";
    }

    function userHasAddIntent(text) {
      if (!text) return false;
      const t = String(text).toLowerCase().trim();
      if (!t) return false;
      if (t.startsWith("add ")) return true;
      return /\b(add|put|throw)\b/.test(t) && /\b(cart|bag)\b/.test(t);
    }

    function userHasRemoveIntent(text) {
      if (!text) return false;
      const t = String(text).toLowerCase().trim();
      if (!t) return false;
      if (t.startsWith("remove ") || t.startsWith("delete ")) return true;
      return /\b(remove|delete|take)\b/.test(t) && /\b(cart|bag)\b/.test(t);
    }

    function shouldAllowCartActions(userText, options = {}) {
      if (options && options.hadPendingChoice) return true;
      if (pendingChoice) return true;
      return userHasAddIntent(userText) || userHasRemoveIntent(userText);
    }

    function dismissRetryToast() {
      if (retryToastEl) {
        retryToastEl.remove();
        retryToastEl = null;
      }
    }

    function showRetryToast() {
      dismissRetryToast();
      retryToastEl = document.createElement("div");
      retryToastEl.id = "rrhs-retry-toast";
      retryToastEl.innerHTML = `
        <p>Cart add failed — tap to retry.</p>
        <button type="button" id="rrhs-retry-button">Retry</button>
        <span id="rrhs-retry-close">×</span>
      `;
      document.body.appendChild(retryToastEl);

      const retryBtn = document.getElementById("rrhs-retry-button");
      const closeBtnEl = document.getElementById("rrhs-retry-close");
      if (retryBtn) {
        retryBtn.addEventListener("click", () => {
          if (!lastUserMessage || sendBtn.disabled) return;
          dismissRetryToast();
          inputEl.value = lastUserMessage;
          sendMessage();
        });
      }
      if (closeBtnEl) {
        closeBtnEl.addEventListener("click", dismissRetryToast);
      }
    }

    function addIntroMessage() {
      if (!messagesEl || messagesEl.dataset.rrhsIntroShown === "1") return;
      messagesEl.dataset.rrhsIntroShown = "1";
      addMessage(
        "assistant",
        "Hello! I’m the RRHS COOP Bot. You can ask me anything about products, sizes, or recommendations.",
        [],
        { persist: false }
      );
    }
    
    function addTypingIndicator() {
      const bubble = document.createElement("div");
      bubble.className = "rrhs-msg rrhs-bot rrhs-streaming";
      bubble.innerHTML = `
        <div class="rrhs-typing-indicator">
          <div class="rrhs-typing-dot"></div>
          <div class="rrhs-typing-dot"></div>
          <div class="rrhs-typing-dot"></div>
        </div>
      `;
      messagesEl.appendChild(bubble);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return bubble;
    }
    
    function removeTypingIndicator(indicator) {
      if (indicator && indicator.parentNode) {
        indicator.remove();
      }
    }

    function setSending(s) {
      sendBtn.disabled = s;
      inputEl.disabled = s;
      sendBtn.textContent = s ? "..." : "Send";
    }

    function whenEcwidReady(cb) {
      if (window.Ecwid && Ecwid.OnAPILoaded && typeof Ecwid.OnAPILoaded.add === "function") {
        Ecwid.OnAPILoaded.add(() => cb());
        return;
      }
      // fallback: try a few times
      let tries = 0;
      const t = setInterval(() => {
        tries++;
        if (window.Ecwid && Ecwid.Cart) {
          clearInterval(t);
          cb();
        }
        if (tries > 40) clearInterval(t);
      }, 150);
    }

    function buildOptionsMap(rawOptions) {
      if (!rawOptions) return null;
      if (!Array.isArray(rawOptions) && typeof rawOptions === "object") {
        const map = {};
        Object.entries(rawOptions).forEach(([key, value]) => {
          if (!key || value == null) return;
          map[String(key)] = String(value);
        });
        return Object.keys(map).length ? map : null;
      }
      if (!Array.isArray(rawOptions)) return null;
      const map = {};
      rawOptions.forEach((opt) => {
        if (!opt || typeof opt !== "object") return;
        const name = opt.name || opt.optionName || opt.option_name;
        const value = opt.value || opt.optionValue || opt.option_value || opt.text;
        if (!name || value == null) return;
        map[String(name)] = String(value);
      });
      return Object.keys(map).length ? map : null;
    }

    function ecwidGetCart() {
      return new Promise((resolve, reject) => {
        if (!window.Ecwid || !Ecwid.Cart || typeof Ecwid.Cart.get !== "function") {
          reject(new Error("Ecwid Cart.get unavailable"));
          return;
        }
        let done = false;
        const timeout = setTimeout(() => {
          if (done) return;
          done = true;
          reject(new Error("Ecwid Cart.get timeout"));
        }, 6000);
        Ecwid.Cart.get((cart) => {
          if (done) return;
          done = true;
          clearTimeout(timeout);
          resolve(cart || {});
        });
      });
    }

    function ecwidAddProduct(product) {
      return new Promise((resolve, reject) => {
        if (!window.Ecwid || !Ecwid.Cart || typeof Ecwid.Cart.addProduct !== "function") {
          reject(new Error("Ecwid Cart.addProduct unavailable"));
          return;
        }
        let done = false;
        const timeout = setTimeout(() => {
          if (done) return;
          done = true;
          reject(new Error("Ecwid Cart.addProduct timeout"));
        }, 6000);
        const payload = Object.assign({}, product, {
          callback: function (success, productResult, cart, error) {
            if (done) return;
            done = true;
            clearTimeout(timeout);
            if (!success) {
              reject(new Error(error || "addProduct failed"));
              return;
            }
            resolve({ success, productResult, cart, error });
          }
        });
        Ecwid.Cart.addProduct(payload);
      });
    }

    function ecwidRemoveProduct(index) {
      return new Promise((resolve, reject) => {
        if (!window.Ecwid || !Ecwid.Cart || typeof Ecwid.Cart.removeProduct !== "function") {
          reject(new Error("Ecwid Cart.removeProduct unavailable"));
          return;
        }
        let done = false;
        const timeout = setTimeout(() => {
          if (done) return;
          done = true;
          reject(new Error("Ecwid Cart.removeProduct timeout"));
        }, 6000);
        Ecwid.Cart.removeProduct(index, function (success, itemsRemovedQuantity, product, cart, error) {
          if (done) return;
          done = true;
          clearTimeout(timeout);
          if (!success) {
            reject(new Error(error || "removeProduct failed"));
            return;
          }
          resolve({ success, itemsRemovedQuantity, product, cart, error });
        });
      });
    }

    function optionsMatch(itemOptions, targetOptions) {
      if (!targetOptions || !Object.keys(targetOptions).length) return true;
      const item = itemOptions && typeof itemOptions === "object" ? itemOptions : {};
      const targetKeys = Object.keys(targetOptions);
      return targetKeys.every((key) => String(item[key] || "") === String(targetOptions[key] || ""));
    }

    async function decrementCartItem(action) {
      const actionProduct = (action.product && typeof action.product === "object") ? action.product : null;
      const productId = Number(
        (actionProduct && actionProduct.id != null ? actionProduct.id : null)
        || action.productId
        || 0
      );
      if (!Number.isFinite(productId) || productId <= 0) return;

      let removeQty = Math.max(1, Math.abs(Number(
        (actionProduct && actionProduct.quantity != null ? actionProduct.quantity : null)
        || action.quantity
        || 1
      )));
      const combinationId = Number(
        action.combinationId != null
          ? action.combinationId
          : (actionProduct && actionProduct.combinationId != null ? actionProduct.combinationId : 0)
      );
      const targetOptions =
        buildOptionsMap(actionProduct ? actionProduct.options : null) ||
        buildOptionsMap(action.options) ||
        buildOptionsMap(actionProduct ? actionProduct.selectedOptions : null) ||
        buildOptionsMap(action.selectedOptions) ||
        null;

      const cart = await ecwidGetCart();
      const items = Array.isArray(cart.items) ? cart.items : [];
      const matches = items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => {
          const product = item && item.product ? item.product : {};
          const itemProductId = Number(product.id || 0);
          if (itemProductId !== productId) return false;
          if (Number.isFinite(combinationId) && combinationId > 0) {
            const variationId = Number(product.variation || 0);
            if (variationId !== combinationId) return false;
          }
          return optionsMatch(item.options, targetOptions);
        });

      for (const match of matches) {
        if (removeQty <= 0) break;
        const currentQty = Math.max(0, Number(match.item && match.item.quantity) || 0);
        if (currentQty <= 0) continue;
        const nextQty = currentQty - removeQty;
        removeQty -= Math.min(currentQty, removeQty);

        await ecwidRemoveProduct(match.index);
        if (nextQty > 0) {
          const replacement = { id: productId, quantity: nextQty };
          if (Number.isFinite(combinationId) && combinationId > 0) {
            replacement.combinationId = combinationId;
          }
          if (targetOptions) replacement.options = targetOptions;
          await ecwidAddProduct(replacement);
        }
      }
    }

    function executeCartActions(actions) {
      if (!Array.isArray(actions) || actions.length === 0) return;
      if (!CART_ACTIONS_ENABLED) {
        console.log("[RRHS Assistant] Cart actions are temporarily disabled.", { count: actions.length });
        return;
      }

      whenEcwidReady(() => {
        (async () => {
          console.log("[RRHS Assistant] ➕ Cart action queue start", { count: actions.length });
          for (let idx = 0; idx < actions.length; idx += 1) {
            const a = actions[idx];
            if (!a || !a.type) continue;
            try {
              if (a.type === "cart.add") {
                const actionProduct = (a.product && typeof a.product === "object") ? a.product : null;
                const rawQuantity = Number(
                  (actionProduct && actionProduct.quantity != null ? actionProduct.quantity : null)
                  || a.quantity
                  || 1
                );
                const productId = Number(
                  (actionProduct && actionProduct.id != null ? actionProduct.id : null)
                  || a.productId
                  || 0
                );
                if (!Number.isFinite(productId) || productId <= 0) continue;
                const combinationId = Number(
                  a.combinationId != null
                    ? a.combinationId
                    : (actionProduct && actionProduct.combinationId != null ? actionProduct.combinationId : 0)
                );
                const options =
                  buildOptionsMap(actionProduct ? actionProduct.options : null) ||
                  buildOptionsMap(a.options) ||
                  buildOptionsMap(actionProduct ? actionProduct.selectedOptions : null) ||
                  buildOptionsMap(a.selectedOptions) ||
                  (a.optionName && a.optionValue ? { [String(a.optionName)]: String(a.optionValue) } : null);

                if (rawQuantity < 0) {
                  await decrementCartItem(a);
                  console.log(`[RRHS Assistant] ➖ decrement #${idx + 1}`, {
                    productId,
                    quantity: rawQuantity
                  });
                  continue;
                }

                const product = {
                  id: productId,
                  quantity: Math.max(1, Number.isFinite(rawQuantity) ? rawQuantity : 1)
                };
                if (Number.isFinite(combinationId) && combinationId > 0) {
                  product.combinationId = combinationId;
                }
                if (options && Object.keys(options).length) {
                  product.options = options;
                }
                await ecwidAddProduct(product);
                console.log(`[RRHS Assistant] ✅ addProduct #${idx + 1} ok`, {
                  productId,
                  quantity: product.quantity
                });
                continue;
              }

              if (a.type === "cart.remove") {
                await decrementCartItem({
                  type: "cart.add",
                  product: a.product,
                  productId: a.productId,
                  combinationId: a.combinationId,
                  options: a.options,
                  selectedOptions: a.selectedOptions,
                  quantity: -Math.max(1, Math.abs(Number(a.quantity || 1)))
                });
                continue;
              }

              if (a.type === "cart.open") {
                Ecwid.openPage("cart");
                continue;
              }

              if (a.type === "cart.checkout") {
                Ecwid.Cart.gotoCheckout();
                continue;
              }
            } catch (err) {
              console.warn(`[RRHS Assistant] Cart action #${idx + 1} failed`, err);
            }
          }
          console.log("[RRHS Assistant] ✅ Cart action queue complete");
        })();
      });
    }

    // ---------- SSE STREAMING CHAT ----------
    sessionLog = loadSessionLog();
    pendingChoice = loadPendingChoice();
    productInfoCache = loadProductInfoCache();
    const restored = hydrateSessionMessages();
    if (!restored) {
      addIntroMessage();
    }

    async function sendMessage() {
      const msg = (inputEl.value || "").trim();
      if (!msg) return;

      let cartActionsHandled = false;
      let lastActionsHadCartAdd = false;
      const sessionHistory = sessionLog.map((entry, index) => ({
        role: entry.role,
        content: entry.text,
        order: index + 1
      }));
      const isVisible = panel.classList.contains("rrhs-expanded");
      if (!isVisible) openPanel();

      if (isVaruBabyTrigger(msg)) {
        addMessage("user", msg, [], { persist: false });
        inputEl.value = "";
        const reply = "I wuv you Neniboo sosososoos much ur so cute and amazing and awesome and allat";
        addMessage("assistant", reply, [], { persist: false });
        return;
      }

      lastUserMessage = msg;
      dismissRetryToast();

      addMessage("user", msg);
      inputEl.value = "";
      setSending(true);

      const typingIndicator = addTypingIndicator();
      let streamingBubble = null;
      let streamingContent = null;
      let accumulatedText = "";
      let finalizedAssistantText = "";
      let streamFinished = false;

      function handleCartActions(actions, options = {}) {
        if (cartActionsHandled || !Array.isArray(actions) || actions.length === 0) return;
        cartActionsHandled = true;
        if (!shouldAllowCartActions(lastUserMessage, options)) {
          console.warn("[RRHS Assistant] Cart actions blocked (no user cart intent/pending).", {
            lastUserMessage,
            hasPending: Boolean(pendingChoice),
            actionCount: actions.length
          });
          return;
        }
        lastActionsHadCartAdd = actions.some((action) => action && action.type === "cart.add");
        console.log("[RRHS Assistant] Cart actions received:", {
          count: actions.length,
          actions
        });
        executeCartActions(actions);
      }

      function ensureStreamingBubble() {
        if (typingIndicator) {
          removeTypingIndicator(typingIndicator);
        }
        if (streamingBubble) return;
        streamingBubble = document.createElement("div");
        streamingBubble.className = "rrhs-msg rrhs-bot rrhs-streaming";
        streamingContent = document.createElement("div");
        streamingContent.className = "rrhs-msg-content";
        streamingBubble.appendChild(streamingContent);
        messagesEl.appendChild(streamingBubble);
      }

      function appendAssistantText(text) {
        if (typeof text !== "string" || !text) return;
        ensureStreamingBubble();
        accumulatedText += text;
        if (streamingContent) {
          const displayText = stripSkuTags(accumulatedText);
          streamingContent.innerHTML = formatStreamingMessage(displayText);
        }
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }

      function finalizeAssistantMessage(payload = {}) {
        if (streamFinished) return;
        streamFinished = true;

        removeTypingIndicator(typingIndicator);
        if (streamingBubble) {
          streamingBubble.remove();
          streamingBubble = null;
        }

        const payloadProducts = Array.isArray(payload.products) ? payload.products : [];
        const toolProducts = extractProductsFromToolCalls(payload.tool_calls || payload.toolCalls || []);
        const products = uniqueProducts([].concat(payloadProducts, toolProducts));
        const finalText = (typeof payload.message === "string" && payload.message.trim())
          ? payload.message
          : ((typeof payload.text === "string" && payload.text.trim())
            ? payload.text
            : (finalizedAssistantText.trim() || accumulatedText.trim()));
        const persistText = accumulatedText || finalText;

        if (finalText) {
          addMessage("assistant", finalText, products, { persistText });
        } else {
          addMessage("assistant", "I couldn't generate a response. Please try again.");
        }

        const actions = normalizeActionList(payload);
        const hasCartAdd = actions.some((action) => action && action.type === "cart.add") || lastActionsHadCartAdd;
        if (hasCartAdd) {
          setPendingChoice(null);
        } else if (Object.prototype.hasOwnProperty.call(payload, "pending")) {
          setPendingChoice(payload.pending || null);
        }

        const maybeCatalogData = normalizeProductInfo(
          payload.catalogData || payload.catalog_data || payload.product_info || payload.catalogDataJson
        );
        if (maybeCatalogData) {
          setProductInfoCache(maybeCatalogData);
          console.log("[RRHS Assistant] Cached catalog data from final payload:", {
            count: maybeCatalogData.products.length
          });
        }

        if (!hasCartAdd && isAddConfirmation(finalText)) {
          showRetryToast();
        }
      }

      function parseSseBlock(block) {
        const lines = String(block || "").split("\n");
        let eventType = "";
        const dataLines = [];

        lines.forEach((line) => {
          if (line.startsWith("event:")) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trimStart());
          }
        });

        if (!dataLines.length) return null;
        const dataText = dataLines.join("\n").trim();
        if (!dataText) return null;
        if (dataText === "[DONE]") return { eventType: "done", data: null };

        let parsed = dataText;
        try {
          parsed = JSON.parse(dataText);
        } catch (e) {
          // Keep text payloads as-is
        }

        if (!eventType && parsed && typeof parsed === "object" && typeof parsed.event === "string") {
          eventType = parsed.event;
        }

        return {
          eventType: eventType || "message",
          data: parsed
        };
      }

      function handleStreamEvent(eventType, data) {
        if (streamFinished) return;

        const payload = (data && typeof data === "object") ? data : {};
        const rawText = typeof data === "string" ? data : "";
        const hadPendingChoice = Boolean(pendingChoice);
        const eventActions = normalizeActionList(payload);
        handleCartActions(eventActions, { hadPendingChoice });
        if (payload && Object.prototype.hasOwnProperty.call(payload, "pending") && eventType !== "final" && eventType !== "done") {
          setPendingChoice(payload.pending || null);
        }

        if (eventType === "delta") {
          appendAssistantText(typeof payload.content === "string" ? payload.content : "");
          return;
        }

        if (eventType === "assistant_delta") {
          const token = typeof payload.token === "string"
            ? payload.token
            : (typeof payload.content === "string" ? payload.content : rawText);
          appendAssistantText(token);
          return;
        }

        if (eventType === "assistant") {
          const assistantText = typeof payload.text === "string"
            ? payload.text
            : (typeof payload.message === "string"
              ? payload.message
              : (typeof payload.content === "string" ? payload.content : rawText));
          if (assistantText) {
            finalizedAssistantText = assistantText;
            accumulatedText = assistantText;
            ensureStreamingBubble();
            if (streamingContent) {
              const displayText = stripSkuTags(assistantText);
              streamingContent.innerHTML = formatStreamingMessage(displayText);
            }
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
          return;
        }

        if (eventType === "final") {
          finalizeAssistantMessage({
            message: payload.message,
            products: payload.products,
            pending: payload.pending,
            actions: eventActions,
            tool_calls: payload.tool_calls || payload.toolCalls || []
          });
          console.log("[RRHS Assistant] ✅ Legacy stream complete", {
            products: Array.isArray(payload.products) ? payload.products.length : 0
          });
          return;
        }

        if (eventType === "catalog") {
          const maybeProductInfo = normalizeProductInfo(payload)
            || normalizeProductInfo(payload.result)
            || normalizeProductInfo(payload.output)
            || normalizeProductInfo(payload.data);
          if (maybeProductInfo) {
            setProductInfoCache(maybeProductInfo);
            console.log("[RRHS Assistant] Cached product_info from catalog:", {
              count: maybeProductInfo.products.length
            });
          }
          return;
        }

        if (eventType === "meta" || eventType === "tool_call" || eventType === "tool_result") {
          if (eventType === "tool_result") {
            const maybeProductInfo = normalizeProductInfo(payload)
              || normalizeProductInfo(payload.result)
              || normalizeProductInfo(payload.output)
              || normalizeProductInfo(payload.data);
            if (maybeProductInfo) {
              setProductInfoCache(maybeProductInfo);
              console.log("[RRHS Assistant] Cached product_info from tool_result:", {
                count: maybeProductInfo.products.length
              });
            }
          }
          console.log(`[RRHS Assistant] ${eventType}:`, payload);
          return;
        }

        if (eventType === "error") {
          const message = typeof payload.error === "string"
            ? payload.error
            : (typeof payload.message === "string" ? payload.message : (rawText || "Unknown stream error"));
          throw new Error(message);
        }

        if (eventType === "done") {
          finalizeAssistantMessage({
            message: typeof payload.message === "string" ? payload.message : "",
            products: payload.products,
            pending: payload.pending,
            actions: eventActions,
            tool_calls: payload.tool_calls || payload.toolCalls || []
          });
        }
      }

      try {
        const currentOrder = sessionHistory.length + 1;
        const messages = [{ role: "user", content: msg, order: currentOrder }];
        const simpleHistory = sessionHistory.map((entry) => ({
          role: entry.role,
          content: entry.content
        }));
        const payload = {
          message: msg,
          history: simpleHistory,
          stream: REQUEST_STREAM,
          messages,
          message_history: sessionHistory,
          new_convo: isNewConversationCall,
          pending: pendingChoice || null
        };
        if (productInfoCache) {
          payload.catalogData = productInfoCache;
          payload.product_info = productInfoCache;
        }
        isNewConversationCall = false;
        if (sessionId) {
          payload.session_id = sessionId;
        }
        const historyPreviewCount = Math.min(sessionHistory.length, 10);
        console.log("[RRHS Assistant] Sending payload:", {
          url: API_URL,
          messageCount: messages.length,
          historyCount: sessionHistory.length,
          historyPreview: sessionHistory.slice(-historyPreviewCount),
          historyPreviewCount,
          newConvo: payload.new_convo,
          hasProductInfo: Boolean(payload.product_info),
          productInfoCount: payload.product_info && Array.isArray(payload.product_info.products)
            ? payload.product_info.products.length
            : (payload.product_info && Array.isArray(payload.product_info.results)
              ? payload.product_info.results.length
              : 0),
          hasCatalogData: Boolean(payload.catalogData),
          catalogDataCount: payload.catalogData && Array.isArray(payload.catalogData.products)
            ? payload.catalogData.products.length
            : 0,
          sessionId: sessionId || null,
          hasPending: Boolean(payload.pending),
          pendingType: payload.pending && payload.pending.type ? payload.pending.type : null,
          pendingCount: payload.pending && Array.isArray(payload.pending.options) ? payload.pending.options.length : 0,
          stream: payload.stream
        });

        const headers = {
          "Content-Type": "application/json"
        };
        if (API_KEY) {
          headers[API_KEY_HEADER] = `${API_KEY_PREFIX}${API_KEY}`;
        }

        const res = await fetch(API_URL, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const contentType = String(res.headers.get("content-type") || "").toLowerCase();
        const isEventStream = contentType.includes("text/event-stream");
        if (!isEventStream) {
          let jsonPayload = null;
          try {
            jsonPayload = await res.json();
          } catch (e) {
            jsonPayload = null;
          }
          if (jsonPayload && typeof jsonPayload === "object") {
            const responseActions = normalizeActionList(jsonPayload);
            handleCartActions(responseActions, { hadPendingChoice: Boolean(pendingChoice) });
            const finalPayload = {
              message: jsonPayload.message || jsonPayload.text || "",
              products: jsonPayload.products,
              actions: responseActions,
              tool_calls: jsonPayload.tool_calls || jsonPayload.toolCalls || []
            };
            if (Object.prototype.hasOwnProperty.call(jsonPayload, "pending")) {
              finalPayload.pending = jsonPayload.pending;
            }
            finalizeAssistantMessage(finalPayload);
          } else {
            finalizeAssistantMessage({
              message: "I couldn't parse the assistant response."
            });
          }
          return;
        }

        const reader = res.body && typeof res.body.getReader === "function" ? res.body.getReader() : null;
        if (!reader) {
          finalizeAssistantMessage({
            message: "The assistant stream was unavailable."
          });
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() || "";

          for (const block of blocks) {
            const parsed = parseSseBlock(block);
            if (!parsed) continue;
            handleStreamEvent(parsed.eventType, parsed.data);
          }
        }

        if (!streamFinished) {
          const trailing = parseSseBlock(buffer);
          if (trailing) {
            handleStreamEvent(trailing.eventType, trailing.data);
          }
        }
        if (!streamFinished) {
          finalizeAssistantMessage();
        }

      } catch (err) {
        console.error("[RRHS Assistant] Stream error:", err);
        removeTypingIndicator(typingIndicator);
        if (streamingBubble) streamingBubble.remove();
        addMessage("assistant", `Sorry – couldn't reach the assistant.\n${err.message}`);
      } finally {
        setSending(false);
        inputEl.focus();
      }
    }

    sendBtn.addEventListener("click", (e) => {
      e.preventDefault();
      sendMessage();
    });

    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    console.log("[RRHS Assistant] ✅ Ready with enhanced animated product links!");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

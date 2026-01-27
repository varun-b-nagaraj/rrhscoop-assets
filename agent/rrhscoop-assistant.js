// rrhscoop-assistant.js - Enhanced with Animated Product Links
(() => {
  if (window.__RRHS_ASSISTANT__) return;
  window.__RRHS_ASSISTANT__ = true;

  const DEFAULT_CONFIG = {
    apiUrl: "https://mcp-client-4sdk.onrender.com/chat",
    apiKey: "5e7571d3a600120047e5ce906c1bdf08f72a95b8c4d37f75cfdf847b10f79c5a"
  };
  const CONFIG = Object.assign({}, DEFAULT_CONFIG, window.RRHS_ASSISTANT_CONFIG || {});
  const API_URL = CONFIG.apiUrl;
  const API_KEY = CONFIG.apiKey;
  const Z = 2147483647;

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
        border-color: rgba(0,0,0,.08) !important;
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
        text-underline-offset: 2px !important;
        font-weight: 600 !important;
        transition: color 0.2s ease !important;
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

    function openPanel() {
      if (panel.classList.contains("rrhs-expanded")) return;
      console.log("[RRHS Assistant] 🟢 OPENING");
      updatePanelSizes();
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
      closePanel();
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

    function addMessage(role, text, products = []) {
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
      return bubble;
    }

    function addIntroMessage() {
      if (!messagesEl || messagesEl.dataset.rrhsIntroShown === "1") return;
      messagesEl.dataset.rrhsIntroShown = "1";
      addMessage("assistant", "Hello! I’m the RRHS COOP Bot. Ask me anything about products, sizes, or recommendations.");
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

    function executeCartActions(actions) {
      if (!actions || !actions.length) return;

      whenEcwidReady(() => {
        actions.forEach((a) => {
          if (!a || !a.type) return;

          if (a.type === "cart.add" && a.productId) {
            const quantity = Math.max(1, Number(a.quantity || 1));
            const productId = Number(a.productId || 0);
            if (!Number.isFinite(productId) || productId <= 0) return;
            const product = { id: productId, quantity };
            const options = buildOptionsMap(a.options) ||
              (a.optionName && a.optionValue ? { [String(a.optionName)]: String(a.optionValue) } : null);
            if (options) product.options = options;
            if (a.selectedPrice != null) {
              product.selectedPrice = String(a.selectedPrice);
            }
            if (a.recurringChargeSettings && typeof a.recurringChargeSettings === "object") {
              product.recurringChargeSettings = a.recurringChargeSettings;
            }
            if (!Ecwid || !Ecwid.Cart || typeof Ecwid.Cart.addProduct !== "function") {
              console.warn("[RRHS Assistant] Ecwid Cart API not ready");
              return;
            }
            Ecwid.Cart.addProduct(product, function (success, productResult, cart, error) {
              if (!success) {
                console.warn("[RRHS Assistant] Cart add failed", error || productResult);
                return;
              }
              // Optional: open cart after add
              // Ecwid.openPage('cart');
            });
          }

          if (a.type === "cart.open") {
            Ecwid.openPage("cart");
          }

          if (a.type === "cart.checkout") {
            Ecwid.Cart.gotoCheckout();
          }
        });
      });
    }

    // ---------- SSE STREAMING CHAT ----------
    addIntroMessage();

    async function sendMessage() {
      const msg = (inputEl.value || "").trim();
      if (!msg) return;

      const isVisible = panel.classList.contains("rrhs-expanded");
      if (!isVisible) openPanel();

      addMessage("user", msg);
      inputEl.value = "";
      setSending(true);

      const typingIndicator = addTypingIndicator();
      let streamingBubble = null;
      let streamingContent = null;
      let accumulatedText = "";

      try {
        const res = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${API_KEY}`,
          },
          body: JSON.stringify({ 
            message: msg,
            stream: true  // Enable streaming
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.trim() || !line.startsWith("data: ")) continue;
            
            const jsonStr = line.slice(6); // Remove "data: " prefix
            if (jsonStr === "[DONE]") continue;

            try {
              const event = JSON.parse(jsonStr);
              
              if (event.event === "delta") {
                // Remove typing indicator on first delta
                if (typingIndicator) {
                  removeTypingIndicator(typingIndicator);
                }
                
                // Create streaming bubble on first delta
                if (!streamingBubble) {
                  streamingBubble = document.createElement("div");
                  streamingBubble.className = "rrhs-msg rrhs-bot rrhs-streaming";
                  streamingContent = document.createElement("div");
                  streamingContent.className = "rrhs-msg-content";
                  streamingBubble.appendChild(streamingContent);
                  messagesEl.appendChild(streamingBubble);
                }
                
                // Append delta content
                accumulatedText += event.content;
                if (streamingContent) {
                  const displayText = stripSkuTags(accumulatedText);
                  streamingContent.innerHTML = formatStreamingMessage(displayText);
                }
                messagesEl.scrollTop = messagesEl.scrollHeight;
                
              } else if (event.event === "final") {
                // Remove streaming bubble
                if (streamingBubble) {
                  streamingBubble.remove();
                  streamingBubble = null;
                }
                
                // Add final message with product links
                const products = event.products || [];
                console.log("[RRHS Assistant] Final event received:", {
                  message: event.message,
                  products: products,
                  validated: event.validated,
                  inStock: event.in_stock_products
                });
                
                addMessage("assistant", event.message, products);

                const actions = event.cart_actions || event.cartActions || [];
                executeCartActions(actions);
                
                console.log("[RRHS Assistant] ✅ Stream complete", {
                  validated: event.validated,
                  products: products.length,
                  inStock: event.in_stock_products
                });
              }
            } catch (e) {
              console.warn("[RRHS Assistant] Failed to parse SSE event:", e);
            }
          }
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

// rrhscoop-assistant.js - Production Ready with SSE Streaming & Product Links
(() => {
  if (window.__RRHS_ASSISTANT__) return;
  window.__RRHS_ASSISTANT__ = true;

  const API_URL = "https://mcp-client-4sdk.onrender.com/chat";
  const API_KEY = "5e7571d3a600120047e5ce906c1bdf08f72a95b8c4d37f75cfdf847b10f79c5a";
  const Z = 2147483647;

  function init() {
    if (!document.body) {
      setTimeout(init, 50);
      return;
    }

    // ---------- ENHANCED STYLES WITH SMOOTH ANIMATIONS ----------
    const style = document.createElement("style");
    style.id = "rrhs-assistant-styles";
    style.textContent = `
      @keyframes rrhs-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
      
      @keyframes rrhs-slideInUp {
        from {
          opacity: 0;
          transform: translateY(20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      
      @keyframes rrhs-slideOutDown {
        from {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        to {
          opacity: 0;
          transform: translateY(20px) scale(0.95);
        }
      }
      
      @keyframes rrhs-fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      #rrhs-assistant-pill {
        position: fixed !important;
        right: 18px !important;
        bottom: 18px !important;
        z-index: ${Z} !important;
        background: #670000 !important;
        color: #F9F9F9 !important;
        padding: 14px 18px !important;
        border-radius: 999px !important;
        font-family: system-ui, -apple-system, sans-serif !important;
        font-size: 15px !important;
        font-weight: 700 !important;
        box-shadow: 0 8px 24px rgba(0,0,0,.25) !important;
        cursor: pointer !important;
        user-select: none !important;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        animation: rrhs-pulse 2s ease-in-out infinite !important;
      }
      
      #rrhs-assistant-pill:hover {
        background: #7a0000 !important;
        transform: translateY(-3px) !important;
        box-shadow: 0 12px 32px rgba(0,0,0,.35) !important;
        animation: none !important;
      }

      #rrhs-assistant-panel {
        position: fixed !important;
        right: 18px !important;
        bottom: 85px !important;
        width: 380px !important;
        height: 520px !important;
        max-height: calc(100vh - 120px) !important;
        z-index: ${Z} !important;
        display: flex !important;
        flex-direction: column !important;
        background: #F9F9F9 !important;
        border: 2px solid #670000 !important;
        border-radius: 16px !important;
        box-shadow: 0 16px 48px rgba(0,0,0,.35) !important;
        overflow: hidden !important;
        font-family: system-ui, -apple-system, sans-serif !important;
        box-sizing: border-box !important;
        transform-origin: bottom right !important;
        transition: none !important;
      }
      
      #rrhs-assistant-panel.rrhs-hidden {
        display: none !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      
      #rrhs-assistant-panel.rrhs-visible {
        display: flex !important;
        animation: rrhs-slideInUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards !important;
        pointer-events: all !important;
      }
      
      #rrhs-assistant-panel.rrhs-closing {
        animation: rrhs-slideOutDown 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards !important;
      }

      #rrhs-assistant-header {
        background: #670000 !important;
        color: #F9F9F9 !important;
        padding: 16px !important;
        font-weight: 800 !important;
        font-size: 17px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        flex-shrink: 0 !important;
      }
      
      #rrhs-close {
        cursor: pointer !important;
        font-size: 28px !important;
        line-height: 1 !important;
        padding: 4px 10px !important;
        border-radius: 8px !important;
        background: transparent !important;
        border: none !important;
        color: #F9F9F9 !important;
        transition: all 0.2s ease !important;
      }
      #rrhs-close:hover {
        background: rgba(255,255,255,.2) !important;
        transform: rotate(90deg) !important;
      }

      #rrhs-messages {
        flex: 1 !important;
        min-height: 0 !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        padding: 16px !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 12px !important;
        scroll-behavior: smooth !important;
      }
      
      .rrhs-msg {
        max-width: 78% !important;
        display: inline-flex !important;
        flex-direction: column !important;
        padding: 12px 15px !important;
        border-radius: 14px !important;
        font-size: 14px !important;
        line-height: 1.5 !important;
        height: auto !important;
        min-height: fit-content !important;
        overflow: visible !important;
        white-space: pre-wrap !important;
        overflow-wrap: break-word !important;
        word-break: break-word !important;
        box-sizing: border-box !important;
        animation: rrhs-fadeIn 0.2s ease-out !important;
      }
      
      .rrhs-user {
        align-self: flex-end !important;
        background: #670000 !important;
        color: #F9F9F9 !important;
      }
      
      .rrhs-bot {
        align-self: flex-start !important;
        background: #fff !important;
        color: #222 !important;
        border: 1px solid rgba(0,0,0,.12) !important;
      }
      
      .rrhs-bot.rrhs-streaming {
        opacity: 0.95 !important;
      }
      
      .rrhs-product-link {
        color: #670000 !important;
        text-decoration: underline !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
      }
      
      .rrhs-product-link:hover {
        color: #7a0000 !important;
        text-decoration: none !important;
        background: rgba(103, 0, 0, 0.08) !important;
        padding: 2px 4px !important;
        margin: -2px -4px !important;
        border-radius: 4px !important;
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
        padding: 14px !important;
        border-top: 1px solid rgba(0,0,0,.15) !important;
        flex-shrink: 0 !important;
      }
      
      #rrhs-input {
        flex: 1 !important;
        padding: 12px 15px !important;
        border: 1.5px solid rgba(0,0,0,.25) !important;
        border-radius: 12px !important;
        font-size: 14px !important;
        outline: none !important;
        font-family: system-ui, -apple-system, sans-serif !important;
        transition: all 0.2s ease !important;
      }
      #rrhs-input:focus {
        border-color: #670000 !important;
        box-shadow: 0 0 0 3px rgba(103,0,0,.15) !important;
      }
      
      #rrhs-send {
        background: #670000 !important;
        color: #F9F9F9 !important;
        border: none !important;
        padding: 12px 22px !important;
        border-radius: 12px !important;
        font-size: 14px !important;
        font-weight: 700 !important;
        cursor: pointer !important;
        font-family: system-ui, -apple-system, sans-serif !important;
        transition: all 0.2s ease !important;
      }
      #rrhs-send:hover:not(:disabled) {
        background: #7a0000 !important;
        transform: translateY(-1px) !important;
        box-shadow: 0 4px 12px rgba(103,0,0,.3) !important;
      }
      #rrhs-send:active:not(:disabled) {
        transform: translateY(0) !important;
      }
      #rrhs-send:disabled {
        opacity: .6 !important;
        cursor: not-allowed !important;
      }
    `;
    document.head.appendChild(style);

    // ---------- CREATE ELEMENTS ----------
    const pill = document.createElement("div");
    pill.id = "rrhs-assistant-pill";
    pill.textContent = "Ask the Store";

    const panel = document.createElement("div");
    panel.id = "rrhs-assistant-panel";
    panel.className = "rrhs-hidden";
    
    panel.innerHTML = `
      <div id="rrhs-assistant-header">
        <div>Store Assistant</div>
        <button id="rrhs-close" type="button">×</button>
      </div>
      <div id="rrhs-messages"></div>
      <div id="rrhs-input-row">
        <input id="rrhs-input" type="text" placeholder="What should I buy?" autocomplete="off" />
        <button id="rrhs-send" type="button">Send</button>
      </div>
    `;

    document.body.appendChild(panel);
    document.body.appendChild(pill);

    const messagesEl = document.getElementById("rrhs-messages");
    const inputEl = document.getElementById("rrhs-input");
    const sendBtn = document.getElementById("rrhs-send");
    const closeBtn = document.getElementById("rrhs-close");

    // ---------- PANEL ANIMATION FUNCTIONS ----------
    function openPanel() {
      console.log("[RRHS Assistant] 🟢 OPENING");
      panel.classList.remove("rrhs-hidden", "rrhs-closing");
      panel.classList.add("rrhs-visible");
      setTimeout(() => inputEl && inputEl.focus(), 150);
    }

    function closePanel() {
      console.log("[RRHS Assistant] 🔴 CLOSING");
      panel.classList.add("rrhs-closing");
      
      // Wait for animation to complete before hiding
      setTimeout(() => {
        panel.classList.remove("rrhs-visible", "rrhs-closing");
        panel.classList.add("rrhs-hidden");
      }, 250);
    }

    function togglePanel() {
      const isVisible = panel.classList.contains("rrhs-visible");
      if (isVisible) {
        closePanel();
      } else {
        openPanel();
      }
    }

    // ---------- EVENTS ----------
    pill.addEventListener("click", (e) => {
      console.log("[RRHS Assistant] PILL CLICKED");
      e.preventDefault();
      e.stopPropagation();
      togglePanel();
    });

    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closePanel();
    });

    document.addEventListener("click", (e) => {
      const isVisible = panel.classList.contains("rrhs-visible");
      if (!isVisible) return;
      if (panel.contains(e.target) || pill.contains(e.target)) return;
      closePanel();
    });

    // ---------- MESSAGE FUNCTIONS ----------
    function addMessage(role, text, products = []) {
      const bubble = document.createElement("div");
      bubble.className = `rrhs-msg ${role === "user" ? "rrhs-user" : "rrhs-bot"}`;
      
      // Convert product names to hyperlinks
      let processedText = text;
      if (products && products.length > 0) {
        products.forEach(product => {
          if (product.url && product.name) {
            // Create a link for the product name
            const linkHtml = `<a href="${product.url}" target="_blank" class="rrhs-product-link">${product.name}</a>`;
            // Replace product name with link (case-insensitive)
            const regex = new RegExp(product.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            processedText = processedText.replace(regex, linkHtml);
          }
        });
      }
      
      bubble.innerHTML = processedText;
      messagesEl.appendChild(bubble);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return bubble;
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

    // ---------- SSE STREAMING CHAT ----------
    async function sendMessage() {
      const msg = (inputEl.value || "").trim();
      if (!msg) return;

      const isVisible = panel.classList.contains("rrhs-visible");
      if (!isVisible) openPanel();

      addMessage("user", msg);
      inputEl.value = "";
      setSending(true);

      const typingIndicator = addTypingIndicator();
      let streamingBubble = null;
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
                  messagesEl.appendChild(streamingBubble);
                }
                
                // Append delta content
                accumulatedText += event.content;
                streamingBubble.textContent = accumulatedText;
                messagesEl.scrollTop = messagesEl.scrollHeight;
                
              } else if (event.event === "final") {
                // Remove streaming bubble
                if (streamingBubble) {
                  streamingBubble.remove();
                  streamingBubble = null;
                }
                
                // Add final message with product links
                const products = event.products || [];
                addMessage("assistant", event.message, products);
                
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

    console.log("[RRHS Assistant] ✅ Ready with SSE streaming & product links!");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
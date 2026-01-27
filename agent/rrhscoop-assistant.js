// rrhscoop-assistant.js - USING !important IN cssText
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

    // ---------- STYLES ----------
    const style = document.createElement("style");
    style.id = "rrhs-assistant-styles";
    style.textContent = `
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
      }
      #rrhs-assistant-pill:hover {
        background: #7a0000 !important;
        transform: translateY(-2px) !important;
      }

      #rrhs-assistant-panel {
        position: fixed !important;
        right: 18px !important;
        bottom: 85px !important;
        width: 380px !important;
        height: 520px !important;
        z-index: ${Z} !important;
        flex-direction: column !important;
        background: #F9F9F9 !important;
        border: 2px solid #670000 !important;
        border-radius: 16px !important;
        box-shadow: 0 16px 48px rgba(0,0,0,.35) !important;
        overflow: hidden !important;
        font-family: system-ui, -apple-system, sans-serif !important;
        box-sizing: border-box !important;
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
      }
      #rrhs-close:hover {
        background: rgba(255,255,255,.2) !important;
      }

      #rrhs-messages {
        flex: 1 !important;
        overflow-y: auto !important;
        padding: 16px !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 12px !important;
        min-height: 0 !important;
      }
      
      .rrhs-msg {
        max-width: 75% !important;
        padding: 12px 15px !important;
        border-radius: 14px !important;
        font-size: 14px !important;
        line-height: 1.5 !important;
        word-break: break-word !important;
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
      }
      #rrhs-send:hover {
        background: #7a0000 !important;
      }
      #rrhs-send:disabled {
        opacity: .6 !important;
      }
    `;
    document.head.appendChild(style);

    // ---------- CREATE ELEMENTS ----------
    const pill = document.createElement("div");
    pill.id = "rrhs-assistant-pill";
    pill.textContent = "Ask the Store";

    const panel = document.createElement("div");
    panel.id = "rrhs-assistant-panel";
    // Start hidden with !important
    panel.style.cssText = "display: none !important;";
    
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

    // ---------- PANEL FUNCTIONS ----------
    function openPanel() {
      console.log("[RRHS Assistant] 🟢 OPENING");
      // Set display: flex with !important
      panel.style.cssText = panel.style.cssText.replace(/display\s*:\s*[^;!]+\s*!important;?/gi, '') + " display: flex !important;";
      setTimeout(() => inputEl && inputEl.focus(), 100);
    }

    function closePanel() {
      console.log("[RRHS Assistant] 🔴 CLOSING");
      // Set display: none with !important
      panel.style.cssText = panel.style.cssText.replace(/display\s*:\s*[^;!]+\s*!important;?/gi, '') + " display: none !important;";
    }

    function togglePanel() {
      // Check computed style to see if it's actually visible
      const isVisible = window.getComputedStyle(panel).display === "flex";
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
      const isVisible = window.getComputedStyle(panel).display === "flex";
      if (!isVisible) return;
      if (panel.contains(e.target) || pill.contains(e.target)) return;
      closePanel();
    });

    // ---------- CHAT ----------
    function addMessage(role, text) {
      const bubble = document.createElement("div");
      bubble.className = `rrhs-msg ${role === "user" ? "rrhs-user" : "rrhs-bot"}`;
      bubble.textContent = text;
      messagesEl.appendChild(bubble);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function setSending(s) {
      sendBtn.disabled = s;
      inputEl.disabled = s;
      sendBtn.textContent = s ? "..." : "Send";
    }

    async function sendMessage() {
      const msg = (inputEl.value || "").trim();
      if (!msg) return;

      const isVisible = window.getComputedStyle(panel).display === "flex";
      if (!isVisible) openPanel();

      addMessage("user", msg);
      inputEl.value = "";
      setSending(true);

      try {
        const res = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${API_KEY}`,
          },
          body: JSON.stringify({ message: msg }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        addMessage("assistant", data?.message || "No response.");
      } catch (err) {
        addMessage("assistant", `Sorry – couldn't reach the assistant.\n${err}`);
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
      if (e.key === "Enter") {
        e.preventDefault();
        sendMessage();
      }
    });

    console.log("[RRHS Assistant] ✅ Ready!");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
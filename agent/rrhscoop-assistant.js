// rrhs-assistant.js
(() => {
  if (window.__RRHS_ASSISTANT__) return;
  window.__RRHS_ASSISTANT__ = true;

  const API_URL = "https://mcp-client-4sdk.onrender.com/chat";
  const API_KEY = "5e7571d3a600120047e5ce906c1bdf08f72a95b8c4d37f75cfdf847b10f79c5a";

  // --- Inject CSS (guaranteed visible) ---
  const style = document.createElement("style");
  style.id = "rrhs-assistant-style";
  style.textContent = `
    #rrhs-assistant-pill {
      position: fixed !important;
      right: 18px !important;
      bottom: 18px !important;
      z-index: 2147483647 !important;
      background: #670000 !important;
      color: #F9F9F9 !important;
      padding: 12px 14px !important;
      border-radius: 999px !important;
      font: 600 14px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif !important;
      box-shadow: 0 10px 25px rgba(0,0,0,.25) !important;
      cursor: pointer !important;
      user-select: none !important;
    }
    #rrhs-assistant-pill:hover { transform: translateY(-1px); }

    #rrhs-assistant-panel {
      position: fixed !important;
      right: 18px !important;
      bottom: 72px !important;
      width: 340px !important;
      height: 420px !important;
      z-index: 2147483647 !important;
      background: #F9F9F9 !important;
      border: 1px solid rgba(0,0,0,.12) !important;
      border-radius: 14px !important;
      box-shadow: 0 18px 45px rgba(0,0,0,.35) !important;
      overflow: hidden !important;
      display: none !important; /* hidden until clicked */
      flex-direction: column !important;
      font: 14px/1.35 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif !important;
    }

    #rrhs-assistant-header {
      background: #670000 !important;
      color: #F9F9F9 !important;
      padding: 12px 12px !important;
      font-weight: 700 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
    }

    #rrhs-messages {
      padding: 10px 10px !important;
      overflow-y: auto !important;
      flex: 1 !important;
    }

    .rrhs-msg {
      margin: 8px 0 !important;
      display: flex !important;
    }
    .rrhs-msg.user { justify-content: flex-end !important; }
    .rrhs-bubble {
      max-width: 85% !important;
      padding: 8px 10px !important;
      border-radius: 12px !important;
      white-space: pre-wrap !important;
      word-break: break-word !important;
    }
    .rrhs-msg.user .rrhs-bubble { background: #670000 !important; color: #F9F9F9 !important; }
    .rrhs-msg.bot  .rrhs-bubble { background: #ffffff !important; color: #222 !important; border: 1px solid rgba(0,0,0,.08) !important; }

    #rrhs-input-row {
      display: flex !important;
      border-top: 1px solid rgba(0,0,0,.12) !important;
      background: #fff !important;
    }
    #rrhs-input {
      flex: 1 !important;
      padding: 10px 10px !important;
      border: none !important;
      outline: none !important;
      font: inherit !important;
      background: transparent !important;
    }
    #rrhs-send {
      background: #670000 !important;
      color: #F9F9F9 !important;
      border: none !important;
      padding: 0 14px !important;
      cursor: pointer !important;
      font-weight: 700 !important;
    }
    #rrhs-send:disabled { opacity: .6 !important; cursor: not-allowed !important; }
    #rrhs-close {
      cursor: pointer !important;
      font-size: 18px !important;
      line-height: 1 !important;
      padding: 2px 6px !important;
      border-radius: 8px !important;
    }
    #rrhs-close:hover { background: rgba(255,255,255,.12) !important; }
  `;
  document.head.appendChild(style);

  // --- Build UI ---
  const pill = document.createElement("div");
  pill.id = "rrhs-assistant-pill";
  pill.textContent = "Ask the Store";

  const panel = document.createElement("div");
  panel.id = "rrhs-assistant-panel";
  panel.innerHTML = `
    <div id="rrhs-assistant-header">
      <div>Store Assistant</div>
      <div id="rrhs-close">×</div>
    </div>
    <div id="rrhs-messages"></div>
    <div id="rrhs-input-row">
      <input id="rrhs-input" placeholder="What should I buy?" />
      <button id="rrhs-send">Send</button>
    </div>
  `;

  document.body.appendChild(pill);
  document.body.appendChild(panel);

  const $messages = panel.querySelector("#rrhs-messages");
  const $input = panel.querySelector("#rrhs-input");
  const $send = panel.querySelector("#rrhs-send");
  const $close = panel.querySelector("#rrhs-close");

  function addMsg(role, text) {
    const row = document.createElement("div");
    row.className = `rrhs-msg ${role === "user" ? "user" : "bot"}`;
    const bubble = document.createElement("div");
    bubble.className = "rrhs-bubble";
    bubble.textContent = text;
    row.appendChild(bubble);
    $messages.appendChild(row);
    $messages.scrollTop = $messages.scrollHeight;
  }

  async function send() {
    const msg = ($input.value || "").trim();
    if (!msg) return;

    addMsg("user", msg);
    $input.value = "";
    $send.disabled = true;

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`
        },
        body: JSON.stringify({ message: msg })
      });

      if (!res.ok) {
        const t = await res.text();
        addMsg("bot", `Request failed (${res.status}). ${t}`);
        return;
      }

      const data = await res.json();
      addMsg("bot", data?.message || "No response text.");
    } catch (e) {
      addMsg("bot", `Network error: ${String(e)}`);
    } finally {
      $send.disabled = false;
      $input.focus();
    }
  }

  // --- Wire events ---
  pill.addEventListener("click", () => {
    const open = panel.style.display !== "flex";
    panel.style.display = open ? "flex" : "none";
    if (open) {
      if ($messages.childElementCount === 0) {
        addMsg("bot", "Hi. Tell me what you want (snack, drink, merch, supplies) and your budget.");
      }
      setTimeout(() => $input.focus(), 0);
    }
  });

  $close.addEventListener("click", () => (panel.style.display = "none"));
  $send.addEventListener("click", send);
  $input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send();
  });

  console.log("[RRHS Assistant] loaded");
})();

/* rrhscoop-custom.js */
(() => {
  /* =========================
     MODAL UTILITIES
  ========================== */
  function createModal(message) {
    // Remove existing modal if any
    const existing = document.getElementById('rrhs-error-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'rrhs-error-modal';
    modal.style.cssText = `
      position: fixed !important;
      top: 20px !important;
      left: 50% !important;
      transform: translateX(-50%) translateY(-100vh) !important;
      width: 90%;
      max-width: 600px;
      background: #670000;
      color: #EBEBE2;
      padding: 16px 20px 16px 48px;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
      z-index: 999999 !important;
      display: flex;
      align-items: center;
    `;

    modal.innerHTML = `
      <button id="rrhs-modal-close" style="
        position: absolute;
        top: 50%;
        left: 16px;
        transform: translateY(-50%);
        background: transparent;
        color: #EBEBE2;
        border: none;
        padding: 0;
        cursor: pointer;
        font-size: 20px;
        line-height: 1;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s ease, opacity 0.2s ease;
        opacity: 0.8;
      " onmouseover="this.style.transform='translateY(-50%) rotate(90deg)'; this.style.opacity='1';" 
         onmouseout="this.style.transform='translateY(-50%) rotate(0deg)'; this.style.opacity='0.8';">
        ×
      </button>
      <div style="
        font-size: 0.95em;
        font-weight: 500;
        flex: 1;
      ">${message}</div>
    `;

    document.body.appendChild(modal);

    // Trigger slide down animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        modal.style.transition = 'transform 0.4s ease';
        modal.style.transform = 'translateX(-50%) translateY(0)';
      });
    });

    // Add CSS animations
    if (!document.getElementById('rrhs-modal-styles')) {
      const style = document.createElement('style');
      style.id = 'rrhs-modal-styles';
      style.textContent = `
        #rrhs-error-modal {
          position: fixed !important;
          top: 130px !important;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
          20%, 40%, 60%, 80% { transform: translateX(8px); }
        }
      `;
      document.head.appendChild(style);
    }

    // Close handlers
    const closeModal = () => {
      modal.style.transition = 'transform 0.3s ease';
      modal.style.transform = 'translateX(-50%) translateY(-100vh)';
      setTimeout(() => modal.remove(), 300);
    };
    
    document.getElementById('rrhs-modal-close').addEventListener('click', closeModal);

    // Auto-dismiss after 5 seconds
    setTimeout(closeModal, 5000);

    return modal;
  }

  function shakeElement(element) {
    element.style.animation = 'shake 0.5s ease';
    setTimeout(() => {
      element.style.animation = '';
    }, 500);
  }

  /* =========================
     ROOM AUTOCOMPLETE
  ========================== */
  const ROOM_DATA = [
    { room: "1308", teacher: "Dinh Nguyen" },
    { room: "1309", teacher: "Katie Lawson" },
    { room: "1312", teacher: "Eric Oliver" },
    { room: "1313", teacher: "Julile Harrison" },
    { room: "1314", teacher: "Eric Chaverria" },
    { room: "1316", teacher: "Elizabeth Bell" },
    { room: "1317", teacher: "Gin Dreyer" },
    { room: "1318", teacher: "Ms. Brekke" },
    { room: "1319", teacher: "Stacey Dry" }
  ];

  function initRoomAutocomplete() {
    const input = document.querySelector('input[name="z7rty2b"]');
    if (!input || input.dataset.autocompleteInit) return;

    input.dataset.autocompleteInit = "true";

    const section = input.closest(".ec-cart-step__section");
    if (section) section.style.transition = "padding-bottom 0.2s ease";

    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";
    wrapper.style.width = "100%";
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    wrapper.style.outline = "none";
    wrapper.style.border = "none";

    const dropdown = document.createElement("div");
    dropdown.style.cssText = `
      position:absolute;top:100%;left:0;right:0;background:#fff;
      border:1px solid #ddd;border-top:none;max-height:250px;overflow-y:auto;
      z-index:999999;display:none;box-shadow:0 4px 6px rgba(0,0,0,0.1);
    `;
    wrapper.appendChild(dropdown);

    const errorMsg = document.createElement("div");
    errorMsg.style.cssText = `
      color:#d32f2f;font-size:.875em;margin-top:4px;display:none;
      outline:none!important;border:none!important;box-shadow:none!important;pointer-events:none;
    `;
    errorMsg.textContent = "We couldn't find that room. Please select a valid room from the list.";
    errorMsg.tabIndex = -1;
    wrapper.appendChild(errorMsg);

    function updateWrapperPadding(show) {
      const sec = input.closest(".ec-cart-step__section");
      if (!sec) return;
      if (show) {
        const dropdownHeight = Math.min(ROOM_DATA.length * 65, 250);
        sec.style.paddingBottom = dropdownHeight + "px";
      } else {
        sec.style.paddingBottom = "0px";
      }
    }

    function filterRooms(query) {
      const q = (query || "").toLowerCase();
      return ROOM_DATA.filter(r =>
        r.room.toLowerCase().includes(q) || r.teacher.toLowerCase().includes(q)
      );
    }

    function validateRoom(value, showError = false) {
      const v = (value || "").trim();
      const isValid = ROOM_DATA.some(r => r.room === v);
      const isPartialMatch = v && ROOM_DATA.some(r => r.room.startsWith(v));

      input.style.outline = "none";
      input.style.boxShadow = "none";
      wrapper.style.outline = "none";
      wrapper.style.boxShadow = "none";

      // Only show error if explicitly requested (on blur/submit) AND not valid AND not a partial match
      if (showError && v && !isValid && !isPartialMatch) {
        input.style.border = "2px solid #d32f2f";
        input.style.backgroundColor = "#ffebee";
        errorMsg.style.display = "block";
        return false;
      } else {
        input.style.border = "1px solid #ddd";
        input.style.backgroundColor = "";
        errorMsg.style.display = "none";
        return true;
      }
    }

    function renderDropdown(rooms) {
      if (!rooms || rooms.length === 0) {
        dropdown.style.display = "none";
        updateWrapperPadding(false);
        return;
      }

      dropdown.innerHTML = rooms.map(r => `
        <div class="room-option" data-room="${r.room}" style="padding:12px 16px;cursor:pointer;border-bottom:1px solid #f0f0f0;">
          <div style="font-weight:600;margin-bottom:2px;">Room ${r.room}</div>
          <div style="font-size:.9em;color:#666;">${r.teacher}</div>
        </div>
      `).join("");

      dropdown.style.display = "block";
      updateWrapperPadding(true);

      dropdown.querySelectorAll(".room-option").forEach(opt => {
        opt.addEventListener("mouseenter", () => (opt.style.backgroundColor = "#f5f5f5"));
        opt.addEventListener("mouseleave", () => (opt.style.backgroundColor = "white"));
        opt.addEventListener("click", () => {
          const room = opt.dataset.room || "";
          input.value = room;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          dropdown.style.display = "none";
          updateWrapperPadding(false);
          validateRoom(room);
        });
      });
    }

    input.addEventListener("input", (e) => {
      const val = e.target.value || "";
      validateRoom(val, false); // Don't show error while typing
      renderDropdown(val.length === 0 ? ROOM_DATA : filterRooms(val));
    });

    input.addEventListener("focus", () => {
      validateRoom(input.value, false); // Don't show error on focus
      renderDropdown((input.value || "").length === 0 ? ROOM_DATA : filterRooms(input.value));
    });

    input.addEventListener("blur", () => validateRoom(input.value, true)); // Show error on blur if invalid

    document.addEventListener("click", (e) => {
      if (!wrapper.contains(e.target)) {
        dropdown.style.display = "none";
        updateWrapperPadding(false);
      }
    });

    validateRoom(input.value);
  }

  /* =========================
     ROOM CONTINUE BUTTON VALIDATION
  ========================== */
  function initRoomContinueButton() {
    const continueBtn = document.querySelector('.form-control--button button.form-control__button');
    if (!continueBtn || continueBtn.dataset.rrhsValidation) return;

    continueBtn.dataset.rrhsValidation = "true";

    continueBtn.addEventListener('click', (e) => {
      const input = document.querySelector('input[name="z7rty2b"]');
      if (!input) return;

      const value = (input.value || "").trim();
      const isValid = ROOM_DATA.some(r => r.room === value);

      if (!isValid) {
        e.preventDefault();
        e.stopPropagation();
        shakeElement(continueBtn);
        
        // Show validation error on the input
        const wrapper = input.parentElement;
        const errorMsg = wrapper ? wrapper.querySelector('div[style*="color: rgb(211, 47, 47)"]') : null;
        if (errorMsg) errorMsg.style.display = "block";
        input.style.border = "2px solid #d32f2f";
        input.style.backgroundColor = "#ffebee";
        
        createModal('Please enter a valid room number from the list.');
      }
    });
  }

  /* =========================
     CATEGORY IMAGE SWAP - STABLE OVERLAY APPROACH
  ========================== */
  const BASE = "https://jocular-daifuku-5201aa.netlify.app";
  const IMAGE_MAP = {
    "ins-tile__category-item-169641499": `${BASE}/snack.png?v=2`,
    "ins-tile__category-item-169641959": `${BASE}/beverage.png?v=2`,
    "ins-tile__category-item-189782257": `${BASE}/merch.png?v=2`,
    "ins-tile__category-item-194772751": `${BASE}/supplies.png?v=2`
  };

  const preloadedImages = {};
  Object.values(IMAGE_MAP).forEach(url => {
    if (!preloadedImages[url]) {
      const img = new Image();
      img.src = url;
      preloadedImages[url] = img;
    }
  });

  function findTileRoot() {
    for (const id in IMAGE_MAP) {
      const el = document.getElementById(id);
      if (el) {
        return el.closest(".ins-tile__category-collection");
      }
    }
    return null;
  }

  function createOverlayImage(container) {
    const overlay = document.createElement("img");
    overlay.style.cssText = `
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      pointer-events: none !important;
      transition: opacity 50ms ease !important;
      opacity: 0 !important;
      z-index: 999 !important;
      display: block !important;
    `;
    overlay.dataset.rrhsOverlay = "1";
    overlay.alt = "Category image";
    return overlay;
  }

  function initCategoryImageSwap() {
    const root = findTileRoot();
    if (!root) return;

    const existingOverlay = root.querySelector('img[data-rrhs-overlay="1"]');
    if (existingOverlay && existingOverlay.parentNode) return;
    
    root.dataset.imgSwapInit = "1";

    let container = root.querySelector(".ins-tile__category-image");
    if (!container) {
      container = root.querySelector(".ins-tile__image");
    }
    if (!container) {
      const picture = root.querySelector("picture");
      if (picture) container = picture.parentElement;
    }
    
    const wrap = root.querySelector(".ins-tile__category-items-wrapper");
    
    if (!container || !wrap) return;

    const position = getComputedStyle(container).position;
    if (position === "static") {
      container.style.position = "relative";
    }
    container.style.overflow = "hidden";

    const overlay = createOverlayImage(container);
    container.appendChild(overlay);

    container.querySelectorAll("picture").forEach(pic => {
      pic.style.cssText = "opacity: 0 !important; pointer-events: none !important; position: absolute !important;";
    });
    
    container.querySelectorAll("img").forEach(img => {
      if (img !== overlay) {
        img.style.cssText = "opacity: 0 !important; pointer-events: none !important;";
      }
    });

    let currentUrl = null;

    const setImage = (url) => {
      if (!url || currentUrl === url) return;
      currentUrl = url;
      
      overlay.style.opacity = "0";
      
      setTimeout(() => {
        overlay.src = url;
        requestAnimationFrame(() => {
          overlay.style.opacity = "1";
        });
      }, 50);
    };

    const active = root.querySelector(".ins-tile__category-item--active");
    let initialItem = active;
    
    if (!initialItem || !IMAGE_MAP[initialItem.id]) {
      for (const id in IMAGE_MAP) {
        const el = document.getElementById(id);
        if (el) {
          initialItem = el;
          break;
        }
      }
    }
    
    if (initialItem && IMAGE_MAP[initialItem.id]) {
      overlay.src = IMAGE_MAP[initialItem.id];
      overlay.style.opacity = "1";
      currentUrl = IMAGE_MAP[initialItem.id];
    }

    const handler = (e) => {
      const item = e.target.closest(".ins-tile__category-item");
      if (!item || !wrap.contains(item)) return;
      const url = IMAGE_MAP[item.id];
      if (url) {
        setImage(url);
      }
    };

    wrap.addEventListener("mouseover", handler);
    wrap.addEventListener("focusin", handler);
  }

  /* =========================
     CHECKOUT BUTTON TIME RESTRICTION
  ========================== */
  const CHECKOUT_ALWAYS_ALLOW = false;

  // A-DAY / B-DAY CONFIGURATION
  // Set this to a known A-day date (format: 'YYYY-MM-DD')
  const REFERENCE_A_DAY = '2026-01-27'; // Monday, Jan 27, 2026 is an A-day
  
  function isADay() {
    const now = new Date();
    const referenceDate = new Date(REFERENCE_A_DAY + 'T00:00:00');
    
    // Reset both dates to midnight for accurate day counting
    now.setHours(0, 0, 0, 0);
    referenceDate.setHours(0, 0, 0, 0);
    
    // Calculate days since reference, skipping weekends
    let dayCount = 0;
    const current = new Date(referenceDate);
    
    while (current < now) {
      current.setDate(current.getDate() + 1);
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        dayCount++;
      }
    }
    
    // If reference was A-day, even count = A-day, odd = B-day
    return dayCount % 2 === 0;
  }

  function checkOrderingWindow() {
    if (CHECKOUT_ALWAYS_ALLOW) return true;
    const now = new Date();
    const day = now.getDay();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const timeInMinutes = hours * 60 + minutes;

    // No ordering on weekends
    if (day === 0 || day === 6) return false;

    // Only accept orders on A-days during both time windows
    if (!isADay()) return false;
    
    // A-day time windows:
    // Window 1: 9:00 AM - 10:20 AM (540-620 minutes)
    // Window 2: 10:50 AM - 11:55 AM (650-715 minutes)
    const inWindow1 = timeInMinutes >= 540 && timeInMinutes <= 620;
    const inWindow2 = timeInMinutes >= 650 && timeInMinutes <= 715;
    
    return inWindow1 || inWindow2;
  }

  function manageCheckoutButton() {
    const button = document.querySelector('.ec-cart__button--checkout button');
    if (!button) return;

    const isAllowed = checkOrderingWindow();
    
    if (isAllowed) {
      button.disabled = false;
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
      button.title = '';
      
      // Remove click handler if exists
      if (button.dataset.rrhsClickHandler) {
        button.removeEventListener('click', button._rrhsClickHandler);
        delete button.dataset.rrhsClickHandler;
        delete button._rrhsClickHandler;
      }
    } else {
      button.disabled = true;
      button.style.opacity = '0.5';
      button.style.cursor = 'not-allowed';
      button.title = 'We\'re sorry, we do not accept orders at this time.';
      
      // Add click handler only once - exactly like room validation
      if (!button.dataset.rrhsClickHandler) {
        button.dataset.rrhsClickHandler = "true";
        button._rrhsClickHandler = (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          shakeElement(button);
          createModal('We\'re sorry, we do not accept orders at this time.');
          return false;
        };
        // Add listener with capture to intercept before disabled state blocks it
        button.addEventListener('click', button._rrhsClickHandler, true);
      }
    }
  }

  /* =========================
     CHECKOUT BUTTON WRAPPER (to capture clicks on disabled button)
  ========================== */
  function wrapCheckoutButton() {
    const button = document.querySelector('.ec-cart__button--checkout button');
    if (!button || button.dataset.rrhsWrapped) return;

    const parent = button.parentElement;
    if (!parent) return;

    // Create wrapper div
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position: relative; display: inline-block; width: 100%;';
    wrapper.dataset.rrhsWrapper = 'true';

    // Insert wrapper
    parent.insertBefore(wrapper, button);
    wrapper.appendChild(button);

    // Create invisible overlay for capturing clicks when disabled
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 10;
      cursor: not-allowed;
      display: none;
    `;
    overlay.dataset.rrhsOverlayBtn = 'true';
    wrapper.appendChild(overlay);

    // Handle clicks on overlay
    overlay.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      shakeElement(button);
      createModal('We\'re sorry, we do not accept orders at this time.');
    });

    button.dataset.rrhsWrapped = 'true';
  }

  function updateCheckoutOverlay() {
    const button = document.querySelector('.ec-cart__button--checkout button');
    const overlay = document.querySelector('[data-rrhs-overlay-btn="true"]');
    
    if (!button || !overlay) return;

    const isAllowed = checkOrderingWindow();
    
    if (isAllowed) {
      overlay.style.display = 'none';
    } else {
      overlay.style.display = 'block';
    }
  }

  /* =========================
     BOOTSTRAP (rerender-safe)
  ========================== */
  function boot() {
    initRoomAutocomplete();
    initRoomContinueButton();
    initCategoryImageSwap();
    wrapCheckoutButton();
    manageCheckoutButton();
    updateCheckoutOverlay();
  }

  boot();

  const observer = new MutationObserver(boot);
  observer.observe(document.body, { childList: true, subtree: true });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  }

  setInterval(() => {
    manageCheckoutButton();
    updateCheckoutOverlay();
  }, 60000);
})();
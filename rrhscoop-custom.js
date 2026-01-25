/* rrhscoop-custom.js */
(() => {
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
    errorMsg.textContent = "Please select a valid room number from the list";
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

    function validateRoom(value) {
      const v = (value || "").trim();
      const isValid = ROOM_DATA.some(r => r.room === v);

      input.style.outline = "none";
      input.style.boxShadow = "none";
      wrapper.style.outline = "none";
      wrapper.style.boxShadow = "none";

      if (v && !isValid) {
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
      validateRoom(val);
      renderDropdown(val.length === 0 ? ROOM_DATA : filterRooms(val));
    });

    input.addEventListener("focus", () => {
      validateRoom(input.value);
      renderDropdown((input.value || "").length === 0 ? ROOM_DATA : filterRooms(input.value));
    });

    input.addEventListener("blur", () => validateRoom(input.value));

    document.addEventListener("click", (e) => {
      if (!wrapper.contains(e.target)) {
        dropdown.style.display = "none";
        updateWrapperPadding(false);
      }
    });

    validateRoom(input.value);
  }

  /* =========================
     CATEGORY IMAGE SWAP - STABLE OVERLAY APPROACH
     - Creates a single overlay image that crossfades
     - No DOM manipulation of original pictures
     - Preloads all images to prevent flicker
     ========================== */

  const BASE = "https://jocular-daifuku-5201aa.netlify.app";
  const IMAGE_MAP = {
    "ins-tile__category-item-169641499": `${BASE}/snack.png?v=2`,
    "ins-tile__category-item-169641959": `${BASE}/beverage.png?v=2`,
    "ins-tile__category-item-189782257": `${BASE}/merch.png?v=2`,
    "ins-tile__category-item-194772751": `${BASE}/supplies.png?v=2`
  };

  // Preload all images immediately
  const preloadedImages = {};
  Object.values(IMAGE_MAP).forEach(url => {
    if (!preloadedImages[url]) {
      const img = new Image();
      img.src = url;
      preloadedImages[url] = img;
      console.log("RRHS: Preloading", url);
    }
  });

  function findTileRoot() {
    for (const id in IMAGE_MAP) {
      const el = document.getElementById(id);
      if (el) {
        console.log("RRHS: Found tile element", id);
        return el.closest(".ins-tile__category-collection");
      }
    }
    console.warn("RRHS: No tile elements found");
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
    if (!root) {
      console.warn("RRHS: Tile root not found");
      return; 
    }

    // Don't skip if already initialized - we need to check if our overlay still exists
    const existingOverlay = root.querySelector('img[data-rrhs-overlay="1"]');
    if (existingOverlay && existingOverlay.parentNode) {
      console.log("RRHS: Overlay still exists, skipping re-init");
      return;
    }
    
    console.log("RRHS: Overlay missing or removed, re-initializing");
    root.dataset.imgSwapInit = "1";

    // Try multiple possible selectors for the image container
    // IMPORTANT: We want .ins-tile__category-image NOT .ins-tile__category-image-wrapper
    let container = root.querySelector(".ins-tile__category-image");
    if (!container) {
      container = root.querySelector(".ins-tile__image");
    }
    if (!container) {
      // Last resort: find any element with a picture tag
      const picture = root.querySelector("picture");
      if (picture) container = picture.parentElement;
    }
    
    const wrap = root.querySelector(".ins-tile__category-items-wrapper");
    
    if (!container || !wrap) {
      console.warn("RRHS: Container or wrapper not found", { 
        container, 
        wrap,
        allClasses: root.innerHTML.match(/class="[^"]+"/g)
      });
      return;
    }

    console.log("RRHS: Initializing image swap", { container, wrap });

    // Make container position relative for overlay and ensure it's a positioning context
    const position = getComputedStyle(container).position;
    if (position === "static") {
      container.style.position = "relative";
    }
    container.style.overflow = "hidden";
    
    // Log container dimensions to debug
    const rect = container.getBoundingClientRect();
    console.log("RRHS: Container dimensions", { 
      width: rect.width, 
      height: rect.height,
      position: getComputedStyle(container).position 
    });

    // Create single overlay image
    const overlay = createOverlayImage(container);
    container.appendChild(overlay);
    console.log("RRHS: Overlay created and appended", overlay);

    // Hide all original picture elements so only overlay shows - use !important to prevent override
    container.querySelectorAll("picture").forEach(pic => {
      pic.style.cssText = "opacity: 0 !important; pointer-events: none !important; position: absolute !important;";
    });
    
    // Also hide any img elements that aren't our overlay
    container.querySelectorAll("img").forEach(img => {
      if (img !== overlay) {
        img.style.cssText = "opacity: 0 !important; pointer-events: none !important;";
      }
    });

    let currentUrl = null;

    const setImage = (url) => {
      if (!url || currentUrl === url) return;
      console.log("RRHS: Setting image to", url);
      currentUrl = url;
      
      // Quick fade out
      overlay.style.opacity = "0";
      
      // Wait for fade out, then swap
      setTimeout(() => {
        overlay.src = url;
        // Fade in immediately (image is preloaded)
        requestAnimationFrame(() => {
          overlay.style.opacity = "1";
        });
      }, 50);
    };

    // Set initial image - try active item first, then fall back to first item
    const active = root.querySelector(".ins-tile__category-item--active");
    let initialItem = active;
    
    if (!initialItem || !IMAGE_MAP[initialItem.id]) {
      // No active item, use first mapped item
      for (const id in IMAGE_MAP) {
        const el = document.getElementById(id);
        if (el) {
          initialItem = el;
          break;
        }
      }
    }
    
    if (initialItem && IMAGE_MAP[initialItem.id]) {
      console.log("RRHS: Setting initial image", initialItem.id, IMAGE_MAP[initialItem.id]);
      overlay.src = IMAGE_MAP[initialItem.id];
      overlay.style.opacity = "1";
      currentUrl = IMAGE_MAP[initialItem.id];
    } else {
      console.log("RRHS: No initial item found or no mapped image");
    }

    // Handle hover/focus
    const handler = (e) => {
      const item = e.target.closest(".ins-tile__category-item");
      if (!item || !wrap.contains(item)) return;
      const url = IMAGE_MAP[item.id];
      if (url) {
        console.log("RRHS: Hover detected", item.id);
        setImage(url);
      }
    };

    wrap.addEventListener("mouseover", handler);
    wrap.addEventListener("focusin", handler);
    console.log("RRHS: Event listeners attached");
  }

  /* =========================
     BOOTSTRAP (rerender-safe)
     ========================== */

  function boot() {
    initRoomAutocomplete();
    initCategoryImageSwap();
  }

  boot();

  const observer = new MutationObserver(boot);
  observer.observe(document.body, { childList: true, subtree: true });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  }
})();

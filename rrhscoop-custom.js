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
     CATEGORY IMAGE SWAP
     - Updates BOTH "full" and "thumb" pictures under .ins-tile__category-image
  ========================== */
  const BASE = "https://jocular-daifuku-5201aa.netlify.app";
  const IMAGE_MAP = {
    "ins-tile__category-item-169641499": `${BASE}/snack.png?v=1`,
    "ins-tile__category-item-169641959": `${BASE}/beverage.png?v=1`,
    "ins-tile__category-item-189782257": `${BASE}/merch.png?v=1`,
    "ins-tile__category-item-194772751": `${BASE}/supplies.png?v=1`
  };



  function setPicture(pictureEl, url) {
    if (!pictureEl || !url) return;
    pictureEl.querySelectorAll("source").forEach(s => {
      const srcset = s.getAttribute("srcset") || "";
      s.setAttribute("srcset", srcset.includes("2x") ? `${url}, ${url} 2x` : url);
    });
    const img = pictureEl.querySelector("img");
    if (img) img.src = url;
  }

  function setAllTilePictures(tileRoot, url) {
    if (!tileRoot || !url) return;
    const container = tileRoot.querySelector(".ins-tile__category-image");
    if (!container) return;
    container.querySelectorAll("picture").forEach(p => setPicture(p, url));
  }

  function findTileRoot() {
    for (const id in IMAGE_MAP) {
      const el = document.getElementById(id);
      if (el) return el.closest(".ins-tile__category-collection");
    }
    return null;
  }

  function initCategoryImageSwap() {
    const root = findTileRoot();
    if (!root || root.dataset.imgSwapInit === "1") return;
    root.dataset.imgSwapInit = "1";

    const wrap = root.querySelector(".ins-tile__category-items-wrapper");
    if (!wrap) return;

    const apply = (item) => {
      const url = IMAGE_MAP[item?.id];
      if (url) setAllTilePictures(root, url);
    };

    const active = root.querySelector(".ins-tile__category-item--active");
    if (active) apply(active);

    const handler = (e) => {
      const item = e.target.closest(".ins-tile__category-item");
      if (!item || !wrap.contains(item)) return;
      if (IMAGE_MAP[item.id]) apply(item);
    };

    wrap.addEventListener("mouseover", handler);
    wrap.addEventListener("focusin", handler);
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

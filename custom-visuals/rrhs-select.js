/* rrhs-select.js - themed, animated option menu for Ecwid product dropdowns
 *
 * Ecwid's product option field (e.g. Color) is left exactly as Ecwid renders it.
 * Only the menu that opens is replaced: instead of the OS-level picker, clicking
 * the field (or pressing Space/Enter/Arrow keys on it) opens an RRHS-styled menu
 * directly beneath it. Choosing an option sets the native <select> value and
 * dispatches input/change, so Ecwid updates price, variations, and validation.
 *
 * The menu is attached to <body> with fixed positioning so storefront CSS,
 * overflow, or transforms on ancestors can't displace it.
 */
(function () {
  if (window.__rrhsSelectInstalled) return;
  window.__rrhsSelectInstalled = true;

  const SELECT_SELECTOR = ".product-details select.form-control__select";
  const STYLE_ID = "rrhs-select-styles";
  const GAP = 6;
  const MIN_WIDTH = 220;
  const enhanced = new WeakSet();
  let uid = 0;
  let current = null; // the open menu, if any

  const CHECK =
    '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">' +
    '<path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      [data-rrhs-select="1"] select.form-control__select { pointer-events: none; }
      [data-rrhs-select="1"] { cursor: pointer; }
      .rrhs-select-menu {
        --rs-maroon: var(--rrhs-maroon, #6e1f2a);
        --rs-ink: var(--rrhs-ink, #141414);
        --rs-cream: var(--rrhs-cream, #f1eee8);
        --rs-ease: var(--rrhs-motion-standard, cubic-bezier(.22, 1, .36, 1));
        position: fixed !important; z-index: 2147483000 !important;
        box-sizing: border-box; margin: 0; padding: 6px;
        max-height: min(320px, 60vh); overflow-y: auto; overscroll-behavior: contain;
        border: 1px solid rgba(20, 20, 20, .14); border-radius: 0; background: #fff;
        box-shadow: 0 18px 40px rgba(20, 10, 10, .16), 0 2px 6px rgba(20, 10, 10, .06);
        font-family: var(--rrhs-font-body, "Spectral", Georgia, serif);
        opacity: 0; transform: translateY(-6px) scale(.98); transform-origin: top center;
        transition: opacity .14s ease-in, transform .14s ease-in;
      }
      .rrhs-select-menu.opens-up { transform: translateY(6px) scale(.98); transform-origin: bottom center; }
      .rrhs-select-menu.is-open {
        opacity: 1; transform: none;
        transition: opacity .2s var(--rs-ease), transform .22s var(--rs-ease);
      }
      .rrhs-select-menu *, .rrhs-select-menu *::before, .rrhs-select-menu *::after { box-sizing: border-box; }
      .rrhs-select-menu__option {
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
        min-height: 44px; margin: 0; padding: 10px 12px; border-radius: 0;
        color: var(--rs-ink); font-size: 16px; font-weight: 400; line-height: 1.3;
        cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent;
        transition: background-color .14s ease, color .14s ease;
      }
      .rrhs-select-menu.is-open .rrhs-select-menu__option {
        animation: rrhsSelectOptionIn .22s var(--rs-ease) both;
        animation-delay: calc(var(--i, 0) * 30ms);
      }
      .rrhs-select-menu__option.is-active { background: var(--rs-cream); }
      .rrhs-select-menu__option[aria-selected="true"] { color: var(--rs-maroon); font-weight: 600; }
      .rrhs-select-menu__option[aria-disabled="true"] { opacity: .45; cursor: not-allowed; }
      .rrhs-select-menu__check {
        display: grid; place-items: center; color: var(--rs-maroon);
        opacity: 0; transform: scale(.6); transition: opacity .16s ease, transform .2s var(--rs-ease);
      }
      .rrhs-select-menu__option[aria-selected="true"] .rrhs-select-menu__check { opacity: 1; transform: none; }
      @keyframes rrhsSelectOptionIn {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: none; }
      }
      @media (prefers-reduced-motion: reduce) {
        .rrhs-select-menu, .rrhs-select-menu.opens-up, .rrhs-select-menu.is-open { transform: none; transition: opacity .01s; }
        .rrhs-select-menu.is-open .rrhs-select-menu__option { animation: none; }
        .rrhs-select-menu__check { transition: none; }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function isPlaceholder(option) {
    return !option.hasAttribute("value") || option.value === "";
  }

  function optionText(option) {
    return option.label || option.text;
  }

  /* ---------- the open menu ---------- */

  function openMenu(select, anchor) {
    if (current && current.select === select) return;
    closeMenu(false);
    if (select.disabled) return;

    const opts = Array.from(select.options).filter((o) => !isPlaceholder(o));
    if (!opts.length) return;

    const id = "rrhs-select-menu-" + ++uid;
    const menu = document.createElement("div");
    menu.className = "rrhs-select-menu";
    menu.id = id;
    menu.setAttribute("role", "listbox");
    menu.setAttribute("aria-label", select.getAttribute("aria-label") || "Options");

    const items = opts.map((option, i) => {
      const el = document.createElement("div");
      el.className = "rrhs-select-menu__option";
      el.id = `${id}-${i}`;
      el.setAttribute("role", "option");
      el.setAttribute("aria-selected", option.selected ? "true" : "false");
      if (option.disabled) el.setAttribute("aria-disabled", "true");
      el.style.setProperty("--i", String(Math.min(i, 8)));
      const text = document.createElement("span");
      text.textContent = optionText(option);
      const check = document.createElement("span");
      check.className = "rrhs-select-menu__check";
      check.innerHTML = CHECK;
      el.append(text, check);
      el.addEventListener("mousedown", (e) => e.preventDefault()); // keep focus on the select
      el.addEventListener("click", () => choose(i));
      el.addEventListener("pointermove", () => setActive(i, false));
      menu.appendChild(el);
      return { el, option };
    });

    document.body.appendChild(menu);
    select.setAttribute("aria-expanded", "true");
    select.setAttribute("aria-controls", id);

    const state = { select, anchor, menu, items, active: -1, typeBuffer: "", typeTimer: null };
    current = state;

    position();
    const selectedIdx = items.findIndex((it) => it.option.selected);
    setActive(selectedIdx >= 0 ? selectedIdx : 0);
    // position() already read layout, so the closed state is committed and the
    // enter transition runs when the open class is added.
    void menu.offsetWidth;
    menu.classList.add("is-open");
  }

  function position() {
    if (!current) return;
    const { anchor, menu } = current;
    const rect = anchor.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return closeMenu(false);

    const width = Math.max(rect.width, MIN_WIDTH);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    menu.style.width = width + "px";
    menu.style.left = left + "px";

    const menuHeight = menu.offsetHeight;
    const below = window.innerHeight - rect.bottom - GAP - 8;
    const above = rect.top - GAP - 8;
    const up = menuHeight > below && above > below;
    menu.classList.toggle("opens-up", up);
    if (up) {
      menu.style.top = "";
      menu.style.bottom = window.innerHeight - rect.top + GAP + "px";
      menu.style.maxHeight = Math.min(320, above) + "px";
    } else {
      menu.style.bottom = "";
      menu.style.top = rect.bottom + GAP + "px";
      menu.style.maxHeight = Math.min(320, Math.max(below, 120)) + "px";
    }
  }

  function setActive(i, scroll = true) {
    if (!current || !current.items.length) return;
    const { items, select } = current;
    current.active = Math.max(0, Math.min(items.length - 1, i));
    items.forEach((it, idx) => it.el.classList.toggle("is-active", idx === current.active));
    const el = items[current.active].el;
    select.setAttribute("aria-activedescendant", el.id);
    if (scroll) el.scrollIntoView({ block: "nearest" });
  }

  function choose(i) {
    if (!current) return;
    const item = current.items[i];
    if (!item || item.option.disabled) return;
    const select = current.select;
    if (select.value !== item.option.value) {
      select.value = item.option.value;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    closeMenu(true);
  }

  function closeMenu(refocus) {
    if (!current) return;
    const { menu, select, typeTimer } = current;
    current = null;
    clearTimeout(typeTimer);
    select.setAttribute("aria-expanded", "false");
    select.removeAttribute("aria-activedescendant");
    select.removeAttribute("aria-controls");
    menu.classList.remove("is-open");
    const remove = () => menu.remove();
    menu.addEventListener("transitionend", remove, { once: true });
    setTimeout(remove, 200);
    if (refocus && select.isConnected) select.focus({ preventScroll: true });
  }

  function typeahead(char) {
    const state = current;
    clearTimeout(state.typeTimer);
    state.typeBuffer += char.toLowerCase();
    state.typeTimer = setTimeout(() => (state.typeBuffer = ""), 600);
    const start = state.typeBuffer.length === 1 ? state.active + 1 : state.active;
    for (let n = 0; n < state.items.length; n++) {
      const idx = (start + n) % state.items.length;
      if (optionText(state.items[idx].option).toLowerCase().startsWith(state.typeBuffer)) {
        setActive(idx);
        return;
      }
    }
  }

  /* ---------- wiring each Ecwid field ---------- */

  function enhance(select) {
    enhanced.add(select);
    const anchor = select.closest(".form-control") || select;
    anchor.setAttribute("data-rrhs-select", "1");
    select.setAttribute("aria-haspopup", "listbox");
    select.setAttribute("aria-expanded", "false");

    // The select ignores pointer events (CSS above), so clicks land on the
    // field wrapper and the OS picker never opens.
    anchor.addEventListener("click", (e) => {
      if (current && current.menu.contains(e.target)) return;
      e.preventDefault();
      if (current && current.select === select) closeMenu(true);
      else {
        select.focus({ preventScroll: true });
        openMenu(select, anchor);
      }
    });

    // Keep focus on the select when the field is pressed, so blur doesn't close the menu mid-click.
    anchor.addEventListener("mousedown", (e) => e.preventDefault());
    select.addEventListener("keydown", (e) => {
      const isOpen = current && current.select === select;
      if (!isOpen) {
        if ([" ", "Enter", "ArrowDown", "ArrowUp"].includes(e.key)) {
          e.preventDefault();
          openMenu(select, anchor);
        }
        return;
      }
      switch (e.key) {
        case "ArrowDown": e.preventDefault(); setActive(current.active + 1); break;
        case "ArrowUp": e.preventDefault(); setActive(current.active - 1); break;
        case "Home": e.preventDefault(); setActive(0); break;
        case "End": e.preventDefault(); setActive(current.items.length - 1); break;
        case "Enter":
        case " ": e.preventDefault(); choose(current.active); break;
        case "Escape": e.preventDefault(); closeMenu(true); break;
        case "Tab": closeMenu(false); break;
        default:
          if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            typeahead(e.key);
          }
      }
    });
    select.addEventListener("blur", () => {
      if (current && current.select === select) closeMenu(false);
    });
  }

  document.addEventListener(
    "pointerdown",
    (e) => {
      if (!current) return;
      if (current.menu.contains(e.target) || current.anchor.contains(e.target)) return;
      closeMenu(false);
    },
    true
  );
  window.addEventListener("resize", position);
  window.addEventListener("scroll", position, true);

  function scan() {
    if (current && !current.select.isConnected) closeMenu(false);
    const selects = document.querySelectorAll(SELECT_SELECTOR);
    if (!selects.length) return;
    ensureStyles();
    selects.forEach((select) => {
      if (!enhanced.has(select)) enhance(select);
    });
  }

  const runtime = window.RRHS_RUNTIME;
  if (runtime && typeof runtime.onDomChanged === "function") runtime.onDomChanged(scan);
  else if (typeof MutationObserver !== "undefined") {
    new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  }
  scan();
})();

/* rrhs-select.js - themed, animated replacement for Ecwid product option dropdowns
 *
 * Ecwid renders product options (e.g. Color) as a native <select>, which opens
 * the OS-level picker. This script hides that control and renders an RRHS-styled
 * listbox in its place. The native <select> stays in the DOM as the source of
 * truth: picking an option sets its value and dispatches change/input so Ecwid
 * updates price, variations, and validation exactly as before.
 */
(function () {
  if (window.__rrhsSelectInstalled) return;
  window.__rrhsSelectInstalled = true;

  const SELECT_SELECTOR = ".product-details select.form-control__select";
  const STYLE_ID = "rrhs-select-styles";
  const uis = new Map(); // select -> ui
  let uid = 0;

  const CHEVRON =
    '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">' +
    '<path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const CHECK =
    '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">' +
    '<path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .rrhs-native-select-hidden {
        position: absolute !important; width: 1px !important; height: 1px !important;
        margin: -1px !important; padding: 0 !important; overflow: hidden !important;
        clip: rect(0 0 0 0) !important; clip-path: inset(50%) !important;
        border: 0 !important; white-space: nowrap !important;
      }
      .rrhs-select {
        --rs-maroon: var(--rrhs-maroon, #6e1f2a);
        --rs-ink: var(--rrhs-ink, #141414);
        --rs-paper: var(--rrhs-paper, #faf8f4);
        --rs-cream: var(--rrhs-cream, #f1eee8);
        --rs-line: rgba(20, 20, 20, .18);
        --rs-muted: #6b625e;
        --rs-ease: var(--rrhs-motion-standard, cubic-bezier(.22, 1, .36, 1));
        position: relative; width: 100%;
        font-family: var(--rrhs-font-body, "Spectral", Georgia, serif);
      }
      .rrhs-select, .rrhs-select *, .rrhs-select *::before, .rrhs-select *::after { box-sizing: border-box; }
      .rrhs-select__trigger {
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
        width: 100%; min-height: 48px; margin: 0; padding: 11px 14px 11px 16px;
        border: 1px solid var(--rs-line); border-radius: 10px;
        color: var(--rs-ink); background: var(--rs-paper);
        font-family: inherit; font-size: 16px; font-weight: 500; line-height: 1.3; text-align: left;
        cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent;
        transition: border-color .18s ease, box-shadow .18s ease, background-color .18s ease;
      }
      .rrhs-select__trigger:hover { border-color: var(--rs-maroon); }
      .rrhs-select__trigger:focus { outline: none; }
      .rrhs-select__trigger:focus-visible {
        border-color: var(--rs-maroon);
        box-shadow: 0 0 0 3px rgba(110, 31, 42, .22);
      }
      .rrhs-select.is-open .rrhs-select__trigger {
        border-color: var(--rs-maroon); background: #fff;
        box-shadow: 0 0 0 3px rgba(110, 31, 42, .12);
      }
      .rrhs-select.is-error .rrhs-select__trigger { border-color: #b3261e; }
      .rrhs-select__value { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
      .rrhs-select__value.is-placeholder { color: var(--rs-muted); font-weight: 400; }
      .rrhs-select__chevron {
        flex: 0 0 auto; display: grid; place-items: center; color: var(--rs-maroon);
        transition: transform .24s var(--rs-ease);
      }
      .rrhs-select.is-open .rrhs-select__chevron { transform: rotate(180deg); }

      .rrhs-select__panel {
        position: absolute; left: 0; right: 0; top: calc(100% + 6px); z-index: 1000;
        margin: 0; padding: 6px; list-style: none;
        max-height: min(320px, 60vh); overflow-y: auto; overscroll-behavior: contain;
        border: 1px solid var(--rs-line); border-radius: 12px; background: #fff;
        box-shadow: 0 18px 40px rgba(20, 10, 10, .16), 0 2px 6px rgba(20, 10, 10, .06);
        opacity: 0; visibility: hidden; pointer-events: none;
        transform: translateY(-6px) scale(.98); transform-origin: top center;
        transition: opacity .14s ease-in, transform .14s ease-in, visibility 0s linear .14s;
      }
      .rrhs-select.opens-up .rrhs-select__panel {
        top: auto; bottom: calc(100% + 6px); transform-origin: bottom center;
        transform: translateY(6px) scale(.98);
      }
      .rrhs-select.is-open .rrhs-select__panel {
        opacity: 1; visibility: visible; pointer-events: auto; transform: none;
        transition: opacity .2s var(--rs-ease), transform .22s var(--rs-ease), visibility 0s;
      }
      .rrhs-select__panel:focus { outline: none; }
      .rrhs-select__option {
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
        min-height: 44px; padding: 10px 12px; border-radius: 8px;
        color: var(--rs-ink); font-size: 16px; line-height: 1.3; cursor: pointer;
        transition: background-color .14s ease, color .14s ease;
      }
      .rrhs-select.is-open .rrhs-select__option {
        animation: rrhsSelectOptionIn .22s var(--rs-ease) both;
        animation-delay: calc(var(--i, 0) * 30ms);
      }
      .rrhs-select__option.is-active { background: var(--rs-cream); }
      .rrhs-select__option[aria-selected="true"] { color: var(--rs-maroon); font-weight: 600; }
      .rrhs-select__option[aria-disabled="true"] { opacity: .45; cursor: not-allowed; }
      .rrhs-select__check { display: grid; place-items: center; opacity: 0; transform: scale(.6);
        transition: opacity .16s ease, transform .2s var(--rs-ease); }
      .rrhs-select__option[aria-selected="true"] .rrhs-select__check { opacity: 1; transform: none; }
      @keyframes rrhsSelectOptionIn {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: none; }
      }
      @media (prefers-reduced-motion: reduce) {
        .rrhs-select__panel, .rrhs-select.is-open .rrhs-select__panel,
        .rrhs-select.opens-up .rrhs-select__panel { transform: none; transition: opacity .01s; }
        .rrhs-select.is-open .rrhs-select__option { animation: none; }
        .rrhs-select__chevron, .rrhs-select__check { transition: none; }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function isPlaceholder(option) {
    return !option.hasAttribute("value") || option.value === "";
  }

  function labelFor(select) {
    const own = select.getAttribute("aria-label");
    if (own) return own;
    const option = select.closest(".details-product-option, .product-details-module");
    const title = option && option.querySelector(".details-product-option__title, .product-details-module__title");
    return title ? title.textContent.trim() : "Option";
  }

  function enhance(select) {
    const wrapper = select.closest(".form-control") || select;
    const id = "rrhs-select-" + ++uid;

    const root = document.createElement("div");
    root.className = "rrhs-select";
    root.innerHTML =
      `<button type="button" class="rrhs-select__trigger" aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}-list">` +
      `<span class="rrhs-select__value"></span><span class="rrhs-select__chevron">${CHEVRON}</span></button>` +
      `<ul class="rrhs-select__panel" id="${id}-list" role="listbox" tabindex="-1"></ul>`;
    wrapper.insertAdjacentElement("afterend", root);

    wrapper.classList.add("rrhs-native-select-hidden");
    wrapper.setAttribute("aria-hidden", "true");
    select.tabIndex = -1;

    const trigger = root.querySelector(".rrhs-select__trigger");
    const valueEl = root.querySelector(".rrhs-select__value");
    const list = root.querySelector(".rrhs-select__panel");
    let items = [];
    let activeIndex = -1;
    let typeBuffer = "";
    let typeTimer = null;

    function choices() {
      return Array.from(select.options).filter((o) => !isPlaceholder(o));
    }

    function render() {
      const opts = choices();
      const selected = select.options[select.selectedIndex];
      const hasValue = selected && !isPlaceholder(selected);
      const placeholder = Array.from(select.options).find(isPlaceholder);
      const label = labelFor(select);

      valueEl.textContent = hasValue
        ? selected.label || selected.text
        : (placeholder && (placeholder.label || placeholder.text)) || "Please choose";
      valueEl.classList.toggle("is-placeholder", !hasValue);
      trigger.setAttribute("aria-label", `${label}: ${valueEl.textContent}`);
      list.setAttribute("aria-label", label);
      root.classList.toggle("is-error", wrapper.classList.contains("form-control--error"));
      trigger.disabled = select.disabled;

      list.textContent = "";
      items = opts.map((option, i) => {
        const li = document.createElement("li");
        li.className = "rrhs-select__option";
        li.id = `${id}-opt-${i}`;
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", option === selected ? "true" : "false");
        if (option.disabled) li.setAttribute("aria-disabled", "true");
        li.style.setProperty("--i", String(Math.min(i, 8)));
        const text = document.createElement("span");
        text.textContent = option.label || option.text;
        const check = document.createElement("span");
        check.className = "rrhs-select__check";
        check.innerHTML = CHECK;
        li.append(text, check);
        li.addEventListener("click", () => choose(i));
        li.addEventListener("mousemove", () => setActive(i, false));
        list.appendChild(li);
        return { li, option };
      });
    }

    function setActive(i, scroll = true) {
      if (!items.length) return;
      activeIndex = Math.max(0, Math.min(items.length - 1, i));
      items.forEach((item, idx) => item.li.classList.toggle("is-active", idx === activeIndex));
      const li = items[activeIndex].li;
      list.setAttribute("aria-activedescendant", li.id);
      if (scroll) li.scrollIntoView({ block: "nearest" });
    }

    function isOpen() {
      return root.classList.contains("is-open");
    }

    function open() {
      if (isOpen() || select.disabled) return;
      closeAll(root);
      render();
      const rect = trigger.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom;
      root.classList.toggle("opens-up", below < 240 && rect.top > below);
      root.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
      const selectedIdx = items.findIndex((item) => item.option.selected);
      setActive(selectedIdx >= 0 ? selectedIdx : 0);
      list.focus({ preventScroll: true });
    }

    function close(refocus = true) {
      if (!isOpen()) return;
      root.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
      list.removeAttribute("aria-activedescendant");
      if (refocus) trigger.focus({ preventScroll: true });
    }

    function choose(i) {
      const item = items[i];
      if (!item || item.option.disabled) return;
      if (select.value !== item.option.value) {
        select.value = item.option.value;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      render();
      close();
    }

    function typeahead(char) {
      clearTimeout(typeTimer);
      typeBuffer += char.toLowerCase();
      typeTimer = setTimeout(() => (typeBuffer = ""), 600);
      const start = typeBuffer.length === 1 ? activeIndex + 1 : activeIndex;
      for (let n = 0; n < items.length; n++) {
        const idx = (start + n) % items.length;
        if ((items[idx].option.label || items[idx].option.text).toLowerCase().startsWith(typeBuffer)) {
          setActive(idx);
          return;
        }
      }
    }

    trigger.addEventListener("click", () => (isOpen() ? close() : open()));
    trigger.addEventListener("keydown", (e) => {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        open();
      }
    });
    list.addEventListener("keydown", (e) => {
      switch (e.key) {
        case "ArrowDown": e.preventDefault(); setActive(activeIndex + 1); break;
        case "ArrowUp": e.preventDefault(); setActive(activeIndex - 1); break;
        case "Home": e.preventDefault(); setActive(0); break;
        case "End": e.preventDefault(); setActive(items.length - 1); break;
        case "Enter":
        case " ": e.preventDefault(); choose(activeIndex); break;
        case "Escape": e.preventDefault(); close(); break;
        case "Tab": close(false); break;
        default:
          if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) typeahead(e.key);
      }
    });

    select.addEventListener("change", render);
    const mo = new MutationObserver(() => {
      if (!isOpen()) render();
    });
    mo.observe(select, { childList: true, subtree: true, attributes: true, characterData: true });
    const wrapperMo = new MutationObserver(() =>
      root.classList.toggle("is-error", wrapper.classList.contains("form-control--error"))
    );
    if (wrapper !== select) wrapperMo.observe(wrapper, { attributes: true, attributeFilter: ["class"] });

    render();
    return {
      root,
      close,
      sync: render,
      destroy() {
        mo.disconnect();
        wrapperMo.disconnect();
        root.remove();
      }
    };
  }

  function closeAll(except) {
    uis.forEach((ui) => {
      if (ui.root !== except) ui.close(false);
    });
  }

  document.addEventListener("pointerdown", (e) => {
    uis.forEach((ui) => {
      if (!ui.root.contains(e.target)) ui.close(false);
    });
  });

  function scan() {
    // Drop UIs whose native select Ecwid has removed or re-rendered.
    uis.forEach((ui, select) => {
      if (!select.isConnected || !ui.root.isConnected) {
        ui.destroy();
        uis.delete(select);
      }
    });
    const selects = document.querySelectorAll(SELECT_SELECTOR);
    if (!selects.length) return;
    ensureStyles();
    selects.forEach((select) => {
      if (!uis.has(select)) uis.set(select, enhance(select));
    });
  }

  const runtime = window.RRHS_RUNTIME;
  if (runtime && typeof runtime.onDomChanged === "function") runtime.onDomChanged(scan);
  else if (typeof MutationObserver !== "undefined") {
    new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  }
  scan();
})();

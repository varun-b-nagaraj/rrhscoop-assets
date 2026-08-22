(function () {
  function createProjectDropdown(element, onChange) {
    const trigger = element.querySelector(".custom-select-trigger");
    const menu = element.querySelector(".custom-select-menu");
    const valueLabel = element.querySelector(".custom-select-value");
    const options = [...menu.querySelectorAll("[role='option']")];
    let closeTimer = null;

    function selectedOption() {
      return options.find(option => option.getAttribute("aria-selected") === "true") || options[0];
    }

    function closeOtherDropdowns() {
      document.querySelectorAll(".custom-select.is-open").forEach(other => {
        if (other === element || !other.projectDropdown) return;
        other.projectDropdown.close(false);
      });
    }

    function close(focusTrigger) {
      element.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(() => {
        if (!element.classList.contains("is-open")) menu.hidden = true;
      }, 260);
      if (focusTrigger) trigger.focus();
    }

    function open(focusOption) {
      closeOtherDropdowns();
      window.clearTimeout(closeTimer);
      menu.hidden = false;
      element.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
      if (focusOption) window.requestAnimationFrame(() => selectedOption().focus());
    }

    function setValue(value, emitChange) {
      const next = options.find(option => option.dataset.value === value);
      if (!next) return;
      options.forEach(option => option.setAttribute("aria-selected", String(option === next)));
      valueLabel.textContent = next.textContent;
      if (emitChange) onChange(value);
    }

    trigger.addEventListener("click", () => {
      if (element.classList.contains("is-open")) close(false);
      else open(false);
    });

    trigger.addEventListener("keydown", event => {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        open(true);
      }
    });

    options.forEach(option => {
      option.addEventListener("click", () => {
        setValue(option.dataset.value, true);
        close(true);
      });
    });

    menu.addEventListener("keydown", event => {
      const currentIndex = Math.max(0, options.indexOf(document.activeElement));
      let nextIndex = currentIndex;
      if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % options.length;
      else if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + options.length) % options.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = options.length - 1;
      else if (event.key === "Escape") {
        event.preventDefault();
        close(true);
        return;
      } else if (event.key === "Tab") {
        close(false);
        return;
      } else return;
      event.preventDefault();
      options[nextIndex].focus();
    });

    document.addEventListener("click", event => {
      if (!element.contains(event.target)) close(false);
    });

    element.projectDropdown = { setValue: value => setValue(value, false), close, open };
    return element.projectDropdown;
  }

  window.createProjectDropdown = createProjectDropdown;
}());

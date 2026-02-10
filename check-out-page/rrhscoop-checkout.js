/* rrhscoop-checkout.js - extracted checkout & cart logic */
(function () {
  const RRHS_DEBUG =
    (typeof window !== "undefined" &&
      (window.RRHS_DEBUG === true ||
        (typeof localStorage !== "undefined" &&
          localStorage.getItem("RRHS_DEBUG") === "1"))) ||
    false;

  const log = (...args) => {
    if (RRHS_DEBUG) console.log(...args);
  };

  /* Modal utilities */
  function createModal(message) {
    const existing = document.getElementById('rrhs-error-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'rrhs-error-modal';
    modal.style.cssText = `position: fixed !important; top: 20px !important; left: 50% !important; transform: translateX(-50%) translateY(-100vh) !important; width: 90%; max-width: 600px; background: #670000; color: #EBEBE2; padding: 16px 20px 16px 48px; border-radius: 8px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4); z-index: 999999 !important; display: flex; align-items: center;`;
    modal.innerHTML = `
      <button id="rrhs-modal-close" style="position: absolute; top: 50%; left: 16px; transform: translateY(-50%); background: transparent; color: #EBEBE2; border: none; padding: 0; cursor: pointer; font-size: 20px; line-height: 1; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; transition: transform 0.2s ease, opacity 0.2s ease; opacity: 0.8;" onmouseover="this.style.transform='translateY(-50%) rotate(90deg)'; this.style.opacity='1';" onmouseout="this.style.transform='translateY(-50%) rotate(0deg)'; this.style.opacity='0.8';">×</button>
      <div style="font-size: 0.95em; font-weight: 500; flex: 1;">${message}</div>
    `;
    document.body.appendChild(modal);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        modal.style.transition = 'transform 0.4s ease';
        modal.style.transform = 'translateX(-50%) translateY(0)';
      });
    });
    if (!document.getElementById('rrhs-modal-styles')) {
      const style = document.createElement('style');
      style.id = 'rrhs-modal-styles';
      style.textContent = `#rrhs-error-modal{position:fixed!important;top:130px!important;}@keyframes shake{0%,100%{transform:translateX(0);}10%,30%,50%,70%,90%{transform:translateX(-8px);}20%,40%,60%,80%{transform:translateX(8px);}}`;
      document.head.appendChild(style);
    }
    const closeModal = () => {
      modal.style.transition = 'transform 0.3s ease';
      modal.style.transform = 'translateX(-50%) translateY(-100vh)';
      setTimeout(() => modal.remove(), 300);
    };
    document.getElementById('rrhs-modal-close').addEventListener('click', closeModal);
    setTimeout(closeModal, 5000);
    return modal;
  }

  function shakeElement(element) {
    element.style.animation = 'shake 0.5s ease';
    setTimeout(() => {
      element.style.animation = '';
    }, 500);
  }

  /* Room schedule (CSV) + delivery selection */
  const ROOM_SCHEDULE_CSV_FILENAME = "schedule_processed.xlsx - Room Schedule.csv";
  const FLOWERS_ROOM_SENTINEL =
    "Room number already specified on Valentine's Order, select this option and continue";

  let ROOM_DATA = Object.create(null);
  const rrhsRoomSchedule = {
    ready: false,
    teachers: [],
    error: null
  };
  let rrhsRoomSchedulePromise = null;

  const rrhsDeliverySelection = {
    dayType: null,
    teacher: null,
    period: null,
    room: null
  };

  function normalizeHeaderValue(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    const input = String(text || "");
    for (let i = 0; i < input.length; i++) {
      const char = input[i];

      if (inQuotes) {
        if (char === '"') {
          if (input[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
        continue;
      }

      if (char === '"') {
        inQuotes = true;
        continue;
      }
      if (char === ",") {
        row.push(field);
        field = "";
        continue;
      }
      if (char === "\r") continue;
      if (char === "\n") {
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
        continue;
      }
      field += char;
    }

    row.push(field);
    rows.push(row);

    while (
      rows.length > 0 &&
      rows[rows.length - 1].every((c) => String(c || "").trim() === "")
    ) {
      rows.pop();
    }
    return rows;
  }

  function buildRoomDataFromCsv(csvText) {
    const rows = parseCsv(csvText);
    if (!rows || rows.length < 2) {
      throw new Error("Room schedule CSV is empty.");
    }

    const header = rows[0] || [];
    const normalized = header.map(normalizeHeaderValue);

    const teacherIdx = normalized.findIndex((h) => h === "teacher" || h.includes("teacher"));
    if (teacherIdx === -1) {
      throw new Error("Room schedule CSV missing Teacher header.");
    }

    const periodIdx = Object.create(null);
    for (let p = 1; p <= 8; p++) {
      const key = `period${p}`;
      const idx = normalized.findIndex((h) => h === key);
      if (idx === -1) throw new Error(`Room schedule CSV missing ${key} header.`);
      periodIdx[p] = idx;
    }

    const data = Object.create(null);
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const teacherName = String(row[teacherIdx] || "").trim();
      if (!teacherName) continue;

      const periods = Object.create(null);
      for (let p = 1; p <= 8; p++) {
        const raw = row[periodIdx[p]];
        const roomRaw = String(raw == null ? "" : raw);
        const roomTrimmed = roomRaw.trim();
        if (!roomTrimmed) continue;
        const roomNormalized = roomTrimmed.replace(/\s+/g, " ");
        periods[p] = roomNormalized;
      }
      if (Object.keys(periods).length === 0) continue;
      data[teacherName] = periods;
    }

    const teachers = Object.keys(data).sort((a, b) => a.localeCompare(b));
    return { data, teachers };
  }

  function getRoomScheduleCsvUrl() {
    try {
      if (
        typeof window !== "undefined" &&
        window.RRHS_ROOM_SCHEDULE_CSV_URL &&
        String(window.RRHS_ROOM_SCHEDULE_CSV_URL).trim()
      ) {
        return String(window.RRHS_ROOM_SCHEDULE_CSV_URL).trim();
      }

      const baseUrl =
        (document.currentScript && document.currentScript.src)
          ? new URL(".", document.currentScript.src)
          : new URL(window.location.href);
      return new URL(ROOM_SCHEDULE_CSV_FILENAME, baseUrl).toString();
    } catch (e) {
      return ROOM_SCHEDULE_CSV_FILENAME;
    }
  }

  function loadRoomSchedule() {
    if (rrhsRoomSchedulePromise) return rrhsRoomSchedulePromise;

    const url = getRoomScheduleCsvUrl();
    rrhsRoomSchedulePromise = fetch(url, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load room schedule CSV (${res.status}).`);
        return res.text();
      })
      .then((text) => {
        const built = buildRoomDataFromCsv(text);
        ROOM_DATA = built.data;
        rrhsRoomSchedule.ready = true;
        rrhsRoomSchedule.teachers = built.teachers;
        rrhsRoomSchedule.error = null;
        return rrhsRoomSchedule;
      })
      .catch((err) => {
        ROOM_DATA = Object.create(null);
        rrhsRoomSchedule.ready = false;
        rrhsRoomSchedule.teachers = [];
        rrhsRoomSchedule.error = err;
        throw err;
      });

    return rrhsRoomSchedulePromise;
  }

  function getTodayDayType() {
    return isADay() ? "A" : "B";
  }

  function parseTimeToMinutes(hhmm) {
    const m = String(hhmm || "").trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
    return h * 60 + min;
  }

  function formatMinutes(minutes) {
    const total = Math.max(0, Math.min(24 * 60 - 1, Number(minutes)));
    const h24 = Math.floor(total / 60);
    const m = total % 60;
    const suffix = h24 >= 12 ? "PM" : "AM";
    const h12 = ((h24 + 11) % 12) + 1;
    const mm = String(m).padStart(2, "0");
    return `${h12}:${mm} ${suffix}`;
  }

  function getNowMinutes(date = new Date()) {
    return date.getHours() * 60 + date.getMinutes();
  }

  const BASE_PERIOD_WINDOWS = Object.freeze({
    1: { start: "09:00", end: "10:40" },
    2: { start: "10:40", end: "12:12" },
    3: { start: "12:12", end: "13:59" },
    4: { start: "14:47", end: "16:20" }
  });

  function getPeriodWindow(periodNumber) {
    const p = Number(periodNumber);
    if (!Number.isFinite(p) || p < 1 || p > 8) return null;
    const base = p <= 4 ? p : p - 4;
    const w = BASE_PERIOD_WINDOWS[base];
    if (!w) return null;
    const startMin = parseTimeToMinutes(w.start);
    const endMin = parseTimeToMinutes(w.end);
    if (startMin == null || endMin == null) return null;
    const closeMin = Math.max(startMin, endMin - 20);
    return { startMin, endMin, closeMin };
  }

  function getAllowedPeriodsForDay(dayType) {
    return dayType === "A" ? [1, 2, 3, 4] : [5, 6, 7, 8];
  }

  function resolveTeacherName(value) {
    const v = String(value || "").trim();
    if (!v) return null;
    if (ROOM_DATA[v]) return v;
    const lower = v.toLowerCase();
    const match = rrhsRoomSchedule.teachers.find((t) => t.toLowerCase() === lower);
    return match || null;
  }

  function getSelectionValidation() {
    const today = new Date();
    const dow = today.getDay();
    if (dow === 0 || dow === 6) {
      return { ok: false, message: "Deliveries are only available on school days." };
    }

    if (rrhsCartState.ready && rrhsCartState.hasFlowers && !rrhsCartState.hasOther) {
      return { ok: true, message: "" };
    }

    if (!rrhsRoomSchedule.ready) {
      return {
        ok: false,
        message:
          "Room schedule is unavailable right now. Please refresh and try again."
      };
    }

    const selectedDay = rrhsDeliverySelection.dayType;
    const todayDay = getTodayDayType();
    if (selectedDay !== "A" && selectedDay !== "B") {
      return { ok: false, message: "Please select A Day or B Day." };
    }
    if (selectedDay !== todayDay) {
      return { ok: false, message: `Today is an ${todayDay} Day. Please select ${todayDay} Day.` };
    }

    const teacher = rrhsDeliverySelection.teacher;
    if (!teacher || !ROOM_DATA[teacher]) {
      return { ok: false, message: "Please select a teacher." };
    }

    const period = Number(rrhsDeliverySelection.period);
    if (!Number.isFinite(period)) {
      return { ok: false, message: "Please select a period." };
    }
    const allowed = getAllowedPeriodsForDay(selectedDay);
    if (!allowed.includes(period)) {
      return { ok: false, message: `Period ${period} is not available on ${selectedDay} Day.` };
    }

    const room = (ROOM_DATA[teacher] && ROOM_DATA[teacher][period]) || null;
    if (!room) {
      return { ok: false, message: "No room is available for that teacher/period." };
    }

    const w = getPeriodWindow(period);
    if (!w) return { ok: false, message: "Invalid period selected." };

    const nowMin = getNowMinutes(today);
    if (nowMin < w.startMin) {
      return { ok: false, message: `Delivery for Period ${period} starts at ${formatMinutes(w.startMin)}.` };
    }
    if (nowMin > w.closeMin) {
      return { ok: false, message: `Delivery for Period ${period} closes at ${formatMinutes(w.closeMin)}.` };
    }

    return { ok: true, message: "" };
  }

  function initRoomAutocomplete() {
    refreshCartState(() => {
      const input = document.querySelector('input[name="z7rty2b"]');
      if (!input || input.dataset.autocompleteInit) return;
      input.dataset.autocompleteInit = "true";

      const wrapper = document.createElement("div");
      wrapper.style.position = "relative";
      wrapper.style.width = "100%";
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);

      const statusMsg = document.createElement("div");
      statusMsg.style.cssText =
        "margin-top:6px;color:#d32f2f;font-size:.875em;display:none;";
      wrapper.appendChild(statusMsg);

      const setStatus = (text) => {
        if (!text) {
          statusMsg.style.display = "none";
          statusMsg.textContent = "";
        } else {
          statusMsg.style.display = "block";
          statusMsg.textContent = text;
        }
      };

      const setRoomValue = (value) => {
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      };

      if (rrhsCartState.ready && rrhsCartState.hasFlowers && !rrhsCartState.hasOther) {
        rrhsDeliverySelection.dayType = null;
        rrhsDeliverySelection.teacher = null;
        rrhsDeliverySelection.period = null;
        rrhsDeliverySelection.room = FLOWERS_ROOM_SENTINEL;
        setRoomValue(FLOWERS_ROOM_SENTINEL);
        return;
      }

      input.style.display = "none";

      const ui = document.createElement("div");
      ui.style.cssText = "display:flex;flex-direction:column;gap:10px;";
      wrapper.insertBefore(ui, input);

      const rowStyle = "display:flex;gap:10px;align-items:center;flex-wrap:wrap;";
      const labelStyle = "font-weight:600;min-width:72px;";
      const controlStyle =
        "flex:1;min-width:220px;padding:10px 12px;border:1px solid #ddd;border-radius:6px;font-size:1em;box-sizing:border-box;";

      const dayRow = document.createElement("div");
      dayRow.style.cssText = rowStyle;
      const dayLabel = document.createElement("div");
      dayLabel.textContent = "Day";
      dayLabel.style.cssText = labelStyle;
      const daySelect = document.createElement("select");
      daySelect.style.cssText = controlStyle;
      daySelect.innerHTML = `<option value="">Select day…</option><option value="A">A Day</option><option value="B">B Day</option>`;
      dayRow.appendChild(dayLabel);
      dayRow.appendChild(daySelect);
      ui.appendChild(dayRow);

      const teacherRow = document.createElement("div");
      teacherRow.style.cssText = rowStyle;
      const teacherLabel = document.createElement("div");
      teacherLabel.textContent = "Teacher";
      teacherLabel.style.cssText = labelStyle;
      const teacherInput = document.createElement("input");
      teacherInput.type = "text";
      teacherInput.placeholder = "Start typing a teacher name…";
      teacherInput.style.cssText = controlStyle;
      const datalistId = `rrhs-teacher-list-${Math.random().toString(36).slice(2)}`;
      teacherInput.setAttribute("list", datalistId);
      const teacherList = document.createElement("datalist");
      teacherList.id = datalistId;
      teacherRow.appendChild(teacherLabel);
      teacherRow.appendChild(teacherInput);
      ui.appendChild(teacherRow);
      ui.appendChild(teacherList);

      const periodRow = document.createElement("div");
      periodRow.style.cssText = rowStyle;
      const periodLabel = document.createElement("div");
      periodLabel.textContent = "Period";
      periodLabel.style.cssText = labelStyle;
      const periodSelect = document.createElement("select");
      periodSelect.style.cssText = controlStyle;
      periodSelect.disabled = true;
      periodSelect.innerHTML = `<option value="">Select period…</option>`;
      periodRow.appendChild(periodLabel);
      periodRow.appendChild(periodSelect);
      ui.appendChild(periodRow);

      const roomPreview = document.createElement("div");
      roomPreview.style.cssText = "color:#555;font-size:.9em;";
      roomPreview.textContent = "Room: —";
      ui.appendChild(roomPreview);

      const updateTeacherListForSelectedDay = () => {
        if (!rrhsRoomSchedule.ready) return;
        teacherList.innerHTML = "";

        const dayType = String(daySelect.value || "").trim().toUpperCase();
        const allowedPeriods =
          dayType === "A" || dayType === "B"
            ? getAllowedPeriodsForDay(dayType)
            : null;

        const teachers = allowedPeriods
          ? rrhsRoomSchedule.teachers.filter((t) => {
            const periodsForTeacher = ROOM_DATA[t];
            return (
              periodsForTeacher &&
              allowedPeriods.some((p) => Boolean(periodsForTeacher[p]))
            );
          })
          : rrhsRoomSchedule.teachers;

        teachers.forEach((t) => {
          const opt = document.createElement("option");
          opt.value = t;
          teacherList.appendChild(opt);
        });
      };

      const renderPeriods = () => {
        const dayType = String(daySelect.value || "").trim().toUpperCase();
        rrhsDeliverySelection.dayType = dayType === "A" || dayType === "B" ? dayType : null;

        const teacherName = resolveTeacherName(teacherInput.value);
        rrhsDeliverySelection.teacher = teacherName;

        periodSelect.innerHTML = `<option value="">Select period…</option>`;
        periodSelect.disabled = true;
        rrhsDeliverySelection.period = null;
        rrhsDeliverySelection.room = null;
        roomPreview.textContent = "Room: —";
        setRoomValue("");

        if (!rrhsDeliverySelection.dayType) return;
        if (!teacherName) return;

        const allowedPeriods = getAllowedPeriodsForDay(rrhsDeliverySelection.dayType);
        const periodsForTeacher = ROOM_DATA[teacherName] || Object.create(null);
        const available = allowedPeriods.filter((p) => periodsForTeacher[p]);
        if (available.length === 0) {
          setStatus("No rooms available for that teacher on the selected day.");
          return;
        }

        available.forEach((p) => {
          const opt = document.createElement("option");
          opt.value = String(p);
          opt.textContent = `Period ${p}`;
          periodSelect.appendChild(opt);
        });
        periodSelect.disabled = false;
      };

      const applyPeriodSelection = () => {
        const teacherName = rrhsDeliverySelection.teacher;
        const p = Number(periodSelect.value);
        rrhsDeliverySelection.period = Number.isFinite(p) ? p : null;

        const room =
          teacherName && rrhsDeliverySelection.period
            ? (ROOM_DATA[teacherName] && ROOM_DATA[teacherName][rrhsDeliverySelection.period]) || null
            : null;
        rrhsDeliverySelection.room = room;

        if (room) {
          roomPreview.textContent = `Room: ${room}`;
          setRoomValue(room);
        } else {
          roomPreview.textContent = "Room: —";
          setRoomValue("");
        }

        if (
          rrhsDeliverySelection.dayType &&
          rrhsDeliverySelection.teacher &&
          rrhsDeliverySelection.period
        ) {
          const validation = getSelectionValidation();
          if (!validation.ok) {
            setStatus(validation.message);
          } else {
            setStatus("");
          }
        } else {
          setStatus("");
        }
      };

      daySelect.addEventListener("change", () => {
        setStatus("");
        updateTeacherListForSelectedDay();
        renderPeriods();
        applyPeriodSelection();
      });

      teacherInput.addEventListener("input", () => {
        setStatus("");
        renderPeriods();
      });

      periodSelect.addEventListener("change", applyPeriodSelection);

      loadRoomSchedule()
        .then(() => {
          const todayDay = getTodayDayType();
          daySelect.value = todayDay;
          rrhsDeliverySelection.dayType = todayDay;
          updateTeacherListForSelectedDay();
          renderPeriods();
          applyPeriodSelection();
        })
        .catch((e) => {
          log("Room schedule load error", e);
          setStatus("Room schedule failed to load. Please refresh and try again.");
          createModal("Room schedule failed to load. Please refresh and try again.");
        });
    });
  }

  function initRoomContinueButton() {
    const continueBtn = document.querySelector('.form-control--button button.form-control__button');
    if (!continueBtn || continueBtn.dataset.rrhsValidation) return;
    continueBtn.dataset.rrhsValidation = "true";
    continueBtn.addEventListener('click', (e) => {
      const input = document.querySelector('input[name="z7rty2b"]');
      if (!input) return;

      if (rrhsCartState.ready && rrhsCartState.hasFlowers && !rrhsCartState.hasOther) {
        input.value = FLOWERS_ROOM_SENTINEL;
        return;
      }

      const validation = getSelectionValidation();
      if (!validation.ok) {
        e.preventDefault();
        e.stopPropagation();
        shakeElement(continueBtn);

        createModal(validation.message || "Please select a valid teacher and period.");
      }
    });
  }

  /* Checkout time restriction and cart state */
  const CHECKOUT_ALWAYS_ALLOW = false;
  const REFERENCE_A_DAY = '2026-01-27';
  const FLOWERS_PRODUCT_NAME = "Valentine's Day Flowers";
  const FLOWERS_SKU = "703_sku";
  const rrhsCartState = { ready: false, hasFlowers: false, hasOther: false, lastUpdated: 0 };

  function isFlowersItem(item) {
    const p = item && item.product;
    if (!p) return false;
    return (p.sku === FLOWERS_SKU) && (p.name === FLOWERS_PRODUCT_NAME);
  }

  function computeCartFlags(cart) {
    const items = (cart && Array.isArray(cart.items)) ? cart.items : [];
    const hasFlowers = items.some(isFlowersItem);
    const hasOther = items.some((it) => {
      if (!it || !it.product) return false;
      return !isFlowersItem(it);
    });
    rrhsCartState.ready = true;
    rrhsCartState.hasFlowers = hasFlowers;
    rrhsCartState.hasOther = hasOther;
    rrhsCartState.lastUpdated = Date.now();
  }

  function refreshCartState(cb) {
    try {
      if (!window.Ecwid || !Ecwid.Cart || typeof Ecwid.Cart.get !== "function") {
        rrhsCartState.ready = false;
        rrhsCartState.hasFlowers = false;
        rrhsCartState.hasOther = false;
        rrhsCartState.lastUpdated = Date.now();
        if (typeof cb === "function") cb();
        return;
      }
      Ecwid.Cart.get(function(cart) {
        computeCartFlags(cart);
        if (typeof cb === "function") cb();
      });
    } catch (e) {
      rrhsCartState.ready = false;
      rrhsCartState.hasFlowers = false;
      rrhsCartState.hasOther = false;
      rrhsCartState.lastUpdated = Date.now();
      if (typeof cb === "function") cb();
    }
  }

  function getRestrictionMessage() {
    if (rrhsCartState.hasFlowers && rrhsCartState.hasOther) {
      return `Only <a href="https://rrhscoop.roundrockisd.org/products/Valentines-Day-Flowers-p813923050" target="_blank" rel="noopener" style="color:#FFD6D6;text-decoration:underline;font-weight:600;"> Valentine’s Day Flowers </a> can be ordered at any time. All other items must be ordered during an active delivery window.`;
    }

    const hasCompleteSelection =
      rrhsDeliverySelection.dayType &&
      rrhsDeliverySelection.teacher &&
      rrhsDeliverySelection.period;
    if (hasCompleteSelection) {
      const validation = getSelectionValidation();
      if (!validation.ok && validation.message) return validation.message;
    }

    const w1 = getPeriodWindow(1);
    const w2 = getPeriodWindow(2);
    const w3 = getPeriodWindow(3);
    const w4 = getPeriodWindow(4);
    if (w1 && w2 && w3 && w4) {
      return `Ordering is available during delivery windows only:<br/>Period 1/5: ${formatMinutes(w1.startMin)}–${formatMinutes(w1.closeMin)}<br/>Period 2/6: ${formatMinutes(w2.startMin)}–${formatMinutes(w2.closeMin)}<br/>Period 3/7: ${formatMinutes(w3.startMin)}–${formatMinutes(w3.closeMin)}<br/>Period 4/8: ${formatMinutes(w4.startMin)}–${formatMinutes(w4.closeMin)}`;
    }

    return "We’re sorry, we do not accept orders at this time.";
  }

  function isADay() {
    const now = new Date();
    const referenceDate = new Date(REFERENCE_A_DAY + 'T00:00:00');
    now.setHours(0,0,0,0);
    referenceDate.setHours(0,0,0,0);
    let dayCount = 0;
    const current = new Date(referenceDate);

    while (current < now) {
      current.setDate(current.getDate() + 1);
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        dayCount++;
      }
    }
    return dayCount % 2 === 0;
  }

  function checkOrderingWindowBase() {
    if (CHECKOUT_ALWAYS_ALLOW) return true;
    const now = new Date();
    const day = now.getDay();
    if (day === 0 || day === 6) return false;
    const basePeriods = [1, 2, 3, 4];
    const nowMin = getNowMinutes(now);
    return basePeriods.some((p) => {
      const w = getPeriodWindow(p);
      if (!w) return false;
      return nowMin >= w.startMin && nowMin <= w.closeMin;
    });
  }

  function checkOrderingWindow() {
    if (rrhsCartState.hasFlowers && !rrhsCartState.hasOther) return true;
    return checkOrderingWindowBase();
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
      if (button.dataset.rrhsClickHandler && button._rrhsClickHandler) {
        button.removeEventListener('click', button._rrhsClickHandler, true);
        delete button.dataset.rrhsClickHandler;
        delete button._rrhsClickHandler;
      }
    } else {
      button.disabled = true;
      button.style.opacity = '0.5';
      button.style.cursor = 'not-allowed';
      button.title = getRestrictionMessage();
      if (!button.dataset.rrhsClickHandler) {
        button.dataset.rrhsClickHandler = "true";
        button._rrhsClickHandler = (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          shakeElement(button);
          createModal(getRestrictionMessage());
          return false;
        };
        button.addEventListener('click', button._rrhsClickHandler, true);
      }
    }
  }

  function wrapCheckoutButton() {
    const button = document.querySelector('.ec-cart__button--checkout button');
    if (!button || button.dataset.rrhsWrapped) return;
    const parent = button.parentElement;
    if (!parent) return;
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position: relative; display: inline-block; width: 100%;';
    wrapper.dataset.rrhsWrapper = 'true';
    parent.insertBefore(wrapper, button);
    wrapper.appendChild(button);

    const overlay = document.createElement('div');
    overlay.style.cssText = `position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 10; cursor: not-allowed; display: none;`;
    overlay.dataset.rrhsOverlayBtn = 'true';
    wrapper.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      shakeElement(button);
      createModal(getRestrictionMessage());
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

  let rrhsCartChangedListenerAdded = false;
  function initCartChangedListener() {
    if (rrhsCartChangedListenerAdded) return;
    const ecwid = window.Ecwid;
    if (
      ecwid &&
      ecwid.OnCartChanged &&
      typeof ecwid.OnCartChanged.add === "function"
    ) {
      rrhsCartChangedListenerAdded = true;
      ecwid.OnCartChanged.add(function(cart) {
        computeCartFlags(cart);
        wrapCheckoutButton();
        manageCheckoutButton();
        updateCheckoutOverlay();
      });
    }
  }

  function boot() {
    try {
      log('RRHS checkout boot');
      initCartChangedListener();
      initRoomAutocomplete();
      initRoomContinueButton();
      wrapCheckoutButton();
      const checkoutButton = document.querySelector('.ec-cart__button--checkout button');
      if (checkoutButton) {
        refreshCartState(() => {
          manageCheckoutButton();
          updateCheckoutOverlay();
        });
      }
    } catch (e) {
      log('RRHS checkout boot error', e);
    }
  }

  let bootScheduled = false;
  const raf =
    (typeof window !== "undefined" &&
      typeof window.requestAnimationFrame === "function")
      ? window.requestAnimationFrame.bind(window)
      : (fn) => setTimeout(fn, 0);
  const scheduleBoot = () => {
    if (bootScheduled) return;
    bootScheduled = true;
    raf(() => {
      bootScheduled = false;
      boot();
    });
  };

  scheduleBoot();
  const observer = new MutationObserver(scheduleBoot);
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scheduleBoot);

  setInterval(() => {
    const inCartOrCheckout = document.querySelector(".ec-cart, .ec-cart-step, .ec-checkout");
    const checkoutButton = document.querySelector('.ec-cart__button--checkout button');
    if (!inCartOrCheckout || !checkoutButton) return;
    refreshCartState(() => {
      manageCheckoutButton();
      updateCheckoutOverlay();
    });
  }, 60000);

})();

/* rrhs-by-the-numbers.js - live, count-up stats for the homepage "By the Numbers" tile
 *
 * The tile is an Ecwid custom-code block that renders an iframe with srcdoc
 * (same origin as the storefront), so we reach into it and:
 *   - Students Involved: hardcoded below.
 *   - Site Visits:       all-time visitors from /api/v1/ecwid/stats.
 *   - Deliveries:        all-time delivered orders from /api/v1/ecwid/stats.
 *   - Student Projects:  counted live from iframes/projects/projects.js.
 * Each value counts up from 0 the first time the tile scrolls into view.
 * If live data is unavailable, the tile's original number is used.
 */
(function () {
  if (window.__rrhsByTheNumbersInstalled) return;
  window.__rrhsByTheNumbersInstalled = true;

  const STUDENTS_INVOLVED = 150;
  const FRAME_SELECTOR = 'iframe[title="RRHS CO-OP by the numbers"]';
  const DURATION_MS = 1800;

  const assetRoot = (function () {
    try {
      const cur = document.currentScript;
      if (cur && cur.src) return new URL("../", cur.src).href;
    } catch (e) {}
    return "https://rrhscoop-assets.vercel.app/";
  })();

  let dataPromise = null;

  function fetchJson(url) {
    return fetch(url, { credentials: "omit" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  }

  function countProjects() {
    return fetch(new URL("iframes/projects/projects.js", assetRoot).href, { credentials: "omit" })
      .then((r) => (r.ok ? r.text() : ""))
      .then((src) => {
        const start = src.indexOf("const projects = [");
        if (start < 0) return null;
        const matches = src.slice(start).match(/^\s{4}id:\s*["'][^"']+["']/gm);
        return matches && matches.length ? matches.length : null;
      })
      .catch(() => null);
  }

  function loadData() {
    if (!dataPromise) {
      dataPromise = Promise.all([
        fetchJson(new URL("api/v1/ecwid/stats", assetRoot).href),
        countProjects()
      ]).then(([stats, projects]) => ({
        students: STUDENTS_INVOLVED,
        visits: stats && Number.isFinite(stats.siteVisits) ? stats.siteVisits : null,
        deliveries: stats && Number.isFinite(stats.deliveries) ? stats.deliveries : null,
        projects
      }));
    }
    return dataPromise;
  }

  // "10K" -> 10000, "200" -> 200
  function parseDisplayed(text) {
    const m = String(text || "").replace(/,/g, "").match(/([\d.]+)\s*([kKmM]?)/);
    if (!m) return 0;
    const mult = /k/i.test(m[2]) ? 1e3 : /m/i.test(m[2]) ? 1e6 : 1;
    return Math.round(parseFloat(m[1]) * mult);
  }

  function format(n) {
    n = Math.max(0, Math.floor(n));
    if (n >= 1e6) return (Math.floor(n / 1e5) / 10).toString().replace(/\.0$/, "") + "M";
    if (n >= 1e4) return Math.floor(n / 1e3) + "K";
    if (n >= 1e3) return (Math.floor(n / 100) / 10).toString().replace(/\.0$/, "") + "K";
    return n.toLocaleString("en-US");
  }

  function setValue(stat, n) {
    const textNode = stat.numberNode;
    if (textNode) textNode.nodeValue = format(n);
  }

  function statKey(label) {
    const l = String(label || "").toLowerCase();
    if (l.includes("student") && l.includes("involved")) return "students";
    if (l.includes("visit")) return "visits";
    if (l.includes("deliver")) return "deliveries";
    if (l.includes("project")) return "projects";
    return null;
  }

  const LABELS = {
    visits: "Site Visits",
    deliveries: "Deliveries Made"
  };

  function prepare(frame) {
    let doc;
    try {
      doc = frame.contentDocument;
    } catch (e) {
      return null;
    }
    if (!doc || !doc.querySelector(".stats .stat")) return null;
    if (frame.__rrhsStats) return frame.__rrhsStats;

    const stats = Array.from(doc.querySelectorAll(".stats .stat")).map((el) => {
      const value = el.querySelector(".value");
      const label = el.querySelector(".label");
      const key = statKey(label && label.textContent);
      if (label && LABELS[key]) label.textContent = LABELS[key];
      const numberNode = value
        ? Array.from(value.childNodes).find((n) => n.nodeType === 3 && /\d/.test(n.nodeValue))
        : null;
      return {
        key,
        numberNode,
        fallback: parseDisplayed(numberNode && numberNode.nodeValue)
      };
    });

    const reduceMotion =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion) stats.forEach((s) => setValue(s, 0));

    frame.__rrhsStats = { stats, reduceMotion, played: false };
    return frame.__rrhsStats;
  }

  function animate(state, data) {
    const targets = state.stats.map((s) => {
      const live = s.key ? data[s.key] : null;
      return Number.isFinite(live) && live > 0 ? live : s.fallback;
    });

    if (state.reduceMotion) {
      state.stats.forEach((s, i) => setValue(s, targets[i]));
      return;
    }

    const start = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    function tick(now) {
      const t = Math.min(1, (now - start) / DURATION_MS);
      state.stats.forEach((s, i) => setValue(s, targets[i] * ease(t)));
      if (t < 1) requestAnimationFrame(tick);
      else state.stats.forEach((s, i) => setValue(s, targets[i]));
    }
    requestAnimationFrame(tick);
  }

  function attach(frame) {
    if (frame.__rrhsStatsObserved) return;
    const state = prepare(frame);
    if (!state) {
      if (!frame.__rrhsStatsLoadBound) {
        frame.__rrhsStatsLoadBound = true;
        frame.addEventListener("load", () => attach(frame));
      }
      return;
    }
    frame.__rrhsStatsObserved = true;
    loadData();

    const play = () => {
      if (state.played) return;
      state.played = true;
      loadData().then((data) => animate(state, data));
    };

    if (typeof IntersectionObserver !== "function") return play();
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          play();
        }
      },
      { threshold: 0.35 }
    );
    io.observe(frame);
  }

  function scan() {
    document.querySelectorAll(FRAME_SELECTOR).forEach(attach);
  }

  const runtime = window.RRHS_RUNTIME;
  if (runtime && typeof runtime.onDomChanged === "function") runtime.onDomChanged(scan);
  else if (typeof MutationObserver !== "undefined") {
    new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  }
  scan();
})();

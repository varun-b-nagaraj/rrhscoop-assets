(function () {
  'use strict';
  if (window.RRHS_HUNT_INTRO || window.parent !== window) return;
  const config = window.RRHS_HUNT_CONFIG;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const stickerImage = window.RRHS_EASTER_HUNT.stickerImage;
  const arrowIcon = window.RRHS_EASTER_HUNT.arrowIcon;
  let counter, tooltip, tour, intro, timer, frame, scheduled = false, oldOverflow, returnFocus, header;
  let data = window.RRHS_EASTER_HUNT?.getAvailability(), suspended = 0;
  const enabled = () => window.RRHS_HUNT_ACTIVE === true;
  function seen() { try { return sessionStorage.getItem('rrhs-hunt-intro-seen') === 'true'; } catch (_) { return false; } }
  function remember() { try { sessionStorage.setItem('rrhs-hunt-intro-seen', 'true'); } catch (_) {} }
  function counterState() {
    // Until the live count loads (or if it can't), show the full twelve rather than a guess.
    const sample = !data || !Number.isFinite(data.remaining);
    const remaining = sample ? 12 : Math.max(0, Math.min(12, data.remaining));
    const found = 12 - remaining;
    const preview = data?.mode === 'preview';
    return { found, remaining, preview, sample };
  }
  function updateCounter() {
    if (!counter || !enabled()) return;
    const { found, remaining, preview, sample } = counterState();
    const count = counter.querySelector('.hunt-counter-count');
    const value = `${found}/12`;
    if (count.textContent !== value) count.textContent = value;
    counter.querySelector('.hunt-counter-preview').hidden = !preview;
    counter.querySelector('button').setAttribute('aria-label', `${preview ? 'Preview. ' : ''}${found} of 12 dragon stickers found across the hunt. ${remaining} remaining. Learn about the package hunt.`);
    tooltip.textContent = sample
      ? 'Look for the red dragon sticker holding a CO-OP package. Twelve are hidden around the website. Select this button to read the hunt details.'
      : `${preview ? 'Local development preview. ' : ''}${found} of 12 hidden dragon stickers have been claimed across the hunt. ${remaining} rewards remain. Find the dragon holding a CO-OP package for a mystery reward. One reward per student. Select to read the hunt details again.`;
  }
  function placeTooltip() {
    if (!counter || !tooltip || tooltip.hidden) return;
    const bounds = counter.getBoundingClientRect();
    tooltip.style.top = `${bounds.bottom + 10}px`;
    tooltip.style.left = `${Math.max(12, Math.min(innerWidth - Math.min(300, innerWidth - 24) - 12, bounds.right - 300))}px`;
  }
  function mountCounter() {
    if (!enabled()) return;
    const search = document.querySelector('.ins-header .ins-header__icon--search');
    if (!search && !local) return;
    if (counter?.isConnected && (!search || counter.nextElementSibling === search)) return;
    if (!counter) {
      counter = document.createElement('div'); counter.className = 'hunt-counter';
      counter.innerHTML = `<button type="button" class="hunt-counter-trigger" aria-haspopup="dialog" aria-describedby="hunt-counter-tip" title="Read the hunt details">${stickerImage}<span><span class="hunt-counter-count" aria-live="polite">0/12</span><span class="hunt-counter-label"> found</span></span><span class="hunt-counter-preview">Preview</span></button>`;
      tooltip = document.createElement('div'); tooltip.id = 'hunt-counter-tip'; tooltip.className = 'hunt-counter-tooltip';
      tooltip.setAttribute('role', 'tooltip'); tooltip.hidden = true; document.body.append(tooltip);
      const show = () => { tooltip.hidden = false; placeTooltip(); };
      const hide = () => { tooltip.hidden = true; };
      counter.addEventListener('pointerenter', show); counter.addEventListener('pointerleave', hide);
      counter.addEventListener('focusin', show); counter.addEventListener('focusout', hide);
      counter.addEventListener('keydown', event => { if (event.key === 'Escape') { hide(); event.stopPropagation(); } });
      counter.querySelector('button').addEventListener('click', () => { hide(); showInformation(); });
    }
    if (search) {
      header?.classList.remove('hunt-header-active'); header = search.closest('.ins-header'); header.classList.add('hunt-header-active');
      counter.classList.remove('hunt-counter-local'); search.before(counter);
    }
    else if (local) { counter.classList.add('hunt-counter-local'); document.body.append(counter); }
    updateCounter();
  }
  function restorePage() {
    if (oldOverflow !== undefined) document.body.style.overflow = oldOverflow;
    oldOverflow = undefined;
  }
  function stopTour() {
    cancelAnimationFrame(frame); frame = null;
    if (tour) { tour.close(); tour.remove(); tour = null; }
    restorePage();
  }
  function dismiss() {
    clearTimeout(timer); stopTour();
    if (intro) { intro.close(); intro.remove(); intro = null; restorePage(); }
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  }
  function introduction() {
    if (!enabled()) return;
    stopTour();
    const { found, remaining, preview } = counterState();
    intro = document.createElement('dialog'); intro.className = 'hunt-dialog hunt-intro-dialog';
    intro.setAttribute('aria-labelledby', 'hunt-intro-title'); intro.setAttribute('aria-describedby', 'hunt-intro-copy');
    intro.innerHTML = `<button type="button" class="hunt-close" aria-label="Close introduction">×</button>
      <div class="hunt-intro-seal">${stickerImage.replace('alt=""', 'alt="Red CO-OP dragon holding a package"')}</div><p class="hunt-eyebrow">This is what you’re looking for</p>
      <h2 id="hunt-intro-title">Good things hide<br>in plain sight.</h2>
      <p id="hunt-intro-copy">Look for this dragon sticker holding a CO-OP package. Twelve are tucked around the website. Spot one and discover a mystery reward.</p>
      <div class="hunt-intro-rules"><span><strong>12</strong> hidden stickers</span><span><strong>10–35%</strong> mystery rewards</span><span><strong>1</strong> per student</span></div>
      <p class="hunt-intro-hint">Find this sticker, then tap or click it. The counter beside search tracks discoveries across the hunt.</p>
      ${preview ? '<p class="hunt-preview">Local development preview. No real coupon is issued.</p>' : `<p class="hunt-intro-tally">${found}/12 found · ${remaining} rewards remaining</p>`}
      <button type="button" class="hunt-primary hunt-intro-start">Let’s find something ${arrowIcon}</button>
      <p class="hunt-terms">One reward per student. Ends Friday, November 13, 2026 at 11:59 PM Central.</p>`;
    document.body.append(intro); oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    intro.showModal(); intro.querySelector('.hunt-intro-start').focus({ preventScroll: true });
    intro.querySelector('.hunt-close').addEventListener('click', dismiss);
    intro.querySelector('.hunt-intro-start').addEventListener('click', dismiss);
    intro.addEventListener('cancel', event => { event.preventDefault(); dismiss(); });
    intro.addEventListener('click', event => {
      if (event.target !== intro) return;
      const box = intro.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dismiss();
    });
  }
  function showInformation() {
    if (!enabled() || intro) return;
    clearTimeout(timer); returnFocus = document.activeElement; remember(); introduction();
  }
  function start() {
    if (!enabled() || tour || intro) return;
    clearTimeout(timer); returnFocus = document.activeElement; remember();
    if (motion.matches) { introduction(); return; }
    tour = document.createElement('dialog'); tour.className = 'hunt-tour';
    tour.setAttribute('aria-label', 'Follow the light to discover the CO-OP package hunt');
    tour.innerHTML = `<svg class="hunt-spotlight" aria-hidden="true"><defs><mask id="rrhs-hunt-spotlight-mask" maskUnits="userSpaceOnUse"><rect width="100%" height="100%" fill="white"/><circle class="hunt-spotlight-hole" r="110" fill="black"/></mask></defs><rect width="100%" height="100%" fill="#180e14" fill-opacity=".84" mask="url(#rrhs-hunt-spotlight-mask)"/></svg>
      <div class="hunt-tour-veil" aria-hidden="true"></div>
      <div class="hunt-lens" aria-hidden="true"><svg viewBox="0 0 380 380" fill="none"><path d="m229 229 109 109" stroke="#3c1720" stroke-width="36" stroke-linecap="round"/><path d="m239 239 92 92" stroke="#a88148" stroke-width="18" stroke-linecap="round"/><circle cx="140" cy="140" r="127" stroke="#4b1924" stroke-width="18"/><circle cx="140" cy="140" r="121" stroke="#c6a169" stroke-width="7"/><circle cx="140" cy="140" r="115" stroke="#f0dfbf" stroke-opacity=".65" stroke-width="2"/><path d="M63 112a82 82 0 0 1 46-48" stroke="#fff8e8" stroke-opacity=".55" stroke-width="5" stroke-linecap="round"/></svg></div>
      <button type="button" class="hunt-tour-package" aria-label="Inspect the hidden CO-OP dragon sticker" hidden>${stickerImage}</button>
      <p class="hunt-tour-caption" role="status">Something’s hiding in plain sight.<br><span>Follow the light.</span></p>
      <button type="button" class="hunt-tour-skip">Skip introduction <span aria-hidden="true">×</span></button>`;
    document.body.append(tour); oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    tour.showModal(); tour.querySelector('.hunt-tour-skip').focus({ preventScroll: true });
    tour.addEventListener('cancel', event => { event.preventDefault(); dismiss(); });
    tour.querySelector('.hunt-tour-skip').addEventListener('click', dismiss);
    let keyboardSearch = false;
    tour.addEventListener('keydown', event => { if (event.key === 'Tab') keyboardSearch = true; });
    const lens = tour.querySelector('.hunt-lens'), hole = tour.querySelector('.hunt-spotlight-hole'), clue = tour.querySelector('.hunt-tour-package'), veil = tour.querySelector('.hunt-tour-veil');
    const radius = Math.min(118, innerWidth * .21, innerHeight * .24);
    const destination = [innerWidth * (innerWidth < 600 ? .5 : .62), innerHeight * .43];
    const points = [[innerWidth * .28, innerHeight * .28], [innerWidth * .67, innerHeight * .30], [innerWidth * .41, innerHeight * .55], destination];
    lens.style.width = lens.style.height = `${radius / 120 * 380}px`;
    // SVG's optical center is (140,140), not the center of its handle-inclusive box.
    // Keep the ring, clear light and sticker on one shared point at every scale.
    function position(x, y, scale = 1, angle = 0, stickerScale = 1) {
      lens.style.transform = `translate3d(${x - radius * 140 / 120}px,${y - radius * 140 / 120}px,0) rotate(${angle}deg) scale(${scale})`;
      hole.setAttribute('cx', x); hole.setAttribute('cy', y); hole.setAttribute('r', (radius - 3) * scale);
      clue.style.transform = `translate3d(${x - 40}px,${y - 40}px,0) scale(${stickerScale})`;
    }
    position(...points[0]);
    // Travel, linger and tilt at four spots rather than continuously shaking.
    const settledScale = .95;
    const stops = [
      { at: 0, point: 0, scale: 1, angle: -5 },
      { at: 450, point: 0, scale: 1.12, angle: 3 },
      { at: 1550, point: 1, scale: 1.45, angle: -7 },
      { at: 1950, point: 1, scale: 1.45, angle: 5 },
      { at: 3050, point: 2, scale: 1.1, angle: 4 },
      { at: 3500, point: 2, scale: 1.1, angle: -6 },
      { at: 4400, point: 3, scale: 1.4, angle: -4 },
      { at: 5100, point: 3, scale: settledScale, angle: 0 }
    ];
    const began = performance.now();
    function scan(now) {
      if (!tour || !enabled()) return;
      const elapsed = Math.max(0, Math.min(5100, now - began));
      const index = stops.findIndex((stop, i) => i > 0 && elapsed <= stop.at);
      const next = stops[index < 0 ? stops.length - 1 : index];
      const previous = stops[Math.max(0, (index < 0 ? stops.length - 1 : index) - 1)];
      const t = Math.min(1, (elapsed - previous.at) / (next.at - previous.at));
      const eased = t * t * (3 - 2 * t);
      const from = points[previous.point], to = points[next.point];
      position(from[0] + (to[0] - from[0]) * eased,
        from[1] + (to[1] - from[1]) * eased,
        previous.scale + (next.scale - previous.scale) * eased,
        previous.angle + (next.angle - previous.angle) * eased);
      if (elapsed < 5100) frame = requestAnimationFrame(scan);
      else {
        clue.hidden = false;
        tour.classList.add('hunt-tour-found');
        tour.querySelector('.hunt-tour-caption').innerHTML = 'A little discovery.<br><span>Click the dragon sticker to take a closer look.</span>';
        if (keyboardSearch) clue.focus({ preventScroll: true });
      }
    }
    frame = requestAnimationFrame(scan);
    clue.addEventListener('click', () => {
      if (!tour || clue.disabled) return; clue.disabled = true;
      // The dragon poofs away, then the glass grows from where it rests until it fills the screen.
      const began = performance.now(), [x, y] = destination;
      const farthest = Math.max(Math.hypot(x, y), Math.hypot(innerWidth - x, y), Math.hypot(x, innerHeight - y), Math.hypot(innerWidth - x, innerHeight - y));
      const coverScale = (farthest + 24) / (radius - 3), poof = 1050, grow = 750;
      tour.classList.add('hunt-tour-transitioning', 'hunt-tour-poof'); tour.dataset.phase = 'poof';
      clue.insertAdjacentHTML('beforeend', '<span class="hunt-poof" aria-hidden="true">' +
        Array.from({ length: 8 }, (_, i) => `<i style="--a:${i * 45}deg"></i>`).join('') + '</span>');
      tour.querySelector('.hunt-tour-caption').textContent = 'Opening your discovery…';
      function expand(now) {
        if (!tour || !enabled()) return;
        const elapsed = Math.max(0, now - began);
        if (elapsed >= poof) {
          tour.dataset.phase = 'expanding';
          const t = Math.min(1, (elapsed - poof) / grow), ease = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          position(x, y, settledScale + (coverScale - settledScale) * ease);
          lens.style.opacity = String(1 - Math.max(0, (t - .55) / .45));
          veil.style.opacity = String(ease);
          if (t === 1) { introduction(); return; }
        }
        frame = requestAnimationFrame(expand);
      }
      frame = requestAnimationFrame(expand);
    });
  }
  function schedule() {
    if (!enabled() || seen() || scheduled) return;
    scheduled = true;
    timer = setTimeout(function attempt() {
      if (!enabled()) return;
      if (document.hidden || document.querySelector('dialog[open], [aria-modal="true"]')) {
        if (++suspended < 20) timer = setTimeout(attempt, 1000);
        return;
      }
      start();
    }, 3000);
  }
  function activate() { mountCounter(); schedule(); }
  document.addEventListener('rrhs-hunt-availability', event => { data = event.detail; updateCounter(); });
  document.addEventListener('rrhs-hunt-toggle', event => {
    if (event.detail.enabled) activate();
    else { dismiss(); counter?.remove(); tooltip?.remove(); header?.classList.remove('hunt-header-active'); counter = tooltip = header = null; scheduled = false; suspended = 0; }
  });
  if (window.RRHS_RUNTIME) window.RRHS_RUNTIME.onDomChanged(mountCounter);
  else new MutationObserver(mountCounter).observe(document.body, { childList: true, subtree: true });
  addEventListener('resize', () => { placeTooltip(); if (tour) dismiss(); });
  addEventListener('scroll', placeTooltip, { passive: true });
  motion.addEventListener('change', () => { if (motion.matches && tour) introduction(); });
  window.RRHS_HUNT_INTRO = { replay: start, open: showInformation, dismiss };
  if (enabled()) activate();
})();

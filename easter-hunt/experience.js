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
    const sample = !data || data.mode === 'disabled';
    const remaining = sample ? 12 : Math.max(0, Math.min(12, Number.isFinite(data.remaining) ? data.remaining : 12));
    const found = 12 - remaining;
    const preview = !config.HUNT_ENABLED || data?.mode === 'preview' || sample;
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
      ? 'Development preview: this is an example count. The live hunt is closed. Look for the red dragon sticker holding a CO-OP package. Twelve will be hidden around the website. Select this button to read the hunt details.'
      : `${preview ? 'Personal presentation preview. ' : ''}${found} of 12 hidden dragon stickers have been claimed across the hunt. ${remaining} rewards remain. ${preview ? 'Only the Inventory Intelligence test sticker is enabled; no real coupons or emails are created. ' : 'Find the dragon holding a CO-OP package for a mystery reward. One reward per verified student. '}Select to read the hunt details again.`;
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
      ${preview ? '<p class="hunt-preview">You’re viewing the development preview. Only the Inventory Intelligence test sticker is enabled in this browser. No real discounts, codes, or emails are issued.</p>' : `<p class="hunt-intro-tally">${found}/12 found · ${remaining} rewards remaining</p>`}
      <button type="button" class="hunt-primary hunt-intro-start">Let’s find something ${arrowIcon}</button>
      ${preview ? '<button type="button" class="hunt-presenter-link">Open presenter dashboard</button>' : ''}
      <p class="hunt-terms">Valid on the first $25 of eligible merchandise. Ends Friday, November 13, 2026 at 11:59 PM Central.</p>`;
    document.body.append(intro); oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    intro.showModal(); intro.querySelector('.hunt-intro-start').focus({ preventScroll: true });
    intro.querySelector('.hunt-close').addEventListener('click', dismiss);
    intro.querySelector('.hunt-intro-start').addEventListener('click', dismiss);
    intro.querySelector('.hunt-presenter-link')?.addEventListener('click', () => window.RRHS_HUNT_DEMO?.openDashboard());
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
      <div class="hunt-lens" aria-hidden="true"><svg viewBox="0 0 380 380" fill="none"><path d="m229 229 109 109" stroke="#3c1720" stroke-width="36" stroke-linecap="round"/><path d="m239 239 92 92" stroke="#a88148" stroke-width="18" stroke-linecap="round"/><circle cx="140" cy="140" r="127" stroke="#4b1924" stroke-width="18"/><circle cx="140" cy="140" r="121" stroke="#c6a169" stroke-width="7"/><circle cx="140" cy="140" r="115" stroke="#f0dfbf" stroke-opacity=".65" stroke-width="2"/><path d="M63 112a82 82 0 0 1 46-48" stroke="#fff8e8" stroke-opacity=".55" stroke-width="5" stroke-linecap="round"/></svg></div>
      <button type="button" class="hunt-tour-package" aria-label="Inspect the hidden CO-OP dragon sticker" hidden>${stickerImage}</button>
      <p class="hunt-tour-caption" role="status">Something’s hiding in plain sight.<br><span>Follow the light.</span></p>
      <button type="button" class="hunt-tour-skip">Skip introduction <span aria-hidden="true">×</span></button>`;
    document.body.append(tour); oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    tour.showModal(); tour.querySelector('.hunt-tour-skip').focus({ preventScroll: true });
    tour.addEventListener('cancel', event => { event.preventDefault(); dismiss(); });
    tour.querySelector('.hunt-tour-skip').addEventListener('click', dismiss);
    const lens = tour.querySelector('.hunt-lens'), hole = tour.querySelector('.hunt-spotlight-hole'), clue = tour.querySelector('.hunt-tour-package');
    const radius = Math.min(118, innerWidth * .21, innerHeight * .24);
    const destination = [innerWidth * (innerWidth < 600 ? .5 : .62), innerHeight * .43];
    const points = [[innerWidth * .28, innerHeight * .28], [innerWidth * .67, innerHeight * .30], [innerWidth * .41, innerHeight * .55], destination];
    lens.style.width = lens.style.height = `${radius / 120 * 380}px`;
    hole.setAttribute('r', radius - 3);
    function position(x, y) {
      lens.style.transform = `translate3d(${x - radius * 140 / 120}px,${y - radius * 140 / 120}px,0)`;
      hole.setAttribute('cx', x); hole.setAttribute('cy', y);
    }
    const began = performance.now();
    function scan(now) {
      if (!tour || !enabled()) return;
      const progress = Math.max(0, Math.min(3, (now - began) / 760)), segment = Math.min(2, Math.floor(progress));
      const t = progress === 3 ? 1 : progress - segment, eased = t * t * (3 - 2 * t);
      position(points[segment][0] + (points[segment+1][0]-points[segment][0])*eased, points[segment][1] + (points[segment+1][1]-points[segment][1])*eased);
      if (progress < 3) frame = requestAnimationFrame(scan);
      else {
        clue.hidden = false; clue.style.transform = `translate3d(${destination[0] - 40}px,${destination[1] - 40}px,0)`;
        tour.classList.add('hunt-tour-found');
        tour.querySelector('.hunt-tour-caption').innerHTML = 'A little discovery.<br><span>Click the dragon sticker to take a closer look.</span>';
        clue.focus({ preventScroll: true });
      }
    }
    frame = requestAnimationFrame(scan);
    clue.addEventListener('click', () => {
      if (!tour || clue.disabled) return; clue.disabled = true;
      const began = performance.now(), initial = radius - 3, end = Math.hypot(innerWidth, innerHeight);
      lens.animate([{ opacity: 1, scale: '1' }, { opacity: 0, scale: '1.7' }], { duration: 360, fill: 'forwards', easing: 'ease-out' });
      clue.animate([{ opacity: 1, scale: '1' }, { opacity: 0, scale: '1.8' }], { duration: 280, fill: 'forwards' });
      function expand(now) {
        if (!tour || !enabled()) return;
        const t = Math.max(0, Math.min(1, (now - began) / 400));
        hole.setAttribute('r', initial + (end - initial) * (1 - Math.pow(1-t,3)));
        if (t < 1) frame = requestAnimationFrame(expand); else introduction();
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

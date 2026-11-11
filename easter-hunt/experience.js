(function () {
  'use strict';
  if (window.RRHS_HUNT_INTRO || window.parent !== window) return;
  const config = window.RRHS_HUNT_CONFIG;
  const TOTAL = config.locations.length;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const stickerImage = window.RRHS_EASTER_HUNT.stickerImage;
  const headerGuide = new URL('hunt-header-guide.jpg?v=1', document.currentScript.src).href;
  const arrowIcon = window.RRHS_EASTER_HUNT.arrowIcon;
  let counter, tooltip, tour, intro, timer, frame, scheduled = false, oldOverflow, returnFocus, header;
  let data = window.RRHS_EASTER_HUNT?.getAvailability(), suspended = 0;
  const enabled = () => window.RRHS_HUNT_ACTIVE === true;
  // The intro replays on every page load. Only our screenshot tools switch it off.
  function seen() { try { return sessionStorage.getItem('rrhs-hunt-intro-off') === 'true'; } catch (_) { return false; } }
  function counterState() {
    // Until the live count loads (or if it can't), show the full twenty rather than a guess.
    // Count only the stickers this website shows, as the server reports them.
    const eggs = new Map((data?.eggs || []).map(egg => [egg.id, egg]));
    const sample = !config.locations.every(spot => eggs.has(spot.id));
    const found = sample ? 0 : config.locations.filter(spot => { const egg = eggs.get(spot.id);
      return egg.found ?? (data.status === 'active' && !egg.available); }).length;
    const remaining = TOTAL - found;
    const preview = data?.mode === 'preview';
    return { found, remaining, preview, sample };
  }
  function updateCounter() {
    if (!counter || !enabled()) return;
    const { found, remaining, preview, sample } = counterState();
    const count = counter.querySelector('.hunt-counter-count');
    const value = `${found}/${TOTAL}`;
    if (count.textContent !== value) count.textContent = value;
    counter.querySelector('.hunt-counter-preview').hidden = !preview;
    counter.querySelector('button').setAttribute('aria-label', `${preview ? 'Preview. ' : ''}${found} of ${TOTAL} dragon stickers found across the hunt. ${remaining} remaining. Learn about the package hunt.`);
    tooltip.textContent = sample
      ? 'Look for the red dragon sticker holding a CO-OP package. Twenty are hidden around the website. The deeper you dig, the bigger the reward. Select this button to read the hunt details.'
      : `${preview ? 'Local development preview. ' : ''}${found} of ${TOTAL} hidden dragon stickers have been claimed across the hunt. ${remaining} rewards remain. Find the dragon holding a CO-OP package for a mystery reward. One reward per person. Select to read the hunt details again.`;
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
      counter.innerHTML = `<button type="button" class="hunt-counter-trigger" aria-haspopup="dialog" aria-describedby="hunt-counter-tip" title="Read the hunt details">${stickerImage}<span><span class="hunt-counter-count" aria-live="polite">0/${TOTAL}</span><span class="hunt-counter-label"> found</span></span><span class="hunt-counter-preview">Preview</span></button>`;
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
  // A short four-screen guide. After the tour it must be finished once ("Let the hunt begin!");
  // reopened from the header counter it can be closed at any time.
  const tapIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="3.5" fill="currentColor"/><circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="1.6" opacity=".55"/><circle cx="12" cy="12" r="10.5" stroke="currentColor" stroke-width="1.2" opacity=".25"/></svg>';
  const mailIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="m4 7 8 6 8-6" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  const upIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20V5m-6 6 6-6 6 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const backIcon = '<svg class="hunt-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function introduction(locked = false) {
    if (!enabled()) return;
    stopTour();
    const { found, remaining, preview } = counterState();
    const dragon = stickerImage.replace('alt=""', 'alt="Red CO-OP dragon holding a package"');
    const steps = [
      `<div class="hunt-step-art hunt-intro-seal">${dragon}</div>
       <p class="hunt-eyebrow">This is what you’re looking for</p>
       <h2>Good things hide<br>in plain sight.</h2>
       <p>${TOTAL} CO-OP dragons are hiding around this website. The deeper the page, the bigger the reward.</p>
       <div class="hunt-intro-rules"><span><strong>${TOTAL}</strong> hidden dragons</span><span><strong>10–35%</strong> off</span><span><strong>1</strong> per person</span></div>`,
      `<p class="hunt-eyebrow">How to claim</p>
       <h2>Spot it. Tap it.<br>Claim it.</h2>
       <ol class="hunt-how">
         <li><span class="hunt-how-icon">${stickerImage}</span><strong>Spot</strong><span>a dragon on any page</span></li>
         <li><span class="hunt-how-icon">${tapIcon}</span><strong>Tap</strong><span>the sticker</span></li>
         <li><span class="hunt-how-icon">${mailIcon}</span><strong>Claim</strong><span>with your S&#8209;number</span></li>
       </ol>
       <p class="hunt-intro-hint">Teachers and staff: use your @roundrockisd.org email. Your code arrives in your school inbox.</p>`,
      `<p class="hunt-eyebrow">First come, first served</p>
       <div class="hunt-step-art hunt-art-found" aria-hidden="true"><span class="hunt-art-halo"></span>${stickerImage}${window.RRHS_EASTER_HUNT.lensIcon}</div>
       <h2>Once it’s found,<br>it’s gone.</h2>
       <p>The first person to claim a dragon keeps it. Everyone else sees it under a magnifying glass.</p>`,
      `<figure class="hunt-where"><span class="hunt-where-shot"><img src="${headerGuide}" width="800" height="142" alt="The top right of the CO-OP website. The dragon counter sits just left of the search, account and cart icons." decoding="async">
         <span class="hunt-where-count" aria-hidden="true">${found}/${TOTAL}</span><span class="hunt-where-ring" aria-hidden="true"></span></span><span class="hunt-where-tag" aria-hidden="true">${upIcon}Tap here</span></figure>
       <p class="hunt-eyebrow">Look up, top right</p>
       <h2>Come back<br>anytime.</h2>
       <p>Tap the dragon counter in the top right of your page beside search and cart to reopen this guide and see how many are left.</p>
       ${preview ? '<p class="hunt-preview">Local development preview. No real coupon is issued.</p>' : `<p class="hunt-intro-tally">${remaining} of ${TOTAL} dragons still hiding</p>`}`,
    ];
    intro = document.createElement('dialog'); intro.className = 'hunt-dialog hunt-intro-dialog';
    intro.setAttribute('aria-label', 'How the CO-OP package hunt works');
    intro.innerHTML = `${locked ? '' : '<button type="button" class="hunt-close" aria-label="Close the guide">×</button>'}
      <div class="hunt-steps">${steps.map((html, i) => `<section class="hunt-step" aria-label="Step ${i + 1} of ${steps.length}">${html}</section>`).join('')}</div>
      <div class="hunt-confetti" aria-hidden="true"></div>
      <div class="hunt-step-nav">
        <button type="button" class="hunt-step-back">${backIcon}<span>Back</span></button>
        <div class="hunt-dots" aria-hidden="true">${steps.map(() => '<i></i>').join('')}</div>
        <button type="button" class="hunt-primary hunt-step-next"><span>Next</span>${arrowIcon}</button>
      </div>
      <p class="hunt-terms">Ends Friday, November 13 at 11:59 PM Central.</p>`;
    const sections = [...intro.querySelectorAll('.hunt-step')], dots = [...intro.querySelectorAll('.hunt-dots i')];
    const back = intro.querySelector('.hunt-step-back'), next = intro.querySelector('.hunt-step-next');
    let step = -1, finishing = false;
    function show(index) {
      const direction = index > step ? 'next' : 'prev'; step = index;
      sections.forEach((section, i) => {
        const on = i === index; section.inert = !on; section.classList.toggle('is-active', on);
        section.classList.remove('from-next', 'from-prev'); if (on) { void section.offsetWidth; section.classList.add('from-' + direction); }
      });
      dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
      back.style.visibility = index === 0 ? 'hidden' : 'visible';
      const last = index === steps.length - 1;
      next.classList.toggle('hunt-begin', last);
      next.parentElement.classList.toggle('is-last', last);
      next.querySelector('span').textContent = last ? 'Let the hunt begin!' : 'Next';
      next.focus({ preventScroll: true });
    }
    function begin() {
      if (finishing) return; finishing = true;
      const burst = intro.querySelector('.hunt-confetti');
      // Confetti bursts out of the button, mostly upward.
      const button = next.getBoundingClientRect(), box = intro.getBoundingClientRect();
      burst.style.setProperty('--ox', `${button.left - box.left + button.width / 2}px`);
      burst.style.setProperty('--oy', `${button.top - box.top + intro.scrollTop + button.height / 2}px`);
      burst.innerHTML = Array.from({ length: 34 }, (_, i) => { const angle = Math.PI * (1.05 + (i / 34) * 0.9) + Math.sin(i * 7.3) * 0.25, reach = 120 + ((i * 53) % 140);
        return `<i style="--i:${i % 11};--x:${Math.round(Math.cos(angle) * reach)}px;--y:${Math.round(Math.sin(angle) * reach)}px"></i>`; }).join('');
      intro.classList.add('hunt-intro-begin');
      setTimeout(() => {
        intro?.classList.add('hunt-intro-leave');
        setTimeout(() => { dismiss(); counter?.classList.remove('hunt-counter-pulse'); void counter?.offsetWidth; counter?.classList.add('hunt-counter-pulse'); }, motion.matches ? 0 : 320);
      }, motion.matches ? 0 : 1100);
    }
    back.addEventListener('click', () => { if (step > 0 && !finishing) show(step - 1); });
    next.addEventListener('click', () => { if (step < steps.length - 1) show(step + 1); else begin(); });
    intro.addEventListener('keydown', event => {
      if (event.target.closest('input')) return;
      if (event.key === 'ArrowRight' && step < steps.length - 1) show(step + 1);
      if (event.key === 'ArrowLeft' && step > 0) show(step - 1);
    });
    document.body.append(intro); oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    intro.showModal(); show(0);
    intro.querySelector('.hunt-close')?.addEventListener('click', dismiss);
    intro.addEventListener('cancel', event => { event.preventDefault(); if (!locked) dismiss(); });
    intro.addEventListener('click', event => {
      if (locked || event.target !== intro) return;
      const box = intro.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dismiss();
    });
  }
  function showInformation() {
    if (!enabled() || intro) return;
    clearTimeout(timer); returnFocus = document.activeElement; introduction();
  }
  function start() {
    if (!enabled() || tour || intro) return;
    // Marked as seen only once it finishes, so leaving or reloading mid-intro plays it again.
    clearTimeout(timer); returnFocus = document.activeElement;
    if (motion.matches) { introduction(true); return; }
    tour = document.createElement('dialog'); tour.className = 'hunt-tour';
    tour.setAttribute('aria-label', 'Follow the light to discover the CO-OP package hunt');
    tour.innerHTML = `<svg class="hunt-spotlight" aria-hidden="true"><defs><mask id="rrhs-hunt-spotlight-mask" maskUnits="userSpaceOnUse"><rect width="100%" height="100%" fill="white"/><circle class="hunt-spotlight-hole" r="110" fill="black"/></mask></defs><rect width="100%" height="100%" fill="#180e14" fill-opacity=".84" mask="url(#rrhs-hunt-spotlight-mask)"/></svg>
      <div class="hunt-tour-veil" aria-hidden="true"></div>
      <div class="hunt-lens" aria-hidden="true"><svg viewBox="0 0 380 380" fill="none"><path d="m229 229 109 109" stroke="#3c1720" stroke-width="36" stroke-linecap="round"/><path d="m239 239 92 92" stroke="#a88148" stroke-width="18" stroke-linecap="round"/><circle cx="140" cy="140" r="127" stroke="#4b1924" stroke-width="18"/><circle cx="140" cy="140" r="121" stroke="#c6a169" stroke-width="7"/><circle cx="140" cy="140" r="115" stroke="#f0dfbf" stroke-opacity=".65" stroke-width="2"/><path d="M63 112a82 82 0 0 1 46-48" stroke="#fff8e8" stroke-opacity=".55" stroke-width="5" stroke-linecap="round"/></svg></div>
      <button type="button" class="hunt-tour-package" aria-label="Inspect the hidden CO-OP dragon sticker" hidden>${stickerImage}</button>
      <p class="hunt-tour-caption" role="status">Something’s hiding in plain sight.<br><span>Follow the light.</span></p>
`;
    document.body.append(tour); oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    // Everyone watches the intro once: no skip button, Escape does nothing, and the modal
    // blocks the page. The only way forward is clicking the dragon when it appears.
    tour.tabIndex = -1; tour.showModal(); tour.focus({ preventScroll: true });
    tour.addEventListener('cancel', event => event.preventDefault());
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
          if (t === 1) { introduction(true); return; }
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
    }, 1200);
  }
  function activate() { mountCounter(); schedule(); }
  document.addEventListener('rrhs-hunt-availability', event => { data = event.detail; updateCounter(); });
  document.addEventListener('rrhs-hunt-toggle', event => {
    if (event.detail.enabled) activate();
    else { dismiss(); counter?.remove(); tooltip?.remove(); header?.classList.remove('hunt-header-active'); counter = tooltip = header = null; scheduled = false; suspended = 0; }
  });
  if (window.RRHS_RUNTIME) window.RRHS_RUNTIME.onDomChanged(mountCounter);
  else new MutationObserver(mountCounter).observe(document.body, { childList: true, subtree: true });
  // Rotating a phone mid-intro restarts it at the new size instead of ending it.
  let lastWidth = innerWidth, restart;
  addEventListener('resize', () => {
    placeTooltip();
    if (!tour || innerWidth === lastWidth) return;
    lastWidth = innerWidth; clearTimeout(restart);
    restart = setTimeout(() => { if (tour && !tour.classList.contains('hunt-tour-transitioning')) { stopTour(); start(); } }, 250);
  });
  addEventListener('scroll', placeTooltip, { passive: true });
  motion.addEventListener('change', () => { if (motion.matches && tour) introduction(true); });
  window.RRHS_HUNT_INTRO = { replay: start, open: showInformation, dismiss };
  if (enabled()) activate();
})();

(function () {
  'use strict';
  if (window.RRHS_HUNT_INTRO || window.parent !== window) return;
  const config = window.RRHS_HUNT_CONFIG;
  const TOTAL = config.locations.length;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const stickerImage = window.RRHS_EASTER_HUNT.stickerImage;
  const headerGuide = new URL('hunt-header-guide.jpg?v=2', document.currentScript.src).href;
  const arrowIcon = window.RRHS_EASTER_HUNT.arrowIcon;
  let counter, tour, intro, timer, frame, scheduled = false, oldOverflow, returnFocus, header;
  let data = window.RRHS_EASTER_HUNT?.getAvailability(), suspended = 0;
  const enabled = () => window.RRHS_HUNT_ACTIVE === true;
  const introShownKey = 'rrhs-hunt-intro-shown';
  const isReload = performance.getEntriesByType('navigation')[0]?.type === 'reload';
  let shownThisDocument = false;
  // Keep ordinary page navigation quiet, but replay after a browser reload.
  function seen() {
    if (shownThisDocument) return true;
    try { return sessionStorage.getItem('rrhs-hunt-intro-off') === 'true' ||
      (!isReload && sessionStorage.getItem(introShownKey) === 'true'); }
    catch (_) { return false; }
  }
  function remember() {
    shownThisDocument = true;
    try { sessionStorage.setItem(introShownKey, 'true'); } catch (_) {}
  }
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
  }
  function mountCounter() {
    if (!enabled()) return;
    const search = document.querySelector('.ins-header .ins-header__icon--search');
    if (!search && !local) return;
    if (counter?.isConnected && (!search || counter.nextElementSibling === search)) return;
    if (!counter) {
      counter = document.createElement('div'); counter.className = 'hunt-counter';
      counter.innerHTML = `<button type="button" class="hunt-counter-trigger" aria-haspopup="dialog">${stickerImage}<span><span class="hunt-counter-count" aria-live="polite">0/${TOTAL}</span><span class="hunt-counter-label"> found</span></span><span class="hunt-counter-preview">Preview</span></button>`;
      // No hover tooltip: the button opens the guide, which has all the details.
      counter.querySelector('button').addEventListener('click', showInformation);
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
  const upIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20V5m-6 6 6-6 6 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const backIcon = '<svg class="hunt-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const cloudArt = '<svg viewBox="0 0 120 64" fill="none" aria-hidden="true"><path d="M10 55C-5 43 3 22 21 23 17 3 49-7 61 14 78 2 99 14 94 32 120 24 130 55 108 59H21Z" fill="#f9e2ca"/><path d="M24 41C46 50 58 22 39 22 25 22 31 37 39 32M76 47C91 53 99 37 89 34" stroke="#fffaf3" stroke-width="3" stroke-linecap="round"/></svg>';
  const tagIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 12 12 3h9v9l-9 9Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="17" cy="7" r="1.5" fill="currentColor"/></svg>';
  const giftIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10h16v11H4Zm-1-4h18v4H3Zm9 0v15" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 6C3 7 5-2 10 2c1 1 2 4 2 4Zm0 0c9 1 7-8 2-4-1 1-2 4-2 4Z" stroke="currentColor" stroke-width="2"/></svg>';
  const laptopIcon = '<svg class="hunt-mini-laptop" viewBox="0 0 64 40" fill="none" aria-hidden="true"><rect x="9" y="2" width="46" height="30" rx="3" fill="#faf8f4" stroke="currentColor" stroke-width="2.5"/><path d="M3 33h58l-5 5H8Z" fill="#f9e2ca" stroke="currentColor" stroke-width="2.5"/><path d="m29 13 6 7m-7-1 7-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const couponMail = '<svg viewBox="0 0 72 68" fill="none" aria-hidden="true"><path d="M9 28 36 8l27 20v34H9Z" fill="#faf8f4" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="m25 8 29 3-3 30-29-3Z" fill="#edb45b" stroke="currentColor" stroke-width="2.5"/><path d="m31 30 13-12m-9 0h.1m6 13h.1" stroke="#fffaf3" stroke-width="4" stroke-linecap="round"/><path d="m9 28 27 17 27-17M9 62V29l27 16 27-16v33Z" fill="#faf8f4" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>';
  function introduction(locked = false) {
    if (!enabled()) return;
    stopTour();
    const { found, remaining, preview } = counterState();
    const dragon = stickerImage.replace('alt=""', 'alt="Red CO-OP dragon holding a package"');
    const steps = [
      `<p class="hunt-eyebrow">The CO-OP Dragon Hunt</p>
       <div class="hunt-hero hunt-dragon-hero"><div class="hunt-hero-clouds" aria-hidden="true"><span class="hunt-hero-cloud">${cloudArt}</span><span class="hunt-hero-cloud">${cloudArt}</span><span class="hunt-hero-cloud">${cloudArt}</span></div><div class="hunt-step-art hunt-intro-seal">${dragon}</div></div>
       <h2>Good things hide<br>in plain sight.</h2>
       <p>${TOTAL} CO-OP dragons are hiding around this website.<br>The deeper the page, the bigger the reward.</p>
       <div class="hunt-intro-rules"><span>${stickerImage}<strong>${TOTAL}</strong> hidden dragons</span><span>${tagIcon}<strong>10–35%</strong> off</span><span>${giftIcon}<strong>1</strong> per person</span></div>`,
      `<p class="hunt-eyebrow">How to claim</p>
       <h2 class="hunt-simple-title">It’s simple!</h2>
       <div class="hunt-hero hunt-how-hero"><ol class="hunt-how">
         <li><span class="hunt-how-icon hunt-spot-art">${stickerImage}${laptopIcon}</span><strong>1. Spot</strong><span>a dragon on<br>any page</span></li>
         <li><span class="hunt-how-icon hunt-tap-art">${stickerImage}</span><strong>2. Tap</strong><span>the sticker</span></li>
         <li><span class="hunt-how-icon">${couponMail}</span><strong>3. Claim</strong><span>with your<br>S-number</span></li>
       </ol></div>
       <p class="hunt-intro-hint"><span class="hunt-info-icon" aria-hidden="true">i</span><span>Teachers and staff: use your @roundrockisd.org email. Your code will arrive in your school inbox.</span></p>`,
      `<p class="hunt-eyebrow">First come, first served</p>
       <div class="hunt-hero"><div class="hunt-step-art hunt-art-found" aria-hidden="true"><span class="hunt-art-halo"></span>${stickerImage}${window.RRHS_EASTER_HUNT.lensIcon}</div></div>
       <h2>Once it’s found,<br>it’s gone.</h2>
       <p>The first person to claim a dragon keeps it.<br>Everyone else sees it under a magnifying glass.</p>`,
      `<p class="hunt-eyebrow">Look up, top right</p>
       <div class="hunt-hero hunt-header-hero"><figure class="hunt-where"><span class="hunt-where-shot"><img src="${headerGuide}" width="744" height="142" alt="The top right of the CO-OP website. The dragon counter sits just left of the search, account and cart icons." decoding="async">
         <span class="hunt-where-count" aria-hidden="true">${found}/${TOTAL}</span><span class="hunt-where-ring" aria-hidden="true"></span></span><span class="hunt-where-tag" aria-hidden="true">${upIcon}Tap here!</span></figure></div>
       <h2>Come back anytime.</h2>
       <p>Tap the dragon counter in the top right of your page beside search and cart to reopen this guide and see how many are left.</p>
       <p class="hunt-intro-tally">${stickerImage}<span>${remaining} of ${TOTAL} dragons still hiding</span></p>
       ${preview ? '<p class="hunt-guide-preview">Development preview · no real coupon is issued.</p>' : ''}`,
    ];
    intro = document.createElement('dialog'); intro.className = 'hunt-dialog hunt-intro-dialog';
    intro.setAttribute('aria-label', 'How the CO-OP package hunt works');
    intro.tabIndex = -1;
    intro.innerHTML = `${locked ? '' : '<button type="button" class="hunt-close" aria-label="Close the guide">×</button>'}
      <div class="hunt-guide-clouds" aria-hidden="true">${cloudArt}${cloudArt}</div>
      <div class="hunt-steps">${steps.map((html, i) => `<section class="hunt-step" aria-label="Step ${i + 1} of ${steps.length}">${html}</section>`).join('')}</div>
      <div class="hunt-step-nav">
        <button type="button" class="hunt-step-back">${backIcon}<span>Back</span></button>
        <div class="hunt-dots" aria-hidden="true">${steps.map(() => '<i></i>').join('')}</div>
        <button type="button" class="hunt-primary hunt-step-next"><span>Next</span>${arrowIcon}</button>
      </div>
      <p class="hunt-terms">Ends Friday, November 13 at 11:59 PM Central.</p>`;
    const sections = [...intro.querySelectorAll('.hunt-step')], dots = [...intro.querySelectorAll('.hunt-dots i')];
    const back = intro.querySelector('.hunt-step-back'), next = intro.querySelector('.hunt-step-next');
    let step = -1, finishing = false;
    function show(index, focusNext = false) {
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
      next.setAttribute('aria-label', last ? 'Begin the hunt' : 'Next step');
      if (focusNext) next.focus({ preventScroll: true });
    }
    function begin() {
      if (finishing) return; finishing = true;
      intro.classList.add('hunt-intro-leave');
      setTimeout(() => {
        dismiss();
        counter?.classList.remove('hunt-counter-pulse'); void counter?.offsetWidth;
        counter?.classList.add('hunt-counter-pulse');
      }, motion.matches ? 0 : 320);
    }
    back.addEventListener('click', () => { if (step > 0 && !finishing) show(step - 1); });
    next.addEventListener('click', () => { if (step < steps.length - 1) show(step + 1); else begin(); });
    intro.addEventListener('keydown', event => {
      if (event.target.closest('input')) return;
      if (event.key === 'ArrowRight' && step < steps.length - 1) show(step + 1, true);
      if (event.key === 'ArrowLeft' && step > 0) show(step - 1, true);
    });
    document.body.append(intro); oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    intro.showModal(); intro.focus({ preventScroll: true }); show(0);
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
    clearTimeout(timer); returnFocus = document.activeElement; remember(); introduction();
  }
  function start() {
    if (!enabled() || tour || intro) return;
    clearTimeout(timer); returnFocus = document.activeElement; remember();
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
    else { dismiss(); counter?.remove(); header?.classList.remove('hunt-header-active'); counter = header = null; scheduled = false; suspended = 0; }
  });
  if (window.RRHS_RUNTIME) window.RRHS_RUNTIME.onDomChanged(mountCounter);
  else new MutationObserver(mountCounter).observe(document.body, { childList: true, subtree: true });
  // Rotating a phone mid-intro restarts it at the new size instead of ending it.
  let lastWidth = innerWidth, restart;
  addEventListener('resize', () => {
    if (!tour || innerWidth === lastWidth) return;
    lastWidth = innerWidth; clearTimeout(restart);
    restart = setTimeout(() => { if (tour && !tour.classList.contains('hunt-tour-transitioning')) { stopTour(); start(); } }, 250);
  });
  motion.addEventListener('change', () => { if (motion.matches && tour) introduction(true); });
  window.RRHS_HUNT_INTRO = { replay: start, open: showInformation, dismiss };
  if (enabled()) activate();
})();

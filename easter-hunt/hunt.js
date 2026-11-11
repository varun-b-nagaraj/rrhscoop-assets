(function () {
  'use strict';
  if (window.RRHS_EASTER_HUNT) return;
  const config = window.RRHS_HUNT_CONFIG;
  const assetOrigin = new URL(document.currentScript.src).origin;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const preview = config.DEV_PREVIEW_ENABLED && local;
  // Live mode remains closed at the API, regardless of the client switch.
  const endpoint = assetOrigin + '/api/v1/easter-hunt';
  const stickerSrc = new URL(config.stickerPath, document.currentScript.src).href;
  const stickerImage = `<img class="hunt-sticker" src="${stickerSrc}" width="256" height="256" alt="" decoding="async" draggable="false">`;
  const arrowIcon = '<svg class="hunt-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  let availability, dialog, active, trigger, returnOverflow, generation = 0, refreshPending = false;
  const mounted = new Map();
  // `fresh` skips Vercel's short cache so a click always sees the latest claims.
  async function request(data, fresh) {
    const response = await fetch(fresh ? `${endpoint}?fresh=${Date.now()}` : endpoint, { method: data ? 'POST' : 'GET', cache: 'no-store',
      headers: data ? { 'Content-Type': 'application/json' } : {}, body: data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(10000) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'We couldn’t open this package. Please try again.');
    return result;
  }
  function escape(value) { const span = document.createElement('span'); span.textContent = value; return span.innerHTML; }
  // A sticker shows only on its own page, beside the heading it names.
  function targetFor(spot) {
    if (spot.page && !new RegExp(spot.page, 'i').test(decodeURIComponent(window.location.pathname))) return null;
    const matches = document.querySelectorAll(spot.selector);
    return spot.text ? [...matches].find(element => element.textContent.includes(spot.text)) || null : matches[0] || null;
  }
  const lensIcon = '<svg class="hunt-found-lens" viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="m25 25 11 11" stroke="#3c1720" stroke-width="5.5" stroke-linecap="round"/><path d="m26.5 26.5 8 8" stroke="#a88148" stroke-width="2.5" stroke-linecap="round"/><circle cx="16" cy="16" r="12.5" fill="#fff8e8" fill-opacity=".35" stroke="#4b1924" stroke-width="3"/><circle cx="16" cy="16" r="11" stroke="#c6a169" stroke-width="1.2"/></svg>';
  const foundHere = new Set();
  function available(id) { return !foundHere.has(id) && availability?.eggs?.some(egg => egg.id === id && egg.available); }
  // The server decides: once anyone claims a sticker it stays on the page, disabled, under a magnifying glass.
  function found(id) {
    if (foundHere.has(id)) return true;
    const egg = availability?.eggs?.find(entry => entry.id === id);
    return Boolean(egg && (egg.found ?? (availability.status === 'active' && !egg.available)));
  }
  // Tell this browser's other tabs and the page's sticker iframes the moment a sticker is found.
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('rrhs-hunt') : null;
  function markFound(id, announce = true) {
    if (!config.locations.some(spot => spot.id === id)) return;
    foundHere.add(id); mount();
    if (active?.id === id) unavailable();
    if (!announce) return;
    channel?.postMessage({ type: 'rrhs-hunt-found', id });
    if (window.parent === window) for (const frame of document.querySelectorAll('iframe')) {
      try { if (new URL(frame.src).origin === assetOrigin) frame.contentWindow.postMessage({ type: 'rrhs-hunt-found', id }, assetOrigin); } catch (_) {}
    }
  }
  if (channel) channel.onmessage = event => { if (event.data?.type === 'rrhs-hunt-found') markFound(event.data.id, false); };
  addEventListener('message', event => {
    if (event.data?.type === 'rrhs-hunt-found' && event.source === window.parent && event.origin === window.RRHS_HUNT_PARENT) markFound(event.data.id, false);
  });
  function paint(button, id) {
    const isFound = found(id);
    button.style.visibility = isFound || available(id) ? 'visible' : 'hidden';
    button.classList.toggle('hunt-found', isFound); button.disabled = isFound;
    button.setAttribute('aria-label', isFound ? 'CO-OP dragon sticker, already found' : 'Open hidden CO-OP dragon sticker');
    if (isFound) button.title = 'Already found by another Dragon'; else button.removeAttribute('title');
  }
  function mount() {
    if (!window.RRHS_HUNT_ACTIVE) return;
    for (const location of config.locations) {
      if (preview && !config.DEV_ALL_EGGS_ENABLED && location.id !== 'inventory-intelligence') continue;
      const target = targetFor(location);
      const previous = mounted.get(location.id);
      if (previous && previous.target === target && previous.button.isConnected) {
        paint(previous.button, location.id); continue;
      }
      if (previous) { previous.observer?.disconnect(); previous.button.remove(); mounted.delete(location.id); }
      if (!target) continue;
      const button = EasterEgg(location.id);
      paint(button, location.id);
      let observer;
      const interactive = target.closest('button, a');
      if (interactive) {
        const container = interactive.parentElement;
        container.style.position = 'relative';
        target.classList.add('hunt-has-package');
        container.append(button); button.classList.add('hunt-egg-overlay');
        const position = () => {
          const heading = target.getBoundingClientRect(), bounds = container.getBoundingClientRect();
          button.style.top = `${heading.top - bounds.top - 6}px`;
          button.style.left = `${heading.right - bounds.left - 44}px`;
        };
        observer = new ResizeObserver(position); observer.observe(container); observer.observe(target);
        position();
      } else { target.append(button); }
      mounted.set(location.id, { target, button, observer });
    }
  }
  function EasterEgg(id) {
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'hunt-egg'; button.dataset.eggId = id;
    button.setAttribute('aria-label', 'Open hidden CO-OP dragon sticker');
    button.innerHTML = stickerImage + lensIcon;
    button.addEventListener('click', event => {
      event.stopPropagation();
      if (window.RRHS_HUNT_PARENT && window.parent !== window) parent.postMessage({ type: 'rrhs-hunt-open', id }, window.RRHS_HUNT_PARENT);
      else open(id, button);
    });
    return button;
  }
  function close() {
    generation++; active = null;
    dialog.close(); document.body.style.overflow = returnOverflow;
    const focusTarget = trigger && !trigger.disabled && getComputedStyle(trigger).visibility !== 'hidden'
      ? trigger : trigger?.parentElement.querySelector('.project-card-button');
    focusTarget?.focus({ preventScroll: true });
    dialog.querySelector('.hunt-content').replaceChildren();
  }
  function ensureDialog() {
    if (dialog) return;
    dialog = document.createElement('dialog'); dialog.className = 'hunt-dialog';
    dialog.setAttribute('aria-labelledby', 'hunt-title');
    dialog.innerHTML = '<button type="button" class="hunt-close" aria-label="Close package">×</button><div class="hunt-content"></div>';
    document.body.append(dialog);
    dialog.querySelector('.hunt-close').addEventListener('click', close);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close();
    });
    dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href]')].filter(el => !el.hidden);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
  }
  function open(id, button) {
    if (!window.RRHS_HUNT_ACTIVE) return;
    ensureDialog(); if (dialog.open) return;
    trigger = button; const version = ++generation;
    active = { id, key: crypto.randomUUID(), submitting: false };
    const content = dialog.querySelector('.hunt-content');
    content.innerHTML = `<div class="hunt-package hunt-discovered">${stickerImage}</div><p class="hunt-eyebrow">A little CO-OP luck</p>
      <h2 id="hunt-title">You found a<br>hidden package!</h2>
      <p>You spotted our CO-OP dragon sticker! One of twenty little discoveries, with a mystery reward just for you.</p>
      ${preview ? '<p class="hunt-preview">Local development preview · no real reward or coupon is created.</p>' : ''}
      <form class="hunt-form"><label for="hunt-student">${preview ? 'Your S-number, including the s' : 'Your S-number or staff email'}</label>
      <input id="hunt-student" name="studentId" type="text" placeholder="${preview ? 's123456' : 's123456 or name@roundrockisd.org'}" maxlength="80" required autocomplete="off" autocapitalize="none" spellcheck="false" aria-describedby="hunt-helper hunt-status">
      <p id="hunt-helper" class="hunt-helper">${preview ? 'Enter your S-number including the s. Local previews send no email.' : 'Students: enter your S-number, including the s. Staff: enter your @roundrockisd.org email. We’ll email your one-time code to your school inbox.'}</p>
      <p id="hunt-status" class="hunt-status" role="status" aria-live="polite"></p>
      <button class="hunt-primary" type="submit">Unwrap my mystery reward ${arrowIcon}</button></form>
      <p class="hunt-terms">One reward per student. Ends Friday, November 13 at 11:59 PM Central.</p>`;
    returnOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    dialog.showModal();
    const input = content.querySelector('input'), status = content.querySelector('#hunt-status'), submit = content.querySelector('[type=submit]');
    input.focus({ preventScroll: true });
    content.querySelector('form').addEventListener('submit', async event => {
      event.preventDefault(); if (active?.submitting || version !== generation) return;
      const who = input.value.trim();
      // Students use their S-number; staff use their district email (local previews: S-numbers only).
      const valid = /^s\d{4,10}$/i.test(who) || (!preview && /^[a-z0-9][a-z0-9._+-]{0,63}@roundrockisd\.org$/i.test(who));
      if (!valid) { status.textContent = preview ? 'Include the s followed by your student number.' : 'Enter your S-number, like s123456, or your @roundrockisd.org staff email.'; input.focus(); return; }
      active.submitting = true; submit.disabled = true; input.disabled = true;
      status.textContent = preview ? 'Opening your preview package…' : 'Unwrapping your reward…';
      try {
        const result = await request({ action: 'claim', eggId: id, studentId: input.value.trim(), idempotencyKey: active.key });
        if (version !== generation) return;
        active.submitting = false; active.claimed = true; markFound(id);
        reveal(result, version); refresh();
      } catch (error) {
        if (version !== generation) return;
        active.submitting = false; submit.disabled = false; input.disabled = false;
        status.textContent = error.message; input.focus(); refresh(true);
      }
    });
    if (!available(id)) unavailable();
    refresh(true);
  }
  function unavailable() {
    if (!active || active.claimed || active.submitting) return;
    dialog.querySelector('#hunt-status').textContent = availability?.status === 'expired'
      ? 'The hunt has ended. Thanks for exploring!'
      : 'This package is unavailable now. Another Dragon may have found it first. Keep exploring!';
    dialog.querySelector('[type=submit]').disabled = true;
  }
  function reveal(result, version) {
    const content = dialog.querySelector('.hunt-content');
    content.innerHTML = `<div class="hunt-package hunt-unwrapped">${stickerImage}<div class="hunt-confetti" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => `<i style="--i:${i};--x:${Math.round(Math.cos(i * 2.4) * 140)}px;--y:${Math.round(Math.sin(i * 2.4) * 110)}px"></i>`).join('')}</div></div>
      <p class="hunt-eyebrow">A lovely little find</p><h2 id="hunt-title">You unlocked<br><span class="hunt-percentage" aria-hidden="true">0</span><span aria-hidden="true">% OFF!</span><span class="hunt-sr-only">${result.percentage}% OFF!</span></h2>
      <p>${preview ? 'Valid on the first $25 of your eligible cart subtotal.' : 'Off your next eligible CO-OP online order.'}</p>
      ${preview ? `<p class="hunt-preview">Dev preview · no discount code was created.<br>${result.emailStatus === 'sent' ? `A real preview email was sent to <strong>${escape(result.email)}</strong>.` : 'Your preview reward is saved. Email delivery has not been confirmed.'}</p>`
        : `<p class="hunt-delivery">Your one-time code ${result.emailStatus === 'sent' ? 'is on its way to' : 'will be emailed to'} <strong>${escape(result.email)}</strong>.</p>`}
      <p class="hunt-terms">Expires Friday, November 13, 2026 at 11:59 PM Central.<br>One use. Excludes taxes, fees, and delivery. No coupon stacking.</p>
      <p class="hunt-status" role="status">${preview ? `Preview reward reserved. ${result.emailStatus === 'sent' ? 'Check your school inbox.' : 'No email is sent from a local preview.'}`
        : result.emailStatus === 'sent' ? 'Reward saved. Check your school inbox for the code.' : 'Reward saved. Your email is being retried; check your school inbox in a few minutes.'}</p>
      <button type="button" class="hunt-primary">Continue shopping ${arrowIcon}</button>`;
    content.querySelector('button').addEventListener('click', close);
    content.querySelector('button').focus({ preventScroll: true });
    const counter = content.querySelector('.hunt-percentage');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now();
    function tick(time) {
      if (version !== generation) return;
      const t = reduced ? 1 : Math.min(1, (time - start) / 1100);
      counter.textContent = Math.round(result.percentage * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  async function refresh(fresh) {
    if (!window.RRHS_HUNT_ACTIVE || (refreshPending && !fresh) || document.hidden) return;
    refreshPending = true;
    try { availability = await request(null, fresh === true); if (!window.RRHS_HUNT_ACTIVE) return; mount(); if (active && !available(active.id)) unavailable(); }
    catch (_) { availability = null; if (window.RRHS_HUNT_ACTIVE) mount(); }
    finally { refreshPending = false; }
    document.dispatchEvent(new CustomEvent('rrhs-hunt-availability', { detail: availability }));
  }
  document.addEventListener('rrhs-hunt-toggle', event => {
    if (event.detail.enabled) { mount(); refresh(); }
    else {
      if (dialog?.open) close();
      for (const { target, button, observer } of mounted.values()) { observer?.disconnect(); button.remove(); target.classList.remove('hunt-has-package'); }
      mounted.clear();
    }
  });
  window.RRHS_EASTER_HUNT = { EasterEgg, refresh, open, stickerImage, arrowIcon, getAvailability: () => availability };
  refresh();
  if (window.RRHS_RUNTIME) window.RRHS_RUNTIME.onDomChanged(mount);
  else {
    const observer = new MutationObserver(mount); observer.observe(document.body, { childList: true, subtree: true });
  }
  setInterval(refresh, 5000);
  addEventListener('focus', () => refresh()); document.addEventListener('visibilitychange', () => refresh());
})();

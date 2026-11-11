(function () {
  'use strict';
  if (window.RRHS_EASTER_HUNT) return;
  const config = window.RRHS_HUNT_CONFIG;
  const assetOrigin = new URL(document.currentScript.src).origin;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const dev = () => window.RRHS_HUNT_DEV === true;
  const preview = !dev() && config.DEV_PREVIEW_ENABLED && local;
  // Live mode remains closed at the API, regardless of the client switch.
  const endpoint = assetOrigin + '/api/v1/easter-hunt';
  const stickerSrc = new URL(config.stickerPath, document.currentScript.src).href;
  const stickerImage = `<img class="hunt-sticker" src="${stickerSrc}" width="256" height="256" alt="" decoding="async" draggable="false">`;
  const arrowIcon = '<svg class="hunt-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  let availability, dialog, active, trigger, returnOverflow, generation = 0, refreshPending = false;
  const mounted = new Map();
  // `fresh` skips Vercel's short cache so a click always sees the latest claims.
  // Dev mode: a pretend backend kept in this browser. Codes are fake and never reach Ecwid.
  const DEV_STATE = 'rrhs-hunt-dev-state', DEV_REWARDS = [10, 10, 10, 10, 10, 10, 10, 15, 15, 15, 15, 15, 15, 20, 20, 20, 20, 25, 25, 35];
  function devState() { try { return JSON.parse(localStorage.getItem(DEV_STATE)) || { claims: [] }; } catch (_) { return { claims: [] }; } }
  async function devRequest(data) {
    await new Promise(resolve => setTimeout(resolve, data ? 700 : 120));
    const state = devState(), taken = new Set([...state.claims.map(claim => claim.eggId), ...(window.RRHS_HUNT_DEV_FOUND || []), ...foundHere]);
    if (!data) return { mode: 'dev', status: 'active', expiresAt: config.expiresAt, remaining: config.locations.filter(spot => !taken.has(spot.id)).length,
      eggs: config.locations.map(spot => ({ id: spot.id, available: !taken.has(spot.id), found: taken.has(spot.id) })) };
    const who = String(data.studentId || '').trim().toLowerCase();
    if (taken.has(data.eggId) || state.claims.some(claim => claim.who === who)) throw new Error('This package could not be claimed. You may already have a reward, or another Dragon got here first. (Dev mode: run rrhsHunt.reset() to clear fake claims.)');
    const percentage = DEV_REWARDS[Math.floor(Math.random() * DEV_REWARDS.length)];
    const code = 'FAKE-' + Array.from(crypto.getRandomValues(new Uint8Array(8)), byte => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[byte % 32]).join('');
    state.claims.push({ eggId: data.eggId, who, percentage, code, at: new Date().toISOString() });
    try { localStorage.setItem(DEV_STATE, JSON.stringify(state)); } catch (_) {}
    const result = { mode: 'dev', percentage, code, emailStatus: 'fake', email: /^s\d/.test(who) ? who + '@student.roundrockisd.org' : who };
    // A real, clearly marked test email (dashboard admins only). The fake claim stands even if it fails.
    try {
      const response = await fetch(endpoint, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dev-email', studentId: who, eggId: data.eggId, code }), signal: AbortSignal.timeout(30000) });
      const sent = await response.json();
      if (response.ok) result.emailStatus = 'sent'; else result.emailNote = sent.error;
    } catch (_) { result.emailNote = 'The test email could not be sent.'; }
    return result;
  }
  async function request(data, fresh) {
    if (dev()) return devRequest(data);
    const response = await fetch(fresh ? `${endpoint}?fresh=${Date.now()}` : endpoint, { method: data ? 'POST' : 'GET', cache: 'no-store',
      headers: data ? { 'Content-Type': 'application/json' } : {}, body: data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(data ? 55000 : 10000) });
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
  // The glass is centered on the sticker; the handle reaches out past its bottom-right corner.
  const lensIcon = '<svg class="hunt-found-lens" viewBox="0 0 56 56" fill="none" aria-hidden="true"><path d="M35.5 35.5 51 51" stroke="#3c1720" stroke-width="7" stroke-linecap="round"/><path d="M37.5 37.5 49.5 49.5" stroke="#a88148" stroke-width="2.6" stroke-linecap="round"/><circle cx="22" cy="22" r="19" fill="#fff8e8" fill-opacity=".22" stroke="#4b1924" stroke-width="3.6"/><circle cx="22" cy="22" r="16.8" stroke="#c6a169" stroke-width="1.3"/><path d="M10.5 17.5a12.5 12.5 0 0 1 7-7.2" stroke="#fff" stroke-opacity=".75" stroke-width="2.2" stroke-linecap="round"/></svg>';
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
    if (event.data?.type !== 'rrhs-hunt-found' || event.source !== window.parent || event.origin !== window.RRHS_HUNT_PARENT) return;
    for (const id of event.data.ids || [event.data.id]) markFound(id, false);
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
      <p class="hunt-terms">One reward per person. Ends Friday, November 13 at 11:59 PM Central.</p>`;
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
        : result.mode === 'dev' ? `<p class="hunt-preview hunt-dev-code">Dev mode · fake code <code>${escape(result.code)}</code><br>It won’t work at checkout. ${result.emailStatus === 'sent' ? `A test email was sent to <strong>${escape(result.email)}</strong>.` : escape(result.emailNote || 'No email was sent.')}</p>`
      : `<p class="hunt-delivery">Your one-time code ${result.emailStatus === 'sent' ? 'is on its way to' : 'will be emailed to'} <strong>${escape(result.email)}</strong>.</p>`}
      <p class="hunt-terms">Expires Friday, November 13, 2026 at 11:59 PM Central.<br>One use. Excludes taxes, fees, and delivery. No coupon stacking.</p>
      <p class="hunt-status" role="status">${preview ? `Preview reward reserved. ${result.emailStatus === 'sent' ? 'Check your school inbox.' : 'No email is sent from a local preview.'}`
        : result.mode === 'dev' ? 'Dev mode: this fake claim is saved only in this browser. Use Reset claims to clear it.'
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
    try { const next = await request(null, fresh === true);
      // A reset (or a new promo) changes the scope: forget what this tab marked as found.
      if (availability?.scope && next.scope && availability.scope !== next.scope) foundHere.clear();
      availability = next; if (!window.RRHS_HUNT_ACTIVE) return; mount(); if (active && !available(active.id)) unavailable();
      // Dev mode: fake claims live in this page's storage, so keep the sticker iframes in step.
      if (dev() && window.parent === window) { const ids = availability.eggs.filter(egg => egg.found).map(egg => egg.id);
        if (ids.length) for (const frame of document.querySelectorAll('iframe')) { try { if (new URL(frame.src).origin === assetOrigin) frame.contentWindow.postMessage({ type: 'rrhs-hunt-found', ids }, assetOrigin); } catch (_) {} } } }
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
  window.RRHS_EASTER_HUNT = { EasterEgg, refresh, open, stickerImage, arrowIcon, lensIcon, foundIds: () => [...new Set([...foundHere, ...devState().claims.map(claim => claim.eggId)])], getAvailability: () => availability };
  if (dev() && window.parent === window) {
    const badge = document.createElement('div'); badge.className = 'hunt-dev-badge'; badge.setAttribute('role', 'status');
    badge.innerHTML = '<strong>Hunt dev mode</strong><span>Fake codes only</span><button type="button" data-dev="reset">Reset claims</button><button type="button" data-dev="off">Turn off</button>';
    badge.addEventListener('click', event => { const action = event.target.closest('[data-dev]')?.dataset.dev;
      if (action === 'reset') window.rrhsHunt.reset(); if (action === 'off') window.rrhsHunt.dev(false); });
    document.body.append(badge);
  }
  refresh();
  if (window.RRHS_RUNTIME) window.RRHS_RUNTIME.onDomChanged(mount);
  else {
    const observer = new MutationObserver(mount); observer.observe(document.body, { childList: true, subtree: true });
  }
  setInterval(refresh, 5000);
  addEventListener('focus', () => refresh()); document.addEventListener('visibilitychange', () => refresh());
})();

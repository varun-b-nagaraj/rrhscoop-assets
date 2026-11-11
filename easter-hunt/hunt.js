(function () {
  'use strict';
  if (window.RRHS_EASTER_HUNT) return;
  const config = window.RRHS_HUNT_CONFIG;
  const assetOrigin = new URL(document.currentScript.src).origin;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const preview = !config.HUNT_ENABLED || (config.DEV_PREVIEW_ENABLED && local);
  // Live mode remains closed at the API, regardless of the client switch.
  const endpoint = assetOrigin + '/api/v1/easter-hunt';
  const stickerSrc = new URL(config.stickerPath, document.currentScript.src).href;
  const stickerImage = `<img class="hunt-sticker" src="${stickerSrc}" width="256" height="256" alt="" decoding="async" draggable="false">`;
  let availability, dialog, active, trigger, returnOverflow, generation = 0, refreshPending = false;
  const mounted = new Map();
  async function request(data) {
    const response = await fetch(endpoint, { method: data ? 'POST' : 'GET', cache: 'no-store',
      headers: data ? { 'Content-Type': 'application/json' } : {}, body: data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(10000) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'We couldn’t open this package. Please try again.');
    return result;
  }
  function escape(value) { const span = document.createElement('span'); span.textContent = value; return span.innerHTML; }
  function available(id) { return availability?.eggs?.some(egg => egg.id === id && egg.available); }
  function mount() {
    if (!window.RRHS_HUNT_ACTIVE) return;
    for (const location of config.locations) {
      if (preview && !config.DEV_ALL_EGGS_ENABLED && location.id !== 'inventory-intelligence') continue;
      const target = document.querySelector(location.selector);
      const previous = mounted.get(location.id);
      if (previous && previous.target === target && previous.button.isConnected) {
        previous.button.style.visibility = available(location.id) ? 'visible' : 'hidden'; continue;
      }
      if (previous) { previous.observer?.disconnect(); previous.button.remove(); mounted.delete(location.id); }
      if (!target) continue;
      const button = EasterEgg(location.id);
      button.style.visibility = available(location.id) ? 'visible' : 'hidden';
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
    button.innerHTML = stickerImage;
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
    const focusTarget = trigger && getComputedStyle(trigger).visibility !== 'hidden'
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
      <p>You spotted our CO-OP dragon sticker! One of twelve little discoveries, with a mystery reward just for you.</p>
      ${preview ? '<p class="hunt-preview">Dev preview · verification and email are simulated.<br>No real reward, coupon, or email is created.</p>' : ''}
      <form class="hunt-form"><label for="hunt-student">Your S-number, including the s</label>
      <input id="hunt-student" name="studentId" type="text" placeholder="s123456" pattern="[sS][0-9]{4,10}" maxlength="11" required autocomplete="off" autocapitalize="none" spellcheck="false" aria-describedby="hunt-helper hunt-status">
      <p id="hunt-helper" class="hunt-helper">${preview ? 'We’ll simulate delivery to your S-number@student.roundrockisd.org address.' : 'Your reward goes only to your verified school email.'}</p>
      <p id="hunt-status" class="hunt-status" role="status" aria-live="polite"></p>
      <button class="hunt-primary" type="submit">Unwrap my mystery reward <span aria-hidden="true">↗</span></button></form>
      <p class="hunt-terms">One reward per student. Ends Friday, November 13 at 11:59 PM Central.</p>`;
    returnOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    dialog.showModal();
    const input = content.querySelector('input'), status = content.querySelector('#hunt-status'), submit = content.querySelector('[type=submit]');
    input.focus({ preventScroll: true });
    content.querySelector('form').addEventListener('submit', async event => {
      event.preventDefault(); if (active?.submitting || version !== generation) return;
      if (!/^s\d{4,10}$/i.test(input.value.trim())) { status.textContent = 'Include the s followed by your student number.'; input.focus(); return; }
      active.submitting = true; submit.disabled = true; input.disabled = true;
      status.textContent = preview ? 'Opening your preview package…' : 'Checking your school verification…';
      try {
        const result = await request({ action: 'claim', eggId: id, studentId: input.value.trim(), idempotencyKey: active.key });
        if (version !== generation) return;
        active.submitting = false; active.claimed = true;
        reveal(result, version); refresh();
      } catch (error) {
        if (version !== generation) return;
        active.submitting = false; submit.disabled = false; input.disabled = false;
        status.textContent = error.message; input.focus(); refresh();
      }
    });
    if (!available(id)) unavailable();
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
      <p>Valid on the first $25 of your eligible cart subtotal.</p>
      <p class="hunt-preview">Dev preview · no discount code was created.<br>${escape(result.name)}, delivery to <strong>${escape(result.email)}</strong> was simulated. No email was sent.</p>
      <p class="hunt-terms">Expires Friday, November 13, 2026 at 11:59 PM Central.<br>One use. Excludes taxes, fees, and delivery. No coupon stacking.</p>
      <p class="hunt-status" role="status">Preview reward reserved. Your simulated email is ready to view.</p>
      <button type="button" class="hunt-primary">Continue shopping <span aria-hidden="true">↗</span></button>`;
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
  async function refresh() {
    if (!window.RRHS_HUNT_ACTIVE || refreshPending || document.hidden) return;
    refreshPending = true;
    try { availability = await request(); if (!window.RRHS_HUNT_ACTIVE) return; mount(); if (active && !available(active.id)) unavailable(); }
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
  window.RRHS_EASTER_HUNT = { EasterEgg, refresh, open, stickerImage, getAvailability: () => availability };
  refresh();
  if (window.RRHS_RUNTIME) window.RRHS_RUNTIME.onDomChanged(mount);
  else {
    const observer = new MutationObserver(mount); observer.observe(document.body, { childList: true, subtree: true });
  }
  setInterval(refresh, 15000);
  addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
})();

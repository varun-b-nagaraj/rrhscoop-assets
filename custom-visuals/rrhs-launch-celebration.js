/* November 9 e-commerce launch and Deepawali promotion. */
(function () {
  if (window.RRHS_LAUNCH) return;
  const base = new URL('.', document.currentScript.src);
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('rrhs-launch-celebration.css?v=1', base).href;
  document.head.appendChild(stylesheet);

  let dialog;
  let revealTimer;
  let autoTimer;
  let previousFocus;
  let previousOverflow;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const isHome = () => /^\/$/.test(location.pathname) && !location.hash.match(/cart|checkout|product|account|search/i);

  function close() {
    clearTimeout(revealTimer);
    if (!dialog || !dialog.open) return;
    dialog.close();
  }

  function createDialog() {
    dialog = document.createElement('dialog');
    dialog.className = 'rrhs-launch';
    dialog.setAttribute('aria-labelledby', 'rrhs-launch-title');
    dialog.setAttribute('aria-describedby', 'rrhs-launch-description');
    dialog.innerHTML = `
      <div class="rrhs-launch__paint" aria-hidden="true"></div>
      <button class="rrhs-launch__close" type="button" aria-label="Close launch announcement" autofocus>×</button>
      <article class="rrhs-launch__card">
        <div class="rrhs-launch__art" aria-hidden="true">
          <span class="rrhs-launch__eyebrow">A little light. A lot to celebrate.</span>
          <span class="rrhs-launch__date">NOV<span>09</span></span>
          <svg class="rrhs-launch__diya" viewBox="0 0 240 170" fill="none"><path d="M120 82C79 54 118 23 124 8c3 25 37 49-4 74Z" fill="currentColor"/><path d="M34 103c19 68 153 68 172 0H34Z" fill="currentColor"/><ellipse cx="120" cy="103" rx="86" ry="15" stroke="currentColor" stroke-width="3"/><path d="M79 135c25 17 57 17 82 0M120 111v12" stroke="#6e1f2a" stroke-width="4" stroke-linecap="round"/></svg>
          <span class="rrhs-launch__art-label">Deepawali at the CO-OP</span>
        </div>
        <div class="rrhs-launch__content">
          <p class="rrhs-launch__eyebrow">E-commerce launch · November 9</p>
          <h2 id="rrhs-launch-title">A brighter way<br>to shop.</h2>
          <p id="rrhs-launch-description">We’re launching e-commerce on November 9, alongside a Deepawali celebration. Come celebrate with us at the Co-op!</p>
          <div class="rrhs-launch__offer">
            <span class="rrhs-launch__eyebrow">Your purchase. A little extra celebration.</span>
            <h3>Shop online. Get free henna.</h3>
            <p>Place an e-commerce order, then show your receipt at the Co-op during <strong>3rd period on November 9</strong> to redeem your free henna design.</p>
          </div>
          <details class="rrhs-launch__details">
            <summary>About Deepawali &amp; our online store</summary>
            <p>Deepawali, also known as Diwali or the Festival of Lights, is a major Hindu festival celebrating light over darkness, good over evil, and knowledge over ignorance. Celebrated over five days, it includes lighting oil lamps (diyas), fireworks, and decorating homes to welcome prosperity and good fortune.</p>
            <p>We’re bringing that spirit to the Co-op’s e-commerce reopening. Students and staff can order online for classroom delivery.</p>
          </details>
          <div class="rrhs-launch__actions">
            <a href="/products" class="rrhs-launch__primary">Explore the store <span aria-hidden="true">↗</span></a>
            <button type="button" class="rrhs-launch__secondary">Keep browsing</button>
          </div>
          <p class="rrhs-launch__footnote">November 9 · 3rd period · At the Co-op</p>
        </div>
      </article>`;
    const paint = dialog.querySelector('.rrhs-launch__paint');
    const colors = ['#f2ba49', '#dc4c83', '#3abbb0', '#a17bdd', '#f27643', '#6a99dc'];
    for (let i = 0; i < 18; i++) {
      const splat = document.createElement('span');
      const angle = i * 2.4;
      splat.className = 'rrhs-launch__splat';
      splat.style.cssText = `--paint:${colors[i % colors.length]};--x:${(i * 37 + 8) % 100}%;--y:${(i * 29 + 6) % 100}%;--size:${90 + (i % 5) * 34}px;--delay:${100 + i * 45}ms;--fly-x:${Math.cos(angle) * 65}vw;--fly-y:${Math.sin(angle) * 65}vh;--turn:${i * 47}deg;`;
      splat.innerHTML = '<svg viewBox="0 0 100 100"><path fill="currentColor" d="M42 28C48 24 42 3 49 2S55 25 61 29 78 9 82 15 67 34 73 40 97 35 98 43 77 48 76 55 96 72 90 77 72 62 65 69 72 94 64 96 58 76 50 76 39 99 32 94 44 76 37 70 12 87 8 80 30 65 26 58 1 58 2 50 25 49 28 42 8 22 14 17 33 34 38 32 27 9 33 7 37 31 42 28Z"/><circle cx="88" cy="9" r="5" fill="currentColor"/><circle cx="9" cy="91" r="4" fill="currentColor"/></svg>';
      paint.appendChild(splat);
    }
    dialog.querySelector('.rrhs-launch__close').addEventListener('click', close);
    dialog.querySelector('.rrhs-launch__secondary').addEventListener('click', close);
    dialog.querySelector('.rrhs-launch__primary').addEventListener('click', close);
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) close();
    });
    dialog.addEventListener('close', () => {
      clearTimeout(revealTimer);
      document.documentElement.style.overflow = previousOverflow;
      dialog.classList.remove('rrhs-launch--revealed');
      if (previousFocus && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    });
    document.body.appendChild(dialog);
  }

  function open(trigger) {
    clearTimeout(autoTimer);
    if (!dialog) createDialog();
    if (dialog.open) return;
    // Don't interrupt checkout, another dialog, or text entry with the automatic reveal.
    if (!trigger && (document.querySelector('dialog[open], [aria-modal="true"]') ||
      document.activeElement.matches('input, textarea, select, [contenteditable="true"]'))) return;
    previousFocus = trigger || document.activeElement;
    previousOverflow = document.documentElement.style.overflow;
    dialog.classList.remove('rrhs-launch--revealed');
    dialog.showModal();
    document.documentElement.style.overflow = 'hidden';
    if (reducedMotion.matches) dialog.classList.add('rrhs-launch--revealed');
    else revealTimer = setTimeout(() => dialog.classList.add('rrhs-launch--revealed'), 1050);
  }

  // Use #celebrate for an Ecwid-authored menu link; labels also support existing items.
  function isCelebrationTrigger(element) {
    if (element.matches('[data-rrhs-celebrate]')) return true;
    if (element.tagName === 'A') {
      const hash = new URL(element.href, location.href).hash;
      if (hash === '#celebrate' || hash === '#launch-celebration') return true;
    }
    return element.matches('.ins-header__menu-link-title') &&
      /^(celebrate(?: nov(?:ember)?\.? 9(?:th)?)?|deepawali|diwali|launch celebration)$/i.test(element.textContent.trim());
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('a, button, [data-rrhs-celebrate]');
    if (!trigger || !isCelebrationTrigger(trigger)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    open(trigger);
  }, true);

  function mount() {
    if (!document.body) return;
    if (!document.getElementById('rrhs-launch-announcement')) {
      const banner = document.createElement('div');
      banner.id = 'rrhs-launch-announcement';
      banner.className = 'rrhs-launch-banner';
      banner.innerHTML = '<button type="button"><strong>E-commerce launches November 9</strong><span>Celebrate Deepawali with us. Shop online &amp; get free henna.</span><span class="rrhs-launch-banner__cta">See the celebration <span aria-hidden="true">↗</span></span></button>';
      banner.querySelector('button').addEventListener('click', (event) => open(event.currentTarget));
      document.body.prepend(banner);
    }
    document.querySelectorAll('.ins-header').forEach((header) => {
      const existingTrigger = Array.from(header.querySelectorAll('a, button, [data-rrhs-celebrate]'))
        .find(isCelebrationTrigger);
      const fallback = header.querySelector('.rrhs-launch-nav');
      if (existingTrigger) {
        if (fallback) fallback.remove();
        if (existingTrigger.getAttribute('aria-haspopup') !== 'dialog') existingTrigger.setAttribute('aria-haspopup', 'dialog');
        return;
      }
      if (fallback) return;
      const host = header.querySelector('.ins-header__right') || header.querySelector('.ins-header__inner');
      if (!host) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'rrhs-launch-nav';
      button.textContent = 'Celebrate Nov 9';
      button.setAttribute('aria-haspopup', 'dialog');
      button.addEventListener('click', () => open(button));
      host.prepend(button);
    });
  }

  function start() {
    mount();
    if (window.RRHS_RUNTIME) window.RRHS_RUNTIME.onDomChanged(mount);
    else new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });
    const schedule = () => { autoTimer = setTimeout(() => { if (isHome()) open(); }, 3000); };
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });
  }
  window.RRHS_LAUNCH = { open: () => open(document.activeElement), close };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}());

/* Faculty lunch builder. Credentials and verification checks stay on the server. */
(function () {
  'use strict';
  const API = new URL('/api/v1/teachers/preorder', location.href).href;
  const STORE_KEY = 'rrhs-faculty-verification-v1';
  const $ = id => document.getElementById(id);
  const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let menu = [], sauces = {}, sauceLimit = 10, delivery = null, storeId = '', selection = new Map();
  let sauceCounts = {};
  let token = '', verifiedEmail = '', details = {}, challenge = '', checkout = null;
  let expiryTimer = null;
  let widgetReady = null, preparing = false, checkoutValid = false, currentView = 'menu', resendUntil = 0;
  let setupControl;
  let pickupTimes = [];
  const drawer = $('preorder-drawer');
  const drawerShell = drawer.querySelector('.drawer-shell');
  const drawerScroll = $('drawer-scroll');
  const checkoutHost = $('ecwid-checkout');
  let parentOrigin = 'https://rrhscoop.roundrockisd.org';
  try { if (document.referrer) parentOrigin = new URL(document.referrer).origin; } catch (_) {}
  try { token = localStorage.getItem(STORE_KEY) || ''; } catch (_) {}

  async function request(body) {
    const r = await fetch(API, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal: AbortSignal.timeout(25000) });
    const data = await r.json();
    if (!r.ok) { const err = new Error(data.error || 'Please try again.'); err.status = r.status; throw err; }
    return data;
  }
  function message(id, text) { $(id).textContent = text || ''; $(id).hidden = !text; }
  async function busy(button, label, work, errorId) {
    const original = button.innerHTML; button.disabled = true; button.textContent = label;
    message(errorId, '');
    try { await work(); } catch (err) { message(errorId, err.name === 'TimeoutError' ? 'This is taking longer than expected. Please try again.' : err.message); }
    finally { button.innerHTML = original; button.disabled = false; }
  }
  function selectedItems() {
    return menu.filter(p => (selection.get(p.sku)?.quantity || 0) > 0).map(p => ({ ...p, ...selection.get(p.sku) }));
  }
  function subtotal() { return selectedItems().reduce((total,p) => total + p.price * p.quantity, 0); }
  function displayTime(time) {
    if (!time) return '';
    const [hour, minute] = time.split(':');
    return `${Number(hour) % 12 || 12}:${minute} ${Number(hour) < 12 ? 'a.m.' : 'p.m.'}`;
  }
  function summary() {
    const lines = selectedItems().map(item => `<div class="receipt-line"><div><strong>${item.quantity} × ${escape(item.name)}</strong><span class="price">${money(item.price * item.quantity)}</span></div></div>`).join('');
    const packets = Object.entries(sauces)
      .filter(([key]) => sauceCounts[key] > 0)
      .map(([key, label]) => `${sauceCounts[key]} × ${escape(label)}`);
    const sauceSummary = packets.length
      ? `<div class="receipt-line"><strong>Sauces</strong><small>${packets.join(' · ')}</small></div>`
      : '';
    document.querySelectorAll('[data-summary]').forEach(el => {
      el.innerHTML = `<p class="eyebrow">Reserved for your lunch break</p><h3>Your preorder</h3>${lines}${sauceSummary}<div class="receipt-total"><span>Subtotal</span><span>${money(subtotal())}</span></div><p>Final taxes &amp; delivery at checkout.</p><p class="receipt-date">${details.fulfillment === 'pickup'
        ? `Store pickup<strong>${escape(delivery?.label || '')}</strong>${details.time ? escape(displayTime(details.time)) : 'Choose a pickup time'}`
        : `Delivery<strong>${escape(delivery?.label || '')}</strong>${details.time ? escape(details.time) : 'Around 12:45 p.m.'}`}</p>`;
    });
    const total = money(subtotal());
    $('subtotal').textContent = total;
    $('drawer-subtotal').textContent = total;
    $('continue-preorder').disabled = selectedItems().length === 0;
    $('review-order').disabled = selectedItems().length === 0;
  }
  const drawerSteps = {
    selections: { label: '01 / Your order', title: 'Review your preorder' },
    details: { label: '02 / Fulfillment', title: 'Where’s lunch headed?', back: 'selections', backLabel: 'Back to your selections' },
    verify: { label: '03 / Email verification', title: 'Check your district inbox', back: 'details', backLabel: 'Back to preorder details' },
    review: { label: '04 / Checkout', title: 'Review and pay', back: 'details', backLabel: 'Edit preorder details' },
    payment: { label: '04 / Checkout', title: 'Payment', back: 'review', backLabel: 'Back to preorder review' },
    complete: { label: 'Order received', title: 'Thanks for your preorder' },
  };
  function updateDrawerBack() {
    const step = drawerSteps[currentView];
    $('drawer-back').hidden = !step?.back || (currentView === 'payment' && preparing);
    if (step?.backLabel) $('drawer-back').setAttribute('aria-label', step.backLabel);
  }
  function show(view) {
    currentView = view;
    drawer.querySelectorAll('.view').forEach(section => { section.hidden = section.id !== `${view}-view`; });
    $('drawer-step').textContent = drawerSteps[view].label;
    $('drawer-label').textContent = drawerSteps[view].title;
    updateDrawerBack();
    drawerScroll.scrollTop = 0;
    summary();
    if (drawer.open) $('drawer-label').focus({ preventScroll: true });
  }
  let finishOpening;
  let openingPromise;
  function openDrawer(view) {
    show(view);
    if (drawer.open) return Promise.resolve();
    if (openingPromise) return openingPromise;
    if (window.parent === window) {
      presentDrawer();
      return Promise.resolve();
    }

    openingPromise = new Promise(resolve => {
      const timeout = setTimeout(() => finishOpening?.(), 400);
      finishOpening = () => {
        clearTimeout(timeout);
        finishOpening = null;
        openingPromise = null;
        presentDrawer();
        resolve();
      };
      // Move the iframe before opening the native dialog. Otherwise autofocus
      // can scroll the host page to the dialog's old position.
      window.parent.postMessage({ type: 'rrhs-cfa-preorder-drawer', open: true }, parentOrigin);
    });
    return openingPromise;
  }
  function presentDrawer() {
    document.documentElement.classList.add('preorder-open');
    drawer.showModal();
    // Commit the offscreen position before starting the transition.
    drawerShell.getBoundingClientRect();
    drawer.classList.add('is-visible');
    $('drawer-label').focus({ preventScroll: true });
  }
  async function closeDrawer() {
    if (!drawer.open || !drawer.classList.contains('is-visible')) return;
    drawer.classList.remove('is-visible');
    const transition = drawerShell.getAnimations?.().find(animation => animation.transitionProperty === 'transform');
    if (transition) await transition.finished.catch(() => {});
    if (drawer.open) drawer.close();
  }
  $('close-preorder').addEventListener('click', closeDrawer);
  drawer.addEventListener('cancel', event => { event.preventDefault(); closeDrawer(); });
  drawer.addEventListener('click', event => { if (event.target === drawer) closeDrawer(); });
  drawer.addEventListener('close', () => {
    drawer.classList.remove('is-visible');
    document.documentElement.classList.remove('preorder-open', 'preorder-overlay');
    checkoutValid = false;
    clearTimeout(expiryTimer);
    try { sessionStorage.removeItem('rrhs-cfa-pending'); } catch (_) {}
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'rrhs-cfa-preorder-drawer', open: false }, parentOrigin);
    }
    if (window.parent === window) restoreMenuFocus();
  });
  function restoreMenuFocus() {
    $('review-order').focus({ preventScroll: true });
    lastHeight = 0;
    sendHeight();
  }
  const descriptions = { '601_sku': 'The original, with pickles on a toasted buttered bun.', '782_sku': 'Grilled chicken, crisp greens, eggs, and a little crunch.', '698_sku': 'Eight bite-sized favorites, ready for your favorite sauce.' };
  function stepper(key, label, count, max, kind, disabled = false) {
    return `<div class="stepper" data-counter="${kind}" data-key="${escape(key)}" data-max="${max}" data-available="${!disabled}">
      <button type="button" data-delta="-1" aria-label="Remove one ${escape(label)}" ${count === 0 || disabled ? 'disabled' : ''}>−</button>
      <output aria-live="polite" aria-label="${escape(label)} quantity">${count}</output>
      <button type="button" data-delta="1" aria-label="Add one ${escape(label)}" ${count >= max || disabled ? 'disabled' : ''}>+</button>
    </div>`;
  }
  function renderMenu() {
    $('menu').innerHTML = menu.map((product, index) => `
      <article class="food-card" data-sku="${product.sku}">
        <div class="food-image"><img src="../assets/${product.image}" width="700" height="700" alt="${escape(product.name)}" ${index ? 'loading="lazy"' : 'fetchpriority="high"'}></div>
        <div class="food-title"><h3>${escape(product.name)}</h3><span class="price">${money(product.price)}</span></div>
        <p class="food-description">${escape(descriptions[product.sku])}</p>
        <div class="quantity-row"><span>Quantity</span>${stepper(product.sku, product.name, selection.get(product.sku)?.quantity || 0, 20, 'item', !product.available)}</div>
        ${!product.available ? '<p class="inline-error">Temporarily unavailable.</p>' : ''}
      </article>`).join('');
    $('menu').setAttribute('aria-busy', 'false');
  }
  function renderDrawerItems() {
    $('drawer-items').innerHTML = selectedItems().map(item => `
      <li class="drawer-line"><div><strong>${escape(item.name)}</strong><small>${money(item.price)} each</small></div>
      ${stepper(item.sku, item.name, item.quantity, 20, 'item')}</li>`).join('');
    if (!$('drawer-items').childElementCount) {
      $('drawer-items').innerHTML = '<li class="muted">Add a lunch item to continue.</li>';
    }
  }
  function renderSauces() {
    $('sauce-options').innerHTML = Object.entries(sauces).map(([key, label]) => `
      <div class="drawer-line"><span>${escape(label)}</span>${stepper(key, label + ' packet', sauceCounts[key] || 0, sauceLimit, 'sauce')}</div>`).join('');
  }
  function updateCounter(counter, count, animate) {
    const output = counter.querySelector('output');
    output.textContent = count;
    const available = counter.dataset.available === 'true';
    counter.querySelector('[data-delta="-1"]').disabled = !available || count <= 0;
    counter.querySelector('[data-delta="1"]').disabled = !available || count >= Number(counter.dataset.max);
    if (animate && output.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      output.getAnimations().forEach(animation => animation.cancel());
      output.animate([{ opacity: .4, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 175, easing: 'ease-out' });
    }
  }
  function adjustQuantity(event) {
    const button = event.target.closest('[data-delta]');
    if (!button) return;
    const counter = button.closest('[data-counter]');
    const { key, counter: kind, max } = counter.dataset;
    const current = kind === 'sauce' ? sauceCounts[key] || 0 : selection.get(key)?.quantity || 0;
    const count = Math.max(0, Math.min(Number(max), current + Number(button.dataset.delta)));
    if (kind === 'sauce') sauceCounts[key] = count;
    else selection.set(key, { quantity: count });
    document.querySelectorAll(`[data-counter="${kind}"][data-key="${key}"]`).forEach(control => updateCounter(control, count, control === counter));
    // Keep keyboard focus on an enabled control when a limit is reached.
    if (document.activeElement === button && button.disabled) counter.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
    summary();
  }
  $('menu').addEventListener('click', adjustQuantity);
  $('drawer-items').addEventListener('click', adjustQuantity);
  $('sauce-options').addEventListener('click', adjustQuantity);
  $('review-order').addEventListener('click', () => {
    renderDrawerItems();
    renderSauces();
    openDrawer('selections');
  });
  $('continue-preorder').addEventListener('click', () => show('details'));
  $('drawer-back').addEventListener('click', () => {
    const back = drawerSteps[currentView]?.back;
    if (!back || (currentView === 'payment' && preparing)) return;
    if (currentView === 'payment') {
      checkoutValid = false;
      checkoutHost.hidden = true;
      clearTimeout(expiryTimer);
    }
    show(back);
  });
  function rememberVerification() {
    try { if ($('remember-email').checked) localStorage.setItem(STORE_KEY, token); else localStorage.removeItem(STORE_KEY); } catch (_) {}
  }
  function forget() { token = ''; verifiedEmail = ''; try { localStorage.removeItem(STORE_KEY); } catch (_) {} }
  async function sendCode() {
    const data = await request({ action:'send-code', email:details.email });
    challenge = data.challenge; resendUntil = Date.now() + 60000;
    $('sent-email').textContent = details.email; $('verification-code').value = ''; show('verify'); $('verification-code').focus({ preventScroll:true });
  }
  function fulfillmentChoice() {
    return $('delivery-form').querySelector('[name="fulfillment"]:checked').value;
  }
  function updateFulfillmentFields() {
    const pickup = fulfillmentChoice() === 'pickup';
    $('classroom-details').hidden = pickup;
    $('teacher-room').required = !pickup;
    $('teacher-room').disabled = pickup;
    $('delivery-time').disabled = pickup;
    $('pickup-details').hidden = !pickup;
    $('pickup-time-help').textContent = pickupTimes.length
      ? `Choose a time for ${delivery?.label || 'the next school day'} at the RRHS CO-OP.`
      : 'Pickup times are currently unavailable for this date.';
  }
  $('delivery-form').addEventListener('change', event => {
    if (event.target.name === 'fulfillment') {
      updateFulfillmentFields();
      details.fulfillment = fulfillmentChoice();
    } else if (!['pickup-time', 'delivery-time'].includes(event.target.id)) {
      return;
    }
    details.time = $(fulfillmentChoice() === 'pickup' ? 'pickup-time' : 'delivery-time').value;
    summary();
  });
  function renderPickupTimes() {
    $('pickup-times').innerHTML = pickupTimes.map(time => `<button type="button" data-time="${escape(time)}" aria-pressed="${time === $('pickup-time').value}">${displayTime(time)}</button>`).join('');
    updateFulfillmentFields();
  }
  $('pickup-times').addEventListener('click', event => {
    const option = event.target.closest('button[data-time]');
    if (!option) return;
    $('pickup-time').value = option.dataset.time;
    details.time = option.dataset.time;
    $('pickup-times').querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button === option)));
    summary();
  });
  function review() {
    const pickup = details.fulfillment === 'pickup';
    const data = [['For', details.name], ['Email', details.email]];
    if (pickup) {
      data.push(['Fulfillment', 'Pick up at the RRHS CO-OP'], ['Pickup time', `${delivery.label} · ${displayTime(details.time)} Central`],
        ['Payment', 'Pay online or at pickup']);
    } else {
      data.push(['Room', details.room], ['Delivery', delivery.label], ['Time', details.time ? displayTime(details.time) : 'Around 12:45 p.m.'],
        ['Payment', 'Pay online']);
    }
    $('review-fulfillment-note').textContent = pickup
      ? 'Your pickup time is saved. Choose online payment or Pay at pickup on the next screen.'
      : 'Your delivery details are saved. Choose how to pay on the next screen.';
    $('delivery-review').innerHTML = data.map(([label, value]) =>
      `<div><dt>${label}</dt><dd>${escape(value)}</dd></div>`).join('');
    show('review');
  }
  $('delivery-form').addEventListener('submit', event => {
    event.preventDefault();
    const email = $('teacher-email');
    const fulfillment = fulfillmentChoice();
    details = {
      name: $('teacher-name').value.trim(),
      room: fulfillment === 'delivery' ? $('teacher-room').value.trim() : '',
      time: $(fulfillment === 'pickup' ? 'pickup-time' : 'delivery-time').value,
      email: email.value.trim().toLowerCase(),
      fulfillment,
    };
    if (fulfillment === 'pickup' && !pickupTimes.includes(details.time)) {
      message('details-error', 'Choose an available pickup time or select classroom delivery.');
      return;
    }
    busy($('send-code'), 'Checking your email…', async()=> {
      if (token && verifiedEmail === details.email) { try { await request({ action:'session', token }); rememberVerification(); review(); return; } catch (err) { if (err.status !== 401) throw err; forget(); } }
      if (token) forget();
      await sendCode();
    }, 'details-error');
  });
  $('verification-form').addEventListener('submit', event => {
    event.preventDefault(); const button = event.submitter;
    busy(button, 'Verifying…', async()=> {
      const data = await request({ action:'verify-code', email:details.email, challenge, code:$('verification-code').value.trim() });
      token = data.token; verifiedEmail = data.email; rememberVerification(); review();
    }, 'verify-error');
  });
  $('resend-code').addEventListener('click',()=> {
    if (Date.now() < resendUntil) { message('verify-error', `Please wait ${Math.ceil((resendUntil-Date.now())/1000)} seconds before requesting another code.`); return; }
    busy($('resend-code'), 'Sending…', sendCode, 'verify-error');
  });
  $('forget-email').addEventListener('click',()=> { forget(); show('details'); message('details-error','Saved verification removed. Verify your email again to continue.'); });

  function ecwidCall(method, ...args) {
    return new Promise((resolve,reject)=> {
      const timer = setTimeout(()=>reject(new Error('Ecwid is taking longer than expected. Go back and try again.')),15000);
      window.Ecwid.Cart[method](...args, ()=>{clearTimeout(timer);resolve();}, ()=>{clearTimeout(timer);reject(new Error('Ecwid could not save your delivery details. Please try again.'));});
    });
  }
  function getCart() { return new Promise(resolve=>window.Ecwid.Cart.get(resolve)); }
  async function clearCart() {
    window.Ecwid.Cart.clear();
    for (let i=0;i<50;i++) { const cart = await getCart(); if (!cart.items?.length) return; await new Promise(resolve=>setTimeout(resolve,100)); }
    throw new Error('We could not reset the preorder checkout. Please reload this page.');
  }
  function matchingCart(cart) {
    const items = cart?.items || [];
    return checkout && items.length === checkout.items.length && items.every(line=> checkout.items.some(item=>Number(line.product?.id)===item.id && Number(line.quantity)===item.quantity));
  }
  function matchingFulfillment(cart) {
    return (checkout.fulfillment === 'pickup' ? /pickup/i : /deliver to room/i).test(cart?.shippingMethod || '');
  }
  function loadWidget() {
    if (widgetReady) return widgetReady;
    widgetReady = new Promise((resolve,reject)=> {
      const timer = setTimeout(()=>reject(new Error('Secure checkout could not load. Check your connection and try again.')),25000);
      window.RRHS_CFA_CHECKOUT_CONTEXT = true;
      window.ec = window.ec || {};
      window.ec.order = window.ec.order || {};
      window.ec.order.extraFields = window.ec.order.extraFields || {};
      window.ec.order.extraFields.pvhvhag = { available: false, required: false };
      const script = document.createElement('script');
      script.src = `https://app.ecwid.com/script.js?${encodeURIComponent(storeId)}&data_platform=code`;
      script.onerror = ()=>{ clearTimeout(timer); widgetReady=null; reject(new Error('Ecwid could not load. Please try again.')); };
      script.onload = ()=> {
        window.Ecwid.OnAPILoaded.add(()=> {
          clearTimeout(timer);
          window.Ecwid.OnOrderPlaced.add(async order=> {
            checkoutValid = false;
            clearTimeout(expiryTimer);
            try { sessionStorage.removeItem('rrhs-cfa-pending'); } catch (_) {}
            const orderId = order.orderNumber || order.vendorNumber;
            const pickup = /pickup/i.test(order.shippingMethod || '') || (!order.shippingMethod && checkout.fulfillment === 'pickup');
            const payLater = pickup && /^pay at pickup$/i.test(order.paymentMethod || '') && order.paymentStatus !== 'PAID';
            const status = order.paymentStatus === 'PAID' ? 'Payment received.' :
              payLater ? 'Please pay when you pick up your lunch at the RRHS CO-OP.' :
                'Payment is pending. Check your confirmation before ordering again.';
            const handoff = pickup ? (checkout.pickupSchedule ? `Pickup: ${checkout.pickupSchedule}.` : 'See your confirmation for your pickup time.') : `Delivery: ${checkout.delivery.label}.`;
            $('order-result').textContent = `Order ${orderId || ''} was submitted. ${status} ${handoff}`;
            show('complete');
          });
          window.Ecwid.OnCartChanged.add(cart=> {
            if (preparing || currentView !== 'payment' || checkoutHost.hidden) return;
            checkoutValid = matchingCart(cart) && Date.now() < checkout.expiresAt &&
              (!cart.shippingMethod || matchingFulfillment(cart));
            message('checkout-error', checkoutValid ? '' : 'Your checkout items changed. Go back to preorder review to rebuild your lunch order.');
            $('ecwid-checkout').inert = !checkoutValid;
          });
          resolve();
        });
        window.xProductBrowser('id=ecwid-checkout', 'defaultCategoryId=0');
      };
      document.head.appendChild(script);
    });
    return widgetReady;
  }
  function checkoutExpiry() {
    clearTimeout(expiryTimer);
    expiryTimer = setTimeout(()=> {
      checkoutValid=false;
      $('ecwid-checkout').inert=true;
      message('checkout-error','This checkout has expired. Go back to review your preorder and start a new checkout.');
    }, Math.max(0, checkout.expiresAt-Date.now()));
  }
  function configurePickupFields() {
    window.ec = window.ec || {};
    window.ec.order = window.ec.order || {};
    const fields = window.ec.order.extraFields = window.ec.order.extraFields || {};
    delete fields.cfa_pickup_schedule;
    if (checkout.fulfillment !== 'pickup' || !checkout.pickupSchedule) return;
    fields.cfa_pickup_schedule = {
      title: 'Pickup schedule', value: checkout.pickupSchedule, type: 'text',
      orderDetailsDisplaySection: 'shipping_info', showInNotifications: true, showInInvoice: true,
    };
  }
  async function waitForCheckout(find, timeout = 6000) {
    const end = Date.now() + timeout;
    do {
      if (!drawer.open || currentView !== 'payment' || Date.now() >= checkout.expiresAt) {
        throw new Error('Return to preorder review to start a new checkout.');
      }
      const result = find();
      if (result) return result;
      await new Promise(resolve => setTimeout(resolve, 80));
    } while (Date.now() < end);
    return null;
  }
  function clickSetupControl(control) {
    if (!control || control.disabled) return false;
    setupControl = control;
    try { control.click(); } finally { setupControl = null; }
    return true;
  }
  function setCheckoutField(field, value) {
    if (!field) return;
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function savePaymentNotes(notes) {
    if (!notes) return;
    notes.readOnly = true;
    notes.setAttribute('aria-hidden', 'true');
    if (notes.value !== checkout.comments) setCheckoutField(notes, checkout.comments);
    notes.closest('.ec-form__row')?.classList.add('preorder-saved-notes');
  }
  const paymentNotes = () => $('ecwid-checkout').querySelector('textarea[aria-label="Leave us a note about your order"]');
  new MutationObserver(() => {
    if (checkoutValid && currentView === 'payment' && $('ecwid-checkout').classList.contains('is-payment-ready')) {
      savePaymentNotes(paymentNotes());
    }
  }).observe($('ecwid-checkout'), { childList: true, subtree: true });
  async function setPickupSchedule() {
    const pickupInput = () => $('ecwid-checkout').querySelector('input[aria-label="Please choose a date"]');
    const calendar = () => document.querySelector('.ec-date-selector__menu');
    let menu;
    for (let attempt = 0; attempt < 4 && !menu; attempt++) {
      const dateInput = await waitForCheckout(pickupInput, 1200);
      if (!dateInput) break;
      dateInput.scrollIntoView({ block: 'center', behavior: 'instant' });
      dateInput.focus({ preventScroll: true });
      await new Promise(resolve => setTimeout(resolve, 100));
      if (!dateInput.isConnected) continue;
      const bounds = dateInput.getBoundingClientRect();
      dateInput.dispatchEvent(new MouseEvent('click', {
        bubbles: true, cancelable: true, view: window, detail: 1,
        clientX: bounds.left + bounds.width / 2, clientY: bounds.top + bounds.height / 2,
      }));
      menu = await waitForCheckout(calendar, 800);
    }
    if (!menu) throw new Error('Ecwid could not open the pickup calendar. Return to preorder review and try again.');
    const day = () => menu.querySelector(`[id="dp-${checkout.delivery.date}"] .dp--date-hoverable`);
    if (!day()) {
      const nextMonth = menu.querySelector('[aria-label="Next month" i]');
      if (nextMonth) clickSetupControl(nextMonth);
    }
    const date = await waitForCheckout(day, 1500);
    if (!date) throw new Error('Ecwid has no pickup slots on the selected date. Go back and choose classroom delivery.');
    clickSetupControl(date);
    await new Promise(resolve => setTimeout(resolve, 400));
    const time = await waitForCheckout(() => menu.querySelector('select.ec-pika-select'));
    const wanted = displayTime(checkout.time).replace(/\./g, '').toUpperCase();
    const slot = time && [...time.options].find(option => !option.disabled && option.textContent.trim().replace(/^0/, '') === wanted);
    if (!slot) throw new Error('Ecwid no longer offers that pickup time. Go back and choose another time.');
    time.selectedIndex = slot.index;
    time.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    time.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 300));
    const done = await waitForCheckout(() => [...menu.querySelectorAll('button')].find(button =>
      !button.disabled && /^ok$/i.test(button.textContent.trim())));
    if (!clickSetupControl(done)) throw new Error('Ecwid could not save that pickup time. Go back and try again.');
    if (!await waitForCheckout(() => pickupInput()?.value, 2000)) {
      throw new Error('Ecwid could not save that pickup time. Go back and try again.');
    }
  }
  async function advanceToPayment() {
    const host = $('ecwid-checkout');
    const pickup = checkout.fulfillment === 'pickup';
    const stage = name => host.querySelector(`.ec-cart-step--${name}.ec-cart-step--current`);
    const visible = element => element.getClientRects().length > 0;
    const next = (container, label) => [...container.querySelectorAll('button')].find(button =>
      !button.disabled && visible(button) && button.textContent.trim() === label);
    window.Ecwid.openPage('cart');
    const cart = await waitForCheckout(() => host.querySelector('#ec-cart-email-input') && host);
    if (!cart) return false;
    const terms = cart.querySelector('.ec-cart__agreement input[type="checkbox"]');
    if (terms && !terms.checked) clickSetupControl(terms);
    if (!clickSetupControl(next(cart, 'Checkout'))) return false;

    const address = await waitForCheckout(() => stage('address') || stage('delivery'));
    if (!address) return false;
    if (address.matches('.ec-cart-step--address')) {
      const addressTab = () => [...(stage('address') || address).querySelectorAll('.ec-tabs__tab')].find(option =>
        visible(option) && (pickup ? /pick it up/i : /deliver to address/i).test(option.textContent));
      const tab = pickup ? await waitForCheckout(addressTab, 1800) : addressTab();
      if (pickup && !tab) return false;
      if (tab) {
        const active = () => addressTab()?.classList.contains('ec-tabs__tab--active');
        for (let attempt = 0; attempt < 3 && !active(); attempt++) {
          clickSetupControl(addressTab());
          await waitForCheckout(active, 1000);
        }
        if (!active()) return false;
      }
      if (!pickup) {
        const state = await waitForCheckout(() => {
          const select = address.querySelector('select[name="province"]');
          return select?.querySelector('option[value="TX"]') && select;
        }, 2000);
        setCheckoutField(state, 'TX');
        await new Promise(resolve => setTimeout(resolve, 160));
      }
      const continueAddress = await waitForCheckout(() => next(stage('address') || address, 'Continue'));
      if (!clickSetupControl(continueAddress)) return false;
      if (!await waitForCheckout(() => !stage('address'), 2000)) {
        const stillOnAddress = stage('address');
        if (stillOnAddress) clickSetupControl(next(stillOnAddress, 'Continue'));
      }
    }

    const onPayment = () => /\/checkoutPD(?:[/?&]|$)/i.test(location.hash);
    const deliveryStep = await waitForCheckout(() => stage('delivery') || onPayment());
    if (!deliveryStep) return false;
    if (deliveryStep !== true) {
      const shipping = await waitForCheckout(() => [...deliveryStep.querySelectorAll('.ec-radiogroup__item')].find(option =>
        visible(option) && (pickup ? /Pickup at Round Rock High School/i : /Deliver to Room/i).test(option.textContent)));
      if (!shipping) return false;
      const radio = shipping.querySelector('input[type="radio"]');
      if (radio && (pickup || !radio.checked)) clickSetupControl(radio);
      const room = deliveryStep.querySelector('input[name="z7rty2b"]');
      if (pickup) {
        await new Promise(resolve => setTimeout(resolve, 350));
        await setPickupSchedule();
      }
      else if (room) {
        setCheckoutField(room, checkout.room);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      if (!clickSetupControl(next(stage('delivery') || deliveryStep, 'Continue'))) return false;
      if (!await waitForCheckout(onPayment, 2000)) {
        const stillOnDelivery = stage('delivery');
        if (stillOnDelivery) clickSetupControl(next(stillOnDelivery, 'Continue'));
      }
    }
    if (!await waitForCheckout(onPayment)) return false;
    await confirmPaymentScreen();
    return true;
  }
  async function confirmPaymentScreen() {
    const paymentForm = await waitForCheckout(() =>
      checkoutHost.querySelector('.ec-cart-step--payment.ec-cart-step--current input[name="checkout-payment-method"]'), 12000);
    if (!paymentForm) throw new Error('The payment form did not load. Go back and try again.');
    const prepared = await getCart();
    if (!matchingCart(prepared) || !matchingFulfillment(prepared)) {
      throw new Error('Ecwid could not confirm the selected items and fulfillment. Return to preorder review and try again.');
    }
    // Ecwid mounts a fresh notes field when it opens payment.
    savePaymentNotes(paymentNotes());
  }
  function startPaymentSetup() {
    preparing = true;
    checkoutValid = false;
    checkoutHost.inert = false;
    checkoutHost.classList.remove('is-payment-ready');
    checkoutHost.classList.add('is-preparing');
    checkoutHost.hidden = false;
    $('checkout-status').hidden = false;
    $('checkout-fulfillment-note').hidden = true;
    message('checkout-error', '');
    show('payment');
  }
  function finishPaymentSetup(error) {
    preparing = false;
    checkoutValid = !error && drawer.open && currentView === 'payment';
    checkoutHost.inert = !checkoutValid;
    checkoutHost.hidden = !checkoutValid;
    checkoutHost.classList.toggle('is-payment-ready', checkoutValid);
    checkoutHost.classList.remove('is-preparing');
    $('checkout-status').hidden = true;
    $('checkout-fulfillment-note').hidden = !checkoutValid;
    if (checkoutValid) {
      $('checkout-fulfillment-note').textContent = checkout.fulfillment === 'pickup'
        ? `Pickup at the CO-OP · ${checkout.delivery.label} · ${displayTime(checkout.time)}`
        : `Room ${checkout.room} delivery · ${checkout.delivery.label} · ${checkout.time ? displayTime(checkout.time) : 'around 12:45 p.m.'}`;
      checkoutExpiry();
      drawerScroll.scrollTop = 0;
      $('drawer-label').focus({ preventScroll: true });
    } else if (error && currentView === 'payment') {
      message('checkout-error', error.message);
    }
    updateDrawerBack();
  }
  async function prepareCheckout() {
    if (!$('preorder-terms').checked) {
      $('preorder-terms').focus();
      throw new Error('Agree to the CO-OP store policies to continue.');
    }
    startPaymentSetup();
    let error;
    try {
      checkout = await request({ action:'checkout', token, ...details, items:selectedItems().map(({sku,quantity,price})=>({sku,quantity,price})), sauces:sauceCounts, deliveryDate:delivery.date });
      if (!drawer.open) return;
      try { sessionStorage.setItem('rrhs-cfa-pending',JSON.stringify({token,grant:checkout.grant})); } catch (_) {}
      await loadWidget();
      if (!drawer.open) return;
      await clearCart();
      window.ec.order = window.ec.order || {}; window.ec.order.extraFields = window.ec.order.extraFields || {};
      const fields = {
        cfa_preorder: ['Order type', 'Faculty Chick-fil-A preorder'],
        cfa_verified_email: ['Verified district email', checkout.email],
        cfa_sauces: ['Sauces', checkout.comments.split('\n').at(-1).replace(/^Sauces: /, '')],
      };
      const deliveryFields = {
        cfa_delivery_date: ['Preorder delivery date', checkout.delivery.date],
        cfa_delivery_room: ['Delivery room', checkout.room],
        cfa_delivery_time: ['Requested delivery time', checkout.time || 'Around 12:45 p.m.'],
      };
      for (const key of Object.keys(deliveryFields)) delete window.ec.order.extraFields[key];
      if (checkout.fulfillment !== 'pickup') Object.assign(fields, deliveryFields);
      for (const [key, [title, value]] of Object.entries(fields)) {
        window.ec.order.extraFields[key] = { title, value, type: 'text', orderDetailsDisplaySection: 'order_comments', showInNotifications: true, showInInvoice: true };
      }
      configurePickupFields();
      window.Ecwid.refreshConfig();
      for (const item of checkout.items) {
        await new Promise((resolve,reject)=> {
          const timer = setTimeout(()=>reject(new Error('Adding your lunch timed out. Please go back and try again.')),15000);
          window.Ecwid.Cart.addProduct({ id:item.id, quantity:item.quantity, callback:success=> { clearTimeout(timer); success ? resolve() : reject(new Error(`${item.name} could not be added to the preorder checkout. Please contact the CO-OP.`)); } });
        });
      }
      await ecwidCall('setCustomerEmail',checkout.email);
      await ecwidCall('setAddress', { name: checkout.name, street: checkout.room ? `Round Rock High School, Room ${checkout.room}` : '201 Deep Wood Drive', city: 'Round Rock', stateOrProvinceCode: 'TX', postalCode: '78681', countryName: 'United States', countryCode: 'US' });
      await ecwidCall('setOrderComments',checkout.comments);
      const cart = await getCart();
      if (!matchingCart(cart)) throw new Error('Your checkout items changed. Please return to preorder review and try again.');
      if (!drawer.open) return;
      if (!await advanceToPayment()) throw new Error('Checkout could not open the payment screen. Go back and try again.');
    } catch (err) {
      error = err;
    } finally {
      finishPaymentSetup(error);
      sendHeight();
    }
  }
  $('pay-now').addEventListener('click',()=>busy($('pay-now'),'Preparing checkout…',prepareCheckout,'payment-error'));
  const insideCheckout = target => target.closest('#ecwid-checkout, .ec-date-selector__menu');
  window.addEventListener('keydown', event => {
    if (!preparing || currentView !== 'payment' || !event.isTrusted) return;
    if (event.key === 'Tab' || insideCheckout(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.key === 'Tab') $('close-preorder').focus({ preventScroll: true });
      if (event.key === 'Escape') closeDrawer();
    }
  }, true);
  // Guard native checkout controls as well as the custom preorder buttons.
  window.addEventListener('click',event=> {
    if (preparing && event.isTrusted && insideCheckout(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (preparing && setupControl?.contains(event.target)) return;
    const button = event.target.closest('button,input[type=submit]');
    if (!button || !button.closest('#ecwid-checkout')) return;
    if (!checkoutValid || preparing || Date.now() >= checkout.expiresAt) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    const email = document.querySelector('#ec-cart-email-input');
    if (email && email.value.trim().toLowerCase() !== checkout.email) { event.preventDefault(); event.stopImmediatePropagation(); message('checkout-error','Use the district email you verified, or go back to verify a different address.'); }
  },true);
  window.addEventListener('submit', event => {
    if (event.target.closest('#ecwid-checkout') && (!checkoutValid || preparing || Date.now() >= checkout.expiresAt)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  let lastHeight=0;
  function sendHeight() {
    if (window.parent === window || drawer.open || openingPromise) return;
    const height = Math.ceil(document.querySelector('.page').getBoundingClientRect().height);
    if (height===lastHeight) return;
    lastHeight=height; window.parent.postMessage({type:'rrhs-cfa-preorder-height',height},parentOrigin);
  }
  new ResizeObserver(sendHeight).observe(document.body);
  window.addEventListener('rrhs-embed-resize',sendHeight);
  window.addEventListener('message', event => {
    if (event.source !== parent || event.origin !== parentOrigin) return;
    if (event.data?.type === 'rrhs-cfa-preorder-drawer-ready' && (drawer.open || finishOpening)) {
      const { top, left, width, clipTop } = event.data.menu || {};
      if ([top, left, width].every(Number.isFinite) && width > 0) {
        const root = document.documentElement;
        root.style.setProperty('--preorder-menu-top', `${top}px`);
        root.style.setProperty('--preorder-menu-left', `${left}px`);
        root.style.setProperty('--preorder-menu-width', `${width}px`);
        root.style.setProperty('--preorder-menu-clip-top', `${Number.isFinite(clipTop) ? clipTop : 0}px`);
        root.classList.add('preorder-overlay');
      }
      finishOpening?.();
    }
    if (event.data?.type === 'rrhs-cfa-preorder-drawer-closed' && !drawer.open) {
      restoreMenuFocus();
    }
    if (event.data?.type === 'rrhs-cfa-preorder-request-height') {
      if (drawer.open) window.parent.postMessage({ type: 'rrhs-cfa-preorder-drawer', open: true }, parentOrigin);
      document.documentElement.classList.add('preorder-embedded');
      lastHeight = 0;
      sendHeight();
    }
  });
  (async()=> {
    try {
      const data=await request(); menu=data.menu;sauces=data.sauces;delivery=data.delivery;storeId=data.storeId;
      pickupTimes = data.pickupTimes || [];
      sauceLimit = data.sauceLimit || sauceLimit;
      $('sauce-limit').textContent = `Optional · up to ${sauceLimit} packets of each sauce`;
      $('delivery-label').textContent=delivery.label;
      renderMenu();renderSauces();renderPickupTimes();summary();
      if(token) { try {const session=await request({action:'session',token});verifiedEmail=session.email;$('teacher-email').value=verifiedEmail;$('send-code').innerHTML='Review delivery details <span aria-hidden="true">→</span>';}catch(_){forget();} }
      let pending=null; try { pending=JSON.parse(sessionStorage.getItem('rrhs-cfa-pending') || 'null'); } catch (_) {}
      if(pending && /checkout/i.test(location.hash)) {
        try {
          const resumed=await request({action:'resume',token:pending.token,grant:pending.grant});
          token=pending.token;verifiedEmail=resumed.email;checkout=resumed;
          details={name:checkout.name,room:checkout.room,time:checkout.time,email:checkout.email,fulfillment:checkout.fulfillment || 'delivery'};
          $('delivery-form').querySelector(`[name="fulfillment"][value="${details.fulfillment}"]`).checked = true;
          updateFulfillmentFields();
          delivery=checkout.delivery;$('delivery-label').textContent=delivery.label;
          for (const item of checkout.items) selection.set(item.sku, { quantity: item.quantity });
          sauceCounts = checkout.sauces || {};
          renderMenu();
          renderSauces();
          for(const [id,value] of [['teacher-name',details.name],['teacher-room',details.room],['teacher-email',details.email],[details.fulfillment === 'pickup' ? 'pickup-time' : 'delivery-time',details.time]])$(id).value=value;
          renderPickupTimes();
          review();
          startPaymentSetup();
          await openDrawer('payment');
          configurePickupFields();
          await loadWidget();
          await confirmPaymentScreen();
          finishPaymentSetup();
        } catch (err) {
          const failure = new Error('We could not resume this checkout. If you already paid, check your Ecwid receipt before ordering again. ' + err.message);
          if (drawer.open) finishPaymentSetup(failure);
          else message('page-error', failure.message);
        }
      }

    } catch(err) { message('page-error',`${err.message} Reload this page to try again.`);$('menu').innerHTML='<p>Menu unavailable. Please try again shortly.</p>';$('menu').setAttribute('aria-busy','false'); }
    sendHeight();
  })();
}());

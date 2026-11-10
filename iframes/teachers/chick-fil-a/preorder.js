/* Faculty lunch builder. Credentials and verification checks stay on the server. */
(function () {
  'use strict';
  const API = new URL('/api/v1/teachers/preorder', location.href).href;
  const STORE_KEY = 'rrhs-faculty-verification-v1';
  const $ = id => document.getElementById(id);
  const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let menu = [], sauces = {}, delivery = null, storeId = '', selection = new Map();
  let sauceCounts = {};
  let token = '', verifiedEmail = '', details = {}, challenge = '', checkout = null;
  let expiryTimer = null;
  let widgetReady = null, preparing = false, checkoutValid = false, currentView = 'menu', resendUntil = 0;
  const drawer = $('preorder-drawer');
  const drawerScroll = $('drawer-scroll');
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
        ? 'Store pickup<strong>Choose a time in checkout</strong>'
        : `Delivery<strong>${escape(delivery?.label || '')}</strong>${details.time ? escape(details.time) : 'Around 12:45 p.m.'}`}</p>`;
    });
    const total = money(subtotal());
    $('subtotal').textContent = total;
    $('drawer-subtotal').textContent = total;
    $('continue-preorder').disabled = selectedItems().length === 0;
    $('review-order').disabled = selectedItems().length === 0;
  }
  const stepLabels = {
    selections: '01 / Your order', details: '02 / Fulfillment', verify: '03 / Email verification',
    review: '04 / Checkout', payment: '04 / Checkout', complete: 'Order received',
  };
  function show(view) {
    currentView = view;
    drawer.querySelectorAll('.view').forEach(section => { section.hidden = section.id !== `${view}-view`; });
    $('drawer-step').textContent = stepLabels[view];
    drawerScroll.scrollTop = 0;
    summary();
    if (drawer.open) $(`${view}-title`)?.focus({ preventScroll: true });
  }
  function openDrawer(view) {
    if (!drawer.open) {
      show(view);
      document.documentElement.classList.add('preorder-open');
      drawer.showModal();
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'rrhs-cfa-preorder-drawer', open: true }, parentOrigin);
      }
    }
    show(view);
  }
  function closeDrawer() {
    if (!drawer.open) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      drawer.close();
      return;
    }
    if (drawer.classList.contains('is-closing')) return;
    drawer.classList.add('is-closing');
    setTimeout(() => { if (drawer.open) drawer.close(); }, 190);
  }
  $('close-preorder').addEventListener('click', closeDrawer);
  drawer.addEventListener('cancel', event => { event.preventDefault(); closeDrawer(); });
  drawer.addEventListener('click', event => { if (event.target === drawer) closeDrawer(); });
  drawer.addEventListener('close', () => {
    drawer.classList.remove('is-closing');
    document.documentElement.classList.remove('preorder-open', 'preorder-overlay');
    checkoutValid = false;
    clearTimeout(expiryTimer);
    try { sessionStorage.removeItem('rrhs-cfa-pending'); } catch (_) {}
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'rrhs-cfa-preorder-drawer', open: false }, parentOrigin);
    }
    $('review-order').focus({ preventScroll: true });
    sendHeight();
  });
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
      <div class="drawer-line"><span>${escape(label)}</span>${stepper(key, label + ' packet', sauceCounts[key] || 0, 3, 'sauce')}</div>`).join('');
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
  document.querySelectorAll('[data-back]').forEach(button=>button.addEventListener('click',()=>show(button.dataset.back)));
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
  }
  $('delivery-form').addEventListener('change', event => {
    if (event.target.name === 'fulfillment') {
      updateFulfillmentFields();
      details.fulfillment = fulfillmentChoice();
      summary();
    }
  });
  function review() {
    const pickup = details.fulfillment === 'pickup';
    const data = [['For', details.name], ['Email', details.email]];
    if (pickup) {
      data.push(['Fulfillment', 'Pick up at the RRHS CO-OP'], ['Pickup time', `Choose a time for ${delivery.label} in checkout`],
        ['Payment', 'Pay online or at pickup']);
    } else {
      data.push(['Room', details.room], ['Delivery', delivery.label], ['Time', details.time || 'Around 12:45 p.m.'],
        ['Payment', 'Pay online']);
    }
    $('review-fulfillment-note').textContent = pickup
      ? `In Ecwid checkout, choose Pickup at Round Rock High School CO-OP Store. Select a time on ${delivery.label}, then choose card or Pay at pickup.`
      : 'In Ecwid checkout, choose Deliver to Room and complete payment online.';
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
      time: fulfillment === 'delivery' ? $('delivery-time').value : '',
      email: email.value.trim().toLowerCase(),
      fulfillment,
    };
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
  function loadWidget() {
    if (widgetReady) return widgetReady;
    widgetReady = new Promise((resolve,reject)=> {
      const timer = setTimeout(()=>reject(new Error('Secure checkout could not load. Check your connection and try again.')),25000);
      window.RRHS_CFA_CHECKOUT_CONTEXT = true;
      window.ec = window.ec || {};
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
            const handoff = pickup ? 'See your confirmation for your pickup time.' : `Delivery: ${checkout.delivery.label}.`;
            $('order-result').textContent = `Order ${orderId || ''} was submitted. ${status} ${handoff}`;
            show('complete');
          });
          window.Ecwid.OnCartChanged.add(cart=> {
            if (preparing || currentView !== 'payment') return;
            checkoutValid = matchingCart(cart) && Date.now() < checkout.expiresAt;
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
  async function prepareCheckout() {
    checkout = await request({ action:'checkout', token, ...details, items:selectedItems().map(({sku,quantity,price})=>({sku,quantity,price})), sauces:sauceCounts, deliveryDate:delivery.date });
    if (!drawer.open) return;
    try { sessionStorage.setItem('rrhs-cfa-pending',JSON.stringify({token,grant:checkout.grant})); } catch (_) {}
    checkoutExpiry();
    $('checkout-fulfillment-note').textContent = $('review-fulfillment-note').textContent;
    show('payment'); preparing = true; checkoutValid = false; $('ecwid-checkout').inert = true; $('checkout-status').hidden = false;
    try {
      await loadWidget();
      if (!drawer.open) return;
      await clearCart();
      window.ec.order = window.ec.order || {}; window.ec.order.extraFields = window.ec.order.extraFields || {};
      const fields = {
        cfa_preorder: ['Order type', 'Faculty Chick-fil-A preorder'],
        cfa_verified_email: ['Verified district email', checkout.email],
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
      window.Ecwid.refreshConfig();
      for (const item of checkout.items) {
        await new Promise((resolve,reject)=> {
          const timer = setTimeout(()=>reject(new Error('Adding your lunch timed out. Please go back and try again.')),15000);
          window.Ecwid.Cart.addProduct({ id:item.id, quantity:item.quantity, callback:success=> { clearTimeout(timer); success ? resolve() : reject(new Error(`${item.name} could not be added to the preorder checkout. Please contact the CO-OP.`)); } });
        });
      }
      await ecwidCall('setCustomerEmail',checkout.email);
      if (checkout.fulfillment !== 'pickup') {
        await ecwidCall('setAddress', { name: checkout.name, street: `Round Rock High School, Room ${checkout.room}`, city: 'Round Rock', stateOrProvinceCode: 'TX', postalCode: '78681', countryName: 'United States', countryCode: 'US' });
      }
      await ecwidCall('setOrderComments',checkout.comments);
      const cart = await getCart();
      if (!matchingCart(cart)) throw new Error('Your checkout items changed. Please return to preorder review and try again.');
      if (!drawer.open) return;
      checkoutValid = true; $('ecwid-checkout').inert = false; $('checkout-status').hidden = true;
      window.Ecwid.Cart.canGotoCheckout(allowed => { if (allowed) window.Ecwid.Cart.gotoCheckout(); else window.Ecwid.openPage('cart'); });
    } catch (err) {
      message('checkout-error',err.message); $('checkout-status').hidden=true;
      // Keep the native form inaccessible if setup or validation failed.
      $('ecwid-checkout').inert=true;
    } finally { preparing=false; sendHeight(); }
  }
  $('pay-now').addEventListener('click',()=>busy($('pay-now'),'Preparing checkout…',prepareCheckout,'payment-error'));
  $('back-from-payment').addEventListener('click',()=>{ checkoutValid=false; clearTimeout(expiryTimer); show('review'); });
  // Guard native checkout controls as well as the custom preorder buttons.
  window.addEventListener('click',event=> {
    const button = event.target.closest('button,input[type=submit]');
    if (!button || !button.closest('#ecwid-checkout')) return;
    if (!checkoutValid || preparing || Date.now() >= checkout.expiresAt) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    const email = document.querySelector('#ec-cart-email-input');
    if (email && email.value.trim().toLowerCase() !== checkout.email) { event.preventDefault(); event.stopImmediatePropagation(); message('checkout-error','Use the district email you verified, or go back to verify a different address.'); }
  },true);
  let lastHeight=0;
  function sendHeight() {
    if (window.parent === window || drawer.open) return;
    const height = Math.ceil(document.querySelector('.page').getBoundingClientRect().height);
    if (height===lastHeight) return;
    lastHeight=height; window.parent.postMessage({type:'rrhs-cfa-preorder-height',height},parentOrigin);
  }
  new ResizeObserver(sendHeight).observe(document.body);
  window.addEventListener('rrhs-embed-resize',sendHeight);
  window.addEventListener('message', event => {
    if (event.source !== parent || event.origin !== parentOrigin) return;
    if (event.data?.type === 'rrhs-cfa-preorder-drawer-ready' && drawer.open) {
      document.documentElement.classList.add('preorder-overlay');
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
      $('delivery-label').textContent=delivery.label;
      renderMenu();renderSauces();summary();
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
          for(const [id,value] of [['teacher-name',details.name],['teacher-room',details.room],['teacher-email',details.email],['delivery-time',details.time]])$(id).value=value;
          review();$('checkout-fulfillment-note').textContent = $('review-fulfillment-note').textContent;openDrawer('payment');preparing=true;await loadWidget();preparing=false;
          checkoutValid=true;$('checkout-status').hidden=true;checkoutExpiry();
        } catch (err) {
          preparing = false;
          checkoutValid = false;
          $('ecwid-checkout').inert = true;
          message('page-error', 'We could not resume this checkout. If you already paid, check your Ecwid receipt before ordering again. ' + err.message);
        }
      }

    } catch(err) { message('page-error',`${err.message} Reload this page to try again.`);$('menu').innerHTML='<p>Menu unavailable. Please try again shortly.</p>';$('menu').setAttribute('aria-busy','false'); }
    sendHeight();
  })();
}());

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
      el.innerHTML = `<p class="eyebrow">Reserved for your lunch break</p><h3>Your preorder</h3>${lines}${sauceSummary}<div class="receipt-total"><span>Subtotal</span><span>${money(subtotal())}</span></div><p>Final taxes &amp; delivery at checkout.<br>Chick-fil-A is excluded from faculty discounts.</p><p class="receipt-date">Delivery<strong>${escape(delivery?.label || '')}</strong>${details.time ? escape(details.time) : 'Around 12:45 p.m.'}</p>`;
    });
    $('subtotal').textContent = money(subtotal());
    $('review-order').disabled = selectedItems().length === 0;
  }
  function show(view) {
    currentView = view;
    document.querySelectorAll('.view').forEach(el => { el.hidden = el.id !== `${view}-view`; });
    const step = { menu: 0, details: 1, verify: 2, review: 3, payment: 3, complete: 3 }[view];
    document.querySelectorAll('.progress li').forEach((el,i) => { if (i === step) el.setAttribute('aria-current','step'); else el.removeAttribute('aria-current'); });
    summary();
    const heading = $(`${view}-title`);
    if (heading) { heading.focus({ preventScroll: true }); if (window.parent === window) heading.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); else window.parent.postMessage({ type: 'rrhs-cfa-preorder-scroll', top: heading.getBoundingClientRect().top + scrollY - 24 }, parentOrigin); }
    sendHeight();
  }
  const descriptions = { '601_sku': 'The original, with pickles on a toasted buttered bun.', '782_sku': 'Grilled chicken, crisp greens, eggs, and a little crunch.', '698_sku': 'Eight bite-sized favorites, ready for your favorite sauce.' };
  function renderMenu() {
    $('menu').innerHTML = menu.map((p,i) => `<article class="food-card" data-sku="${p.sku}"><div class="food-image"><span class="menu-index" aria-hidden="true">0${i+1}</span><img src="../assets/${p.image}" width="700" height="700" alt="${escape(p.name)}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'}></div><div class="food-title"><h3>${escape(p.name)}</h3><span class="price">${money(p.price)}</span></div><p class="food-description">${escape(descriptions[p.sku])}</p><div class="quantity-row"><label for="qty-${p.sku}">Quantity</label><div class="stepper"><button type="button" data-delta="-1" aria-label="Remove one ${escape(p.name)}">−</button><input id="qty-${p.sku}" data-quantity type="number" inputmode="numeric" min="0" max="20" step="1" value="${selection.get(p.sku)?.quantity || 0}" ${!p.available ? 'disabled' : ''}><button type="button" data-delta="1" aria-label="Add one ${escape(p.name)}" ${!p.available ? 'disabled' : ''}>+</button></div></div>${!p.available ? '<p class="inline-error">Temporarily unavailable.</p>' : ''}</article>`).join('');
    $('menu').setAttribute('aria-busy', 'false');
    updateQuantities();
  }
  function renderSauces() {
    $('sauce-options').innerHTML = Object.entries(sauces).map(([key, label]) => {
      const choices = [0, 1, 2, 3].map(count => `
        <label class="sauce-choice">
          <input type="radio" name="sauce-${key}" data-sauce="${key}" value="${count}"
            aria-label="${count} ${count === 1 ? 'packet' : 'packets'}"
            ${count === (sauceCounts[key] || 0) ? 'checked' : ''}>
          <span aria-hidden="true">${count}</span>
        </label>`).join('');
      return `<fieldset class="sauce-option" aria-describedby="sauce-limit">
        <legend>${escape(label)}</legend>
        <div class="sauce-choices">${choices}</div>
      </fieldset>`;
    }).join('');
    $('sauce-section').hidden = false;
  }
  $('sauce-options').addEventListener('change', event => {
    if (!event.target.matches('[data-sauce]')) return;
    sauceCounts[event.target.dataset.sauce] = Number(event.target.value);
    summary();
  });
  function updateQuantities() {
    document.querySelectorAll('.food-card').forEach(card => {
      const input = card.querySelector('[data-quantity]');
      card.querySelector('[data-delta="-1"]').disabled = Number(input.value) <= 0;
      card.querySelector('[data-delta="1"]').disabled = input.disabled || Number(input.value) >= 20;
    });
  }
  function updateSelection(card) {
    const quantity = card.querySelector('[data-quantity]');
    quantity.value = String(Math.max(0, Math.min(20, Math.floor(Number(quantity.value) || 0))));
    selection.set(card.dataset.sku, { quantity: Number(quantity.value) });
    updateQuantities(); summary();
  }
  $('menu').addEventListener('click', event => {
    const button = event.target.closest('[data-delta]'); if (!button) return;
    const card = button.closest('.food-card'), input = card.querySelector('[data-quantity]');
    input.value = String(Number(input.value) + Number(button.dataset.delta)); updateSelection(card);
  });
  $('menu').addEventListener('change', event => { const card = event.target.closest('.food-card'); if (card) updateSelection(card); });
  $('review-order').addEventListener('click', () => show('details'));
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
  function review() {
    const data = [['For',details.name],['Room',details.room],['Delivery',delivery.label],['Time',details.time || 'Around 12:45 p.m.'],['Email',details.email]];
    $('delivery-review').innerHTML = data.map(([label,value])=>`<div><dt>${label}</dt><dd>${escape(value)}</dd></div>`).join(''); show('review');
  }
  $('delivery-form').addEventListener('submit', event => {
    event.preventDefault();
    const email = $('teacher-email'); email.setCustomValidity('');
    if (!/^[a-z0-9][a-z0-9._+-]{0,63}@roundrockisd\.org$/i.test(email.value.trim())) { email.setCustomValidity('Please use your district email ending in @roundrockisd.org.'); email.reportValidity(); return; }
    details = { name:$('teacher-name').value.trim(), room:$('teacher-room').value.trim(), time:$('delivery-time').value, email:email.value.trim().toLowerCase() };
    busy($('send-code'), 'Checking your email…', async()=> {
      if (token && verifiedEmail === details.email) { try { await request({ action:'session', token }); rememberVerification(); review(); return; } catch (err) { if (err.status !== 401) throw err; forget(); } }
      if (token) forget();
      await sendCode();
    }, 'details-error');
  });
  $('teacher-email').addEventListener('input',()=> $('teacher-email').setCustomValidity(''));
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
            $('order-result').textContent = `Order ${orderId || ''} was submitted. ${order.paymentStatus === 'PAID' ? 'Ecwid reports payment received.' : 'Payment is not yet confirmed. Check your Ecwid confirmation before placing another order.'} Delivery: ${checkout.delivery.label}.`;
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
    try { sessionStorage.setItem('rrhs-cfa-pending',JSON.stringify({token,grant:checkout.grant})); } catch (_) {}
    checkoutExpiry();
    show('payment'); preparing = true; checkoutValid = false; $('ecwid-checkout').inert = true; $('checkout-status').hidden = false;
    try {
      await loadWidget();
      await clearCart();
      window.ec.order = window.ec.order || {}; window.ec.order.extraFields = window.ec.order.extraFields || {};
      const fields = { cfa_preorder: ['Order type','Faculty Chick-fil-A preorder'], cfa_delivery_date:['Preorder delivery date',checkout.delivery.date], cfa_delivery_room:['Delivery room',checkout.room], cfa_delivery_time:['Requested delivery time',checkout.time || 'Around 12:45 p.m.'], cfa_verified_email:['Verified district email',checkout.email] };
      for (const [key,[title,value]] of Object.entries(fields)) window.ec.order.extraFields[key] = { title, value, type:'text', orderDetailsDisplaySection:'order_comments', showInNotifications:true, showInInvoice:true };
      window.Ecwid.refreshConfig();
      for (const item of checkout.items) {
        await new Promise((resolve,reject)=> {
          const timer = setTimeout(()=>reject(new Error('Adding your lunch timed out. Please go back and try again.')),15000);
          window.Ecwid.Cart.addProduct({ id:item.id, quantity:item.quantity, callback:success=> { clearTimeout(timer); success ? resolve() : reject(new Error(`${item.name} could not be added to the preorder checkout. Please contact the CO-OP.`)); } });
        });
      }
      await ecwidCall('setCustomerEmail',checkout.email);
      await ecwidCall('setAddress',{ name:checkout.name, street:`Round Rock High School, Room ${checkout.room}`, city:'Round Rock', stateOrProvinceCode:'TX', postalCode:'78681', countryName:'United States', countryCode:'US' });
      await ecwidCall('setOrderComments',checkout.comments);
      const cart = await getCart();
      if (!matchingCart(cart)) throw new Error('Your checkout items changed. Please return to preorder review and try again.');
      checkoutValid = true; $('ecwid-checkout').inert = false; $('checkout-status').hidden = true;
      window.Ecwid.Cart.canGotoCheckout(allowed => { if (allowed) window.Ecwid.Cart.gotoCheckout(); else window.Ecwid.openPage('cart'); });
    } catch (err) {
      message('checkout-error',err.message); $('checkout-status').hidden=true;
      // Keep the native form inaccessible if setup or validation failed.
      $('ecwid-checkout').inert=true;
    } finally { preparing=false; sendHeight(); }
  }
  $('pay-now').addEventListener('click',()=>busy($('pay-now'),'Preparing payment…',prepareCheckout,'payment-error'));
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
    if (window.parent===window) return;
    const height=Math.ceil(document.body.scrollHeight);
    if (height===lastHeight) return;
    lastHeight=height; window.parent.postMessage({type:'rrhs-cfa-preorder-height',height},parentOrigin);
  }
  new ResizeObserver(sendHeight).observe(document.body);
  window.addEventListener('rrhs-embed-resize',sendHeight);
  window.addEventListener('message',event=>{if(event.source===parent && event.origin===parentOrigin && event.data?.type==='rrhs-cfa-preorder-request-height'){lastHeight=0;sendHeight();}});
  (async()=> {
    try {
      const data=await request(); menu=data.menu;sauces=data.sauces;delivery=data.delivery;storeId=data.storeId;
      $('delivery-label').textContent=delivery.label;
      renderMenu();renderSauces();summary();
      if(token) { try {const session=await request({action:'session',token});verifiedEmail=session.email;$('teacher-email').value=verifiedEmail;$('send-code').innerHTML='Review delivery details <span aria-hidden="true">→</span>';}catch(_){forget();} }
      let pending=null; try { pending=JSON.parse(sessionStorage.getItem('rrhs-cfa-pending') || 'null'); } catch (_) {}
      if(pending && location.hash) {
        try {
          const resumed=await request({action:'resume',token:pending.token,grant:pending.grant});
          token=pending.token;verifiedEmail=resumed.email;checkout=resumed;
          details={name:checkout.name,room:checkout.room,time:checkout.time,email:checkout.email};
          delivery=checkout.delivery;$('delivery-label').textContent=delivery.label;
          for (const item of checkout.items) selection.set(item.sku, { quantity: item.quantity });
          sauceCounts = checkout.sauces || {};
          renderMenu();
          renderSauces();
          for(const [id,value] of [['teacher-name',details.name],['teacher-room',details.room],['teacher-email',details.email],['delivery-time',details.time]])$(id).value=value;
          review();show('payment');preparing=true;await loadWidget();preparing=false;
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

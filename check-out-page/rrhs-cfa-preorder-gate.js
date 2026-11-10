/* Faculty lunches are bought through the dedicated verified preorder page. */
(function () {
  if (location.pathname === '/iframes/teachers/chick-fil-a/index.html') return;
  if (window.__rrhsCfaGate) return;
  window.__rrhsCfaGate = true;
  const products = window.RRHS_CFA_PRODUCTS;
  if (!products) return;
  let hasPreorder = false, productId = null, pageType = '', bound = false;
  const express = '.ec-cart__button--apple-pay, .ec-cart__button--google-pay, .ec-cart__button--paypal';
  const checkoutArea = '.ec-cart, .ec-checkout';
  const controls = 'button, a, input[type="submit"], [role="button"], [data-rrhs-overlay-btn]';
  const checkoutPage = type => /^CHECKOUT_/.test(type);
  const blockedControls = new Map();
  function isCheckoutControl(control) {
    return control.matches('[data-rrhs-overlay-btn]') ||
      Boolean(control.closest('.ec-cart__button--checkout, ' + express)) ||
      (Boolean(control.closest(checkoutArea)) &&
        /^(continue|(?:go to |proceed to )?checkout|place order|pay(?: now)?|go to payment)$/i.test((control.value || control.textContent).trim()));
  }
  const style = document.createElement('style');
  style.textContent = '.rrhs-cfa-notice{padding:20px 24px;margin:20px 0;border-left:3px solid #6e1f2a;background:#f1eee8;color:#3d292b;font:16px/1.5 var(--body,Georgia,serif)}.rrhs-cfa-notice strong{display:block;margin-bottom:8px;color:#6e1f2a}.rrhs-cfa-notice a{display:inline-flex;align-items:center;min-height:44px;color:#6e1f2a;text-underline-offset:4px;font-weight:600}.rrhs-cfa-product .details-product-purchase__controls,.rrhs-cfa-product .details-product-purchase__add-to-bag,.rrhs-cfa-product .details-product-purchase__qty{display:none!important}.rrhs-cfa-product .rrhs-cfa-notice{display:block!important}';
  style.textContent += '.rrhs-cfa-grid-product .grid-product__buy-now { display:none!important }';
  style.textContent += '[data-rrhs-cfa-blocked]{opacity:.5;cursor:not-allowed}';
  document.head.appendChild(style);
  function productIdFromLink(href) {
    const match = /-p(\d+)(?:[/?#]|$)/.exec(href);
    return match ? Number(match[1]) : null;
  }
  function currentProductId() {
    return productId || productIdFromLink(location.href);
  }
  function notice(id) {
    let box = document.getElementById(id);
    if (box) return box;
    box = document.createElement('div'); box.id = id; box.className = 'rrhs-cfa-notice'; box.setAttribute('role','alert');
    box.innerHTML = '<strong>Chick-fil-A is preorder only.</strong><p>Remove Chick-fil-A items from this cart to continue with your regular order. For a faculty lunch, choose your delivery details and verify your district email on the teacher preorder page.</p><a href="' + products.url + '">Preorder through the teacher hub →</a>';
    return box;
  }
  function render() {
    const isProduct = products.ids.includes(Number(currentProductId()));
    const detail = document.querySelector('.ec-store .product-details, .ec-store .ec-store__product-page');
    document.querySelectorAll('.rrhs-cfa-product').forEach(el=>{if(el!==detail || !isProduct)el.classList.remove('rrhs-cfa-product');});
    const old = document.getElementById('rrhs-cfa-product-notice');
    if (isProduct && detail) {
      detail.classList.add('rrhs-cfa-product');
      if (!old) {
        const box=notice('rrhs-cfa-product-notice');
        box.querySelector('p').textContent='Faculty and staff can choose quantities, sauces, and a school-day delivery date on our separate preorder page.';
        const host=detail.querySelector('.details-product-purchase') || detail;
        host.appendChild(box);
      }
    } else if(old) old.remove();
    document.querySelectorAll('.grid-product').forEach(card => {
      const link = card.querySelector('a[href*="-p"]');
      const id = Number(card.dataset.productId) || productIdFromLink(link?.href || '');
      if (!products.ids.includes(id)) return;
      card.classList.add('rrhs-cfa-grid-product');
    });
    const banner = document.getElementById('rrhs-cfa-cart-notice');
    const cart = document.querySelector('.ec-cart__body, .ec-cart, .ec-checkout');
    if (hasPreorder && cart && !banner) cart.prepend(notice('rrhs-cfa-cart-notice'));
    else if (!hasPreorder && banner) banner.remove();
    for (const [control, previous] of blockedControls) {
      if (hasPreorder && control.isConnected && (control.matches(express) || isCheckoutControl(control))) continue;
      blockedControls.delete(control);
      if ('disabled' in control && !control.dataset.rrhsWrapped) control.disabled = previous.disabled;
      if (previous.ariaDisabled === null) control.removeAttribute('aria-disabled');
      else control.setAttribute('aria-disabled', previous.ariaDisabled);
      if (previous.express) control.inert = previous.inert;
      delete control.dataset.rrhsCfaBlocked;
    }
    if (!hasPreorder) return;
    document.querySelectorAll(controls + ', ' + express).forEach(control => {
      const isExpress = control.matches(express);
      if (!isExpress && !isCheckoutControl(control)) return;
      if (!blockedControls.has(control)) {
        blockedControls.set(control, {
          disabled: control.disabled, ariaDisabled: control.getAttribute('aria-disabled'), inert: control.inert, express: isExpress,
        });
      }
      if ('disabled' in control) control.disabled = true;
      control.setAttribute('aria-disabled', 'true');
      control.dataset.rrhsCfaBlocked = '1';
      // Express wallets can render their own cross-origin payment button.
      if (isExpress) control.inert = true;
    });
  }
  function check(cart) {
    if (!Array.isArray(cart?.items)) return;
    hasPreorder = products.cartHasPreorder(cart);
    render();
    if (hasPreorder && checkoutPage(pageType)) {
      pageType = '';
      window.Ecwid.openPage('cart');
    }
  }
  function guard(event) {
    const button=event.target.closest(controls);
    if(!button) return;
    const detailAdd = products.ids.includes(Number(currentProductId())) &&
      button.closest('.details-product-purchase') && !button.closest('.rrhs-cfa-notice');
    const gridAdd = button.closest('.rrhs-cfa-grid-product .grid-product__buy-now');
    const productAdd = detailAdd || gridAdd;
    const checkout=hasPreorder && isCheckoutControl(button);
    if(!productAdd && !checkout) return;
    event.preventDefault();event.stopImmediatePropagation();
    const box=document.getElementById(productAdd?'rrhs-cfa-product-notice':'rrhs-cfa-cart-notice');
    if(box){box.setAttribute('tabindex','-1');box.focus();}
  }
  window.addEventListener('click',guard,true);
  window.addEventListener('submit',event=>{if(hasPreorder && (checkoutPage(pageType) || event.target.closest(checkoutArea))){event.preventDefault();event.stopImmediatePropagation();}},true);
  function bind() {
    if(bound || !window.Ecwid?.Cart?.get || !window.Ecwid?.OnCartChanged?.add || !window.Ecwid?.OnPageLoaded?.add) return;
    bound=true;
    window.Ecwid.OnPageSwitch?.add(page => {
      if (hasPreorder && checkoutPage(page.type)) return false;
    });
    window.Ecwid.OnCartChanged.add(check);
    window.Ecwid.OnPageLoaded.add(page => {
      pageType = page.type;
      productId = page.type === 'PRODUCT' ? page.productId : null;
      window.Ecwid.Cart.get(check);
      render();
    });
    window.Ecwid.Cart.get(check);
  }
  let pending=false;
  function schedule(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;bind();render();});}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  const interval=setInterval(()=>{bind();if(bound)clearInterval(interval);},250);
  setTimeout(()=>clearInterval(interval),30000);
  bind();
}());

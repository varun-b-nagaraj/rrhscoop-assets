/* api/v1/ecwid/discount-url.js
 *
 * Vercel Serverless Function implementing Ecwid's server-side cart calculation hook (discountUrl).
 *
 * Expected response shape (single dynamic surcharge):
 * { "surcharges": [ { id, type:"ABSOLUTE", value:<fee>, description, taxable:true } ] }
 */

'use strict';

const {
  buildEcwidSurchargeResponseFromSubtotal,
  toFiniteNumber,
} = require('../../../check-out-page/checkout-charges.js');

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map();

function nowMs() {
  return Date.now();
}

function getHeader(req, name) {
  const key = String(name || '').toLowerCase();
  const headers = req && req.headers ? req.headers : {};
  return headers[key];
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Discount-Secret');
}

function sendJson(res, statusCode, obj) {
  setCors(res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

async function readJsonBody(req) {
  // Some runtimes (or middleware) may already populate req.body.
  if (req && req.body && typeof req.body === 'object') return req.body;
  if (req && typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      // Fall through to stream read / form parsing.
    }
  }

  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    // Fallback: support x-www-form-urlencoded payloads.
    try {
      const params = new URLSearchParams(raw);
      const obj = {};
      for (const [k, v] of params.entries()) {
        const trimmed = typeof v === 'string' ? v.trim() : v;
        if (typeof trimmed === 'string' && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
          try {
            obj[k] = JSON.parse(trimmed);
            continue;
          } catch {
            // ignore
          }
        }
        obj[k] = v;
      }
      return Object.keys(obj).length ? obj : null;
    } catch {
      return null;
    }
  }
}

function extractFields(payload) {
  const body = payload && typeof payload === 'object' ? payload : {};
  const cart = body.cart && typeof body.cart === 'object' ? body.cart : {};
  const order = body.order && typeof body.order === 'object' ? body.order : {};

  const storeId = body.storeId ?? body.store_id ?? cart.storeId ?? cart.store_id ?? null;
  const cartId =
    body.cartId ??
    body.cart_id ??
    cart.id ??
    cart.cartId ??
    cart.cart_id ??
    order.id ??
    order.orderNumber ??
    null;

  const paymentMethod =
    cart.paymentMethod ??
    cart.payment_method ??
    body.paymentMethod ??
    body.payment_method ??
    order.paymentMethod ??
    null;

  // Prefer explicit cart subtotal. Fall back to other plausible keys if present.
  const subtotal =
    cart.subtotal ??
    cart.subtotalCost ??
    cart.subtotal_without_tax ??
    order.subtotal ??
    order.subtotalCost ??
    body.subtotal ??
    null;

  const couponCodes = extractCouponCodes(body, cart, order);

  return { storeId, cartId, paymentMethod, subtotal, couponCodes };
}

function extractCouponCodes(body, cart, order) {
  const codes = [];
  const pushIfString = (v) => {
    if (typeof v !== 'string') return;
    const t = v.trim();
    if (t) codes.push(t);
  };

  // Common-ish fields (names vary by Ecwid payload version and integrations).
  pushIfString(cart.couponCode);
  pushIfString(cart.coupon);
  pushIfString(cart.couponName);
  pushIfString(cart.coupon_name);
  pushIfString(cart.coupon_code);

  pushIfString(order.couponCode);
  pushIfString(order.coupon);
  pushIfString(order.couponName);
  pushIfString(order.coupon_code);

  // Sometimes coupon data is nested.
  if (cart.discountCoupon) {
    if (typeof cart.discountCoupon === 'string') pushIfString(cart.discountCoupon);
    if (typeof cart.discountCoupon === 'object' && cart.discountCoupon) {
      pushIfString(cart.discountCoupon.code);
      pushIfString(cart.discountCoupon.name);
    }
  }

  // Arrays of coupons / discounts.
  const candidates = [cart.coupons, cart.discountCoupons, cart.discounts, body.coupons, body.discounts];
  for (const arr of candidates) {
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (typeof item === 'string') {
        pushIfString(item);
        continue;
      }
      if (item && typeof item === 'object') {
        pushIfString(item.code);
        pushIfString(item.name);
        pushIfString(item.couponCode);
        pushIfString(item.coupon);
      }
    }
  }

  return codes;
}

function normalizeCouponCodes(couponCodes) {
  if (!Array.isArray(couponCodes) || couponCodes.length === 0) return [];
  const out = [];
  for (const c of couponCodes) {
    if (typeof c !== 'string') continue;
    const t = c.trim();
    if (!t) continue;
    out.push(t.toUpperCase());
  }
  return Array.from(new Set(out)).sort();
}

function shouldSkipForCouponCodes(couponCodes) {
  const excluded = (process.env.EXCLUDED_COUPON_CODES || 'ECOMMERCE')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  if (excluded.length === 0) return false;

  const normalized = normalizeCouponCodes(couponCodes);
  if (normalized.length === 0) return false;
  return normalized.some((code) => excluded.includes(code));
}

function isAllowedPaymentMethod(paymentMethod) {
  const allowlist = process.env.TARGET_PAYMENT_METHODS;
  if (!allowlist) return true;

  const methods = allowlist
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (methods.length === 0) return true;

  if (!paymentMethod || typeof paymentMethod !== 'string') return false;
  return methods.includes(paymentMethod);
}

function authOk(req) {
  const secret = process.env.DISCOUNT_URL_SHARED_SECRET;
  if (!secret) return true;

  try {
    const u = new URL(req.url, 'http://localhost');
    const token = u.searchParams.get('token');
    if (token) return token === secret;
  } catch {
    // ignore
  }

  const auth = getHeader(req, 'authorization');
  if (auth && typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice('Bearer '.length) === secret;
  }

  const headerSecret = getHeader(req, 'x-discount-secret');
  if (headerSecret && typeof headerSecret === 'string') return headerSecret === secret;

  return false;
}

function makeCacheKey({ storeId, cartId, subtotal, paymentMethod, couponCodes }) {
  return JSON.stringify({
    storeId: storeId ?? null,
    cartId: cartId ?? null,
    subtotal: subtotal ?? null,
    paymentMethod: paymentMethod ?? null,
    couponCodes: normalizeCouponCodes(couponCodes),
  });
}

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= nowMs()) {
    cache.delete(key);
    return null;
  }
  return entry;
}

function setCached(key, responseObj) {
  cache.set(key, { expiresAt: nowMs() + CACHE_TTL_MS, responseObj });

  // Opportunistic cleanup to keep the map bounded without extra deps.
  if (cache.size > 500) {
    const t = nowMs();
    for (const [k, v] of cache.entries()) {
      if (v.expiresAt <= t) cache.delete(k);
      if (cache.size <= 400) break;
    }
  }
}

module.exports = async (req, res) => {
  const startedAt = nowMs();

  if (req.method === 'OPTIONS') return sendJson(res, 204, {});
  if (req.method !== 'POST') return sendJson(res, 405, { surcharges: [] });

  if (!authOk(req)) return sendJson(res, 401, { surcharges: [] });

  const payload = await readJsonBody(req);
  if (payload == null) {
    console.log(
      JSON.stringify({
        msg: 'ecwid_discount_url_invalid_json',
        ts: new Date().toISOString(),
      })
    );
    return sendJson(res, 200, { surcharges: [] });
  }

  const { storeId, cartId, paymentMethod, subtotal, couponCodes } = extractFields(payload);

  if (shouldSkipForCouponCodes(couponCodes)) {
    const numericSubtotal = toFiniteNumber(subtotal);
    console.log(
      JSON.stringify({
        msg: 'ecwid_discount_url_coupon_skipped',
        ts: new Date().toISOString(),
        storeId,
        cartId,
        subtotal: Number.isFinite(numericSubtotal) ? numericSubtotal : null,
        paymentMethod,
        couponCodes: normalizeCouponCodes(couponCodes),
      })
    );
    return sendJson(res, 200, { surcharges: [] });
  }

  // Optional scoping; default is "apply to all".
  if (!isAllowedPaymentMethod(paymentMethod)) {
    console.log(
      JSON.stringify({
        msg: 'ecwid_discount_url_payment_method_skipped',
        ts: new Date().toISOString(),
        storeId,
        cartId,
        paymentMethod,
      })
    );
    return sendJson(res, 200, { surcharges: [] });
  }

  const numericSubtotal = toFiniteNumber(subtotal);
  const cacheKey = makeCacheKey({
    storeId,
    cartId,
    subtotal: numericSubtotal,
    paymentMethod,
    couponCodes,
  });
  const cached = getCached(cacheKey);
  if (cached) {
    console.log(
      JSON.stringify({
        msg: 'ecwid_discount_url',
        ts: new Date().toISOString(),
        storeId,
        cartId,
        subtotal: Number.isFinite(numericSubtotal) ? numericSubtotal : null,
        paymentMethod,
        couponCodes: normalizeCouponCodes(couponCodes),
        cacheHit: true,
        durationMs: nowMs() - startedAt,
      })
    );
    return sendJson(res, 200, cached.responseObj);
  }

  const responseObj = buildEcwidSurchargeResponseFromSubtotal(numericSubtotal);
  setCached(cacheKey, responseObj);

  const feeValue =
    responseObj &&
    responseObj.surcharges &&
    responseObj.surcharges[0] &&
    typeof responseObj.surcharges[0].value === 'number'
      ? responseObj.surcharges[0].value
      : null;

  console.log(
    JSON.stringify({
      msg: 'ecwid_discount_url',
      ts: new Date().toISOString(),
      storeId,
      cartId,
      subtotal: Number.isFinite(numericSubtotal) ? numericSubtotal : null,
      paymentMethod,
      couponCodes: normalizeCouponCodes(couponCodes),
      computedFee: feeValue,
      cacheHit: false,
      durationMs: nowMs() - startedAt,
    })
  );

  return sendJson(res, 200, responseObj);
};

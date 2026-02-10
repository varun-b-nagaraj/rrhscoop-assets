const test = require('node:test');
const assert = require('node:assert/strict');

const handler = require('../api/v1/ecwid/discount-url.js');

function makeReq({ body }) {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    url: '/v1/ecwid/discount-url',
  };
}

function makeRes() {
  const headers = {};
  return {
    statusCode: 0,
    headers,
    setHeader(key, value) {
      headers[String(key).toLowerCase()] = value;
    },
    end(payload) {
      this.ended = true;
      this.payload = payload;
    },
  };
}

function parseJson(res) {
  assert.equal(res.ended, true);
  assert.ok(res.payload);
  return JSON.parse(res.payload);
}

test('discountUrl: skips surcharge when coupon code ECOMMERCE is applied', async () => {
  const prev = process.env.EXCLUDED_COUPON_CODES;
  process.env.EXCLUDED_COUPON_CODES = 'ECOMMERCE';
  try {
    const req = makeReq({ body: { cart: { subtotal: 2.0, couponCode: 'ECOMMERCE' } } });
    const res = makeRes();
    await handler(req, res);
    const json = parseJson(res);
    assert.deepEqual(json, { surcharges: [] });
  } finally {
    process.env.EXCLUDED_COUPON_CODES = prev;
  }
});

test('discountUrl: skips surcharge when cart.discountCoupon.code is ECOMMERCE', async () => {
  const prev = process.env.EXCLUDED_COUPON_CODES;
  process.env.EXCLUDED_COUPON_CODES = 'ECOMMERCE';
  try {
    const req = makeReq({
      body: { cart: { subtotal: 2.0, discountCoupon: { code: 'ECOMMERCE', name: 'Some name' } } },
    });
    const res = makeRes();
    await handler(req, res);
    const json = parseJson(res);
    assert.deepEqual(json, { surcharges: [] });
  } finally {
    process.env.EXCLUDED_COUPON_CODES = prev;
  }
});

test('discountUrl: skips surcharge when cart.couponName is ECOMMERCE (name-only payload)', async () => {
  const prev = process.env.EXCLUDED_COUPON_CODES;
  process.env.EXCLUDED_COUPON_CODES = 'ECOMMERCE';
  try {
    const req = makeReq({ body: { cart: { subtotal: 2.0, couponName: 'ECOMMERCE' } } });
    const res = makeRes();
    await handler(req, res);
    const json = parseJson(res);
    assert.deepEqual(json, { surcharges: [] });
  } finally {
    process.env.EXCLUDED_COUPON_CODES = prev;
  }
});

test('discountUrl: coupon match is case-insensitive', async () => {
  const prev = process.env.EXCLUDED_COUPON_CODES;
  process.env.EXCLUDED_COUPON_CODES = 'ECOMMERCE';
  try {
    const req = makeReq({ body: { cart: { subtotal: 2.0, couponCode: 'ecommerce' } } });
    const res = makeRes();
    await handler(req, res);
    const json = parseJson(res);
    assert.deepEqual(json, { surcharges: [] });
  } finally {
    process.env.EXCLUDED_COUPON_CODES = prev;
  }
});

test('discountUrl: applies surcharge when other coupon is used', async () => {
  const prev = process.env.EXCLUDED_COUPON_CODES;
  process.env.EXCLUDED_COUPON_CODES = 'ECOMMERCE';
  try {
    const req = makeReq({ body: { cart: { subtotal: 2.0, couponCode: 'OTHER' } } });
    const res = makeRes();
    await handler(req, res);
    const json = parseJson(res);
    assert.equal(Array.isArray(json.surcharges), true);
    assert.equal(json.surcharges.length, 1);
    assert.equal(json.surcharges[0].id, 'ops_service_charge');
    assert.equal(json.surcharges[0].value, 0.36);
  } finally {
    process.env.EXCLUDED_COUPON_CODES = prev;
  }
});

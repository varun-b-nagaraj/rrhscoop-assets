const test = require('node:test');
const assert = require('node:assert/strict');

const handler = require('../api/v1/ecwid/discount-url.js');

const originalConsoleLog = console.log;
console.log = () => {};
process.on('exit', () => {
  console.log = originalConsoleLog;
});

function makeReq({ method = 'POST', body, headers = {}, url = '/v1/ecwid/discount-url' }) {
  return {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body,
    url,
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

function restoreEnv(key, previousValue) {
  if (previousValue == null) {
    delete process.env[key];
    return;
  }
  process.env[key] = previousValue;
}

test.describe('discountUrl', { concurrency: 1 }, () => {
  let prevCustomPricingEnabled;

  test.before(() => {
    prevCustomPricingEnabled = process.env.RRHS_CUSTOM_PRICING_ENABLED;
    process.env.RRHS_CUSTOM_PRICING_ENABLED = 'true';
  });

  test.after(() => {
    restoreEnv('RRHS_CUSTOM_PRICING_ENABLED', prevCustomPricingEnabled);
  });

  test('responds 204 to OPTIONS', async () => {
    const req = makeReq({ method: 'OPTIONS' });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 204);
    const json = parseJson(res);
    assert.deepEqual(json, {});
  });

  test('responds 405 to non-POST', async () => {
    const req = makeReq({ method: 'PUT' });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 405);
    const json = parseJson(res);
    assert.deepEqual(json, { surcharges: [] });
  });

  test('responds 200 to GET with empty surcharges', async () => {
    const req = makeReq({ method: 'GET' });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    const json = parseJson(res);
    assert.deepEqual(json, { surcharges: [] });
  });

  test('responds 200 to HEAD with empty surcharges', async () => {
    const req = makeReq({ method: 'HEAD' });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    const json = parseJson(res);
    assert.deepEqual(json, { surcharges: [] });
  });

  test('responds 401 when auth secret mismatches', async () => {
    const prev = process.env.DISCOUNT_URL_SHARED_SECRET;
    process.env.DISCOUNT_URL_SHARED_SECRET = 'expected-secret';
    try {
      const req = makeReq({
        body: { cart: { subtotal: 2.0 } },
        headers: { 'x-discount-secret': 'wrong-secret' },
      });
      const res = makeRes();
      await handler(req, res);
      assert.equal(res.statusCode, 401);
      const json = parseJson(res);
      assert.deepEqual(json, { surcharges: [] });
    } finally {
      restoreEnv('DISCOUNT_URL_SHARED_SECRET', prev);
    }
  });

  test('returns empty surcharges when custom pricing is disabled', async () => {
    const prev = process.env.RRHS_CUSTOM_PRICING_ENABLED;
    process.env.RRHS_CUSTOM_PRICING_ENABLED = 'false';
    try {
      const req = makeReq({ body: { cart: { subtotal: 100.0 } } });
      const res = makeRes();
      await handler(req, res);
      assert.equal(res.statusCode, 200);
      const json = parseJson(res);
      assert.deepEqual(json, { surcharges: [] });
    } finally {
      restoreEnv('RRHS_CUSTOM_PRICING_ENABLED', prev);
    }
  });

  test('skips surcharge when coupon code ECOMMERCE is applied', async () => {
    const prev = process.env.EXCLUDED_COUPON_CODES;
    process.env.EXCLUDED_COUPON_CODES = 'ECOMMERCE';
    try {
      const req = makeReq({ body: { cart: { subtotal: 2.0, couponCode: 'ECOMMERCE' } } });
      const res = makeRes();
      await handler(req, res);
      const json = parseJson(res);
      assert.deepEqual(json, { surcharges: [] });
    } finally {
      restoreEnv('EXCLUDED_COUPON_CODES', prev);
    }
  });

  test('skips surcharge when cart.discountCoupon.code is ECOMMERCE', async () => {
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
      restoreEnv('EXCLUDED_COUPON_CODES', prev);
    }
  });

  test('skips surcharge when cart.couponName is ECOMMERCE (name-only payload)', async () => {
    const prev = process.env.EXCLUDED_COUPON_CODES;
    process.env.EXCLUDED_COUPON_CODES = 'ECOMMERCE';
    try {
      const req = makeReq({ body: { cart: { subtotal: 2.0, couponName: 'ECOMMERCE' } } });
      const res = makeRes();
      await handler(req, res);
      const json = parseJson(res);
      assert.deepEqual(json, { surcharges: [] });
    } finally {
      restoreEnv('EXCLUDED_COUPON_CODES', prev);
    }
  });

  test('coupon match is case-insensitive', async () => {
    const prev = process.env.EXCLUDED_COUPON_CODES;
    process.env.EXCLUDED_COUPON_CODES = 'ECOMMERCE';
    try {
      const req = makeReq({ body: { cart: { subtotal: 2.0, couponCode: 'ecommerce' } } });
      const res = makeRes();
      await handler(req, res);
      const json = parseJson(res);
      assert.deepEqual(json, { surcharges: [] });
    } finally {
      restoreEnv('EXCLUDED_COUPON_CODES', prev);
    }
  });

  test('applies surcharge when other coupon is used', async () => {
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
      restoreEnv('EXCLUDED_COUPON_CODES', prev);
    }
  });
});

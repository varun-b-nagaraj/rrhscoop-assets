const test = require('node:test');
const assert = require('node:assert/strict');

const {
  computeOpsServiceChargeFromSubtotal,
  buildEcwidSurchargeResponseFromSubtotal,
  SURCHARGE_ID,
  SURCHARGE_DESCRIPTION,
} = require('../check-out-page/checkout-charges.js');

test('computeOpsServiceChargeFromSubtotal: empty/zero/negative returns null', () => {
  assert.equal(computeOpsServiceChargeFromSubtotal(null), null);
  assert.equal(computeOpsServiceChargeFromSubtotal(undefined), null);
  assert.equal(computeOpsServiceChargeFromSubtotal(''), null);
  assert.equal(computeOpsServiceChargeFromSubtotal(0), null);
  assert.equal(computeOpsServiceChargeFromSubtotal(-1), null);
});

test('computeOpsServiceChargeFromSubtotal: rounding edge cases', () => {
  assert.equal(computeOpsServiceChargeFromSubtotal(0.01), 0.3);
  assert.equal(computeOpsServiceChargeFromSubtotal(1.0), 0.33);
  assert.equal(computeOpsServiceChargeFromSubtotal(2.0), 0.36);
  assert.equal(computeOpsServiceChargeFromSubtotal(100.0), 3.2);
});

test('buildEcwidSurchargeResponseFromSubtotal: returns single surcharge object with stable id', () => {
  const resp = buildEcwidSurchargeResponseFromSubtotal(2.0);
  assert.ok(resp);
  assert.ok(Array.isArray(resp.surcharges));
  assert.equal(resp.surcharges.length, 1);
  assert.deepEqual(resp.surcharges[0], {
    id: SURCHARGE_ID,
    type: 'ABSOLUTE',
    value: 0.36,
    description: SURCHARGE_DESCRIPTION,
    taxable: true,
  });
});

test('buildEcwidSurchargeResponseFromSubtotal: subtotal <= 0 returns no surcharge', () => {
  assert.deepEqual(buildEcwidSurchargeResponseFromSubtotal(0), { surcharges: [] });
});


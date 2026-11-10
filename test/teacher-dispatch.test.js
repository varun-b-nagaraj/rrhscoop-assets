'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { dispatchOrder } = require('../api/v1/teachers/dispatch');
const { emailAddress } = require('../teacher-preorders/service');

function order(placed) {
  return {
    id: 'CFA01',
    createTimestamp: Date.parse(placed) / 1000,
    paymentStatus: 'PAID',
    items: [{ productId: 779182392, quantity: 2 }, { sku: 'unrelated', quantity: 1 }],
    orderComments: [
      'FACULTY CHICK-FIL-A PREORDER',
      'Verified district email: teacher@roundrockisd.org',
      'Name: Example Teacher',
      'Room: 1314',
      'Delivery: Wednesday, November 11',
      'Sauces: Ketchup: 1',
    ].join('\n'),
  };
}

test('dispatch uses the exclusive 2 p.m. Central cutoff across daylight saving time', () => {
  assert.ok(dispatchOrder(order('2026-11-10T19:59:59Z'), '2026-11-10'));
  assert.equal(dispatchOrder(order('2026-11-10T20:00:00Z'), '2026-11-10'), null);
  assert.ok(dispatchOrder(order('2027-04-01T18:59:59Z'), '2027-04-01'));
  assert.equal(dispatchOrder(order('2027-04-01T19:00:00Z'), '2027-04-01'), null);
  assert.equal(dispatchOrder(order('2026-11-10T05:59:59Z'), '2026-11-10'), null);
});

test('dispatch excludes regular and incomplete orders and labels orders awaiting payment', () => {
  const placed = order('2026-11-10T19:00:00Z');
  assert.equal(dispatchOrder({ ...placed, orderComments: '' }, '2026-11-10'), null);
  assert.equal(dispatchOrder({ ...placed, paymentStatus: 'INCOMPLETE' }, '2026-11-10'), null);
  assert.equal(dispatchOrder({ ...placed, paymentStatus: 'AWAITING_PAYMENT' }, '2026-11-10').paymentStatus, 'AWAITING_PAYMENT');
  const row = dispatchOrder(placed, '2026-11-10');
  assert.deepEqual(row.items, [{ name: 'Original Chicken Sandwich', quantity: 2 }]);
  assert.equal(row.sauces, 'Ketchup: 1');
  assert.equal(row.room, '1314');
  assert.ok(!JSON.stringify(row).includes('@roundrockisd.org'));
});

test('only the designated Gmail test address can verify outside the district domain', () => {
  assert.equal(emailAddress('VarunNagaraj2009@gmail.com'), 'varunnagaraj2009@gmail.com');
  assert.throws(() => emailAddress('anyone@gmail.com'));
});

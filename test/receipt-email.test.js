'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { buildReceiptEmail } = require('../receipts/receipt-email.js');

const order = {
  id: 'ORDTEST1',
  createTimestamp: 1777646400,
  email: 's000000@student.roundrockisd.org',
  fulfillmentStatus: 'AWAITING_PROCESSING',
  paymentMethod: 'Credit or debit card',
  subtotal: 10,
  total: 11,
  tax: 0,
  billingPerson: { name: 'Pat <Tester>', firstName: 'Pat' },
  shippingOption: { shippingMethodName: 'Deliver to Room', shippingRate: 1, fulfillmentType: 'DELIVERY' },
  orderExtraFields: [{ title: 'Delivery Location', value: '2502' }],
  items: [
    {
      name: 'Strip Slider',
      quantity: 2,
      price: 4,
      selectedOptions: [
        { name: 'Sauce', value: 'Ranch' },
        { name: 'SauceQty1', value: '1' },
      ],
    },
    { name: 'Tea', quantity: 1, price: 2 },
  ],
};

test('builds a courteous receipt with order details', () => {
  const { subject, html, text } = buildReceiptEmail(order);
  assert.match(subject, /#ORDTEST1/);
  assert.match(text, /^Thank you, Pat!/);
  assert.match(text, /about 20 minutes/);
  assert.match(text, /Status: Order received/);
  assert.match(text, /Deliver to: Room 2502/);
  assert.match(text, /Strip Slider \(Sauce: Ranch\) x2: \$8\.00/);
  assert.match(text, /Delivery: \$1\.00/);
  assert.match(text, /Total: \$11\.00/);
  assert.doesNotMatch(text, /SauceQty1/);
  assert.match(html, /regular-logo\.png/);
});

test('escapes customer-entered text in HTML', () => {
  const { html } = buildReceiptEmail(order);
  assert.match(html, /Pat &lt;Tester&gt;/);
  assert.doesNotMatch(html, /<Tester>/);
});

test('uses the schedule instead of the 20-minute ETA when scheduled', () => {
  const scheduled = { ...order, orderExtraFields: [...order.orderExtraFields, { title: 'Schedule', value: '3rd period' }] };
  const { text } = buildReceiptEmail(scheduled);
  assert.match(text, /scheduled time: 3rd period/);
  assert.doesNotMatch(text, /20 minutes/);
});

test('faculty pickup confirmation names the pickup time and balance due', () => {
  const order = {
    id: 'CFA01',
    email: 'teacher@example.com',
    total: 12.5,
    paymentMethod: 'Pay at pickup',
    paymentStatus: 'AWAITING_PAYMENT',
    shippingOption: { fulfillmentType: 'PICKUP' },
    pickupTime: '2026-11-11 18:45:00 +0000',
    orderComments: 'FACULTY CHICK-FIL-A PREORDER\nSauces: Ranch: 2',
    extraFields: { cfa_delivery_room: '1314' },
  };
  const confirmation = buildReceiptEmail(order);
  assert.match(confirmation.subject, /Pickup confirmed/);
  assert.match(confirmation.text, /Wednesday, November 11, 2026 at 12:45 PM Central/);
  assert.match(confirmation.text, /\$12\.50 due/);
  assert.match(confirmation.text, /Sauces: Ranch: 2/);
  assert.doesNotMatch(confirmation.text, /Room 1314|20 minutes|tax invoice/);
  const paid = buildReceiptEmail({ ...order, paymentStatus: 'PAID' });
  assert.match(paid.subject, /Receipt/);
  assert.match(paid.text, /Paid at pickup/);
  assert.doesNotMatch(paid.text, /balance due|\$12\.50 due/);
});

test('faculty delivery receipts show the scheduled classroom and online payment', () => {
  const { text } = buildReceiptEmail({
    id: 'CFA02', paymentMethod: 'Credit or debit card', paymentStatus: 'PAID',
    orderComments: 'FACULTY CHICK-FIL-A PREORDER\nRoom: 1314',
    extraFields: { cfa_delivery_date: '2026-11-11', cfa_delivery_time: 'Around 12:45 p.m.' },
  });
  assert.match(text, /Deliver to: Room 1314/);
  assert.match(text, /Wednesday, November 11, 2026/);
  assert.match(text, /Paid · Credit or debit card/);
  assert.doesNotMatch(text, /20 minutes/);
});

test('receipt feed keeps pickup confirmation and paid receipt as separate notifications', async t => {
  const handler = require('../api/v1/receipts/pending');
  const env = {
    RRHS_ECWID_STORE_ID: '123',
    RRHS_ECWID_API_TOKEN: 'test-token',
    RRHS_RECEIPTS_SECRET: 'test-receipt-secret',
  };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const pickup = {
    ...order, id: 'PICKUP1', paymentStatus: 'AWAITING_PAYMENT', paymentMethod: 'Pay at pickup',
    shippingOption: { fulfillmentType: 'PICKUP' }, orderComments: 'FACULTY CHICK-FIL-A PREORDER',
  };
  let paid = false;
  t.mock.method(globalThis, 'fetch', async input => {
    const params = new URL(input).searchParams;
    const items = params.get('paymentStatus') === 'AWAITING_PAYMENT'
      ? [pickup, { ...pickup, id: 'REGULAR', orderComments: '' }]
      : paid && params.has('updatedFrom') ? [{ ...pickup, paymentStatus: 'PAID' }] : [];
    return { ok: true, json: async () => ({ total: items.length, items }) };
  });
  async function pending(query = '') {
    const res = { setHeader() {}, end(body) { this.data = JSON.parse(body); } };
    await handler({ method: 'GET', url: '/pending' + query, headers: { 'x-receipts-secret': env.RRHS_RECEIPTS_SECRET } }, res);
    assert.equal(res.statusCode, 200);
    return res.data.receipts;
  }
  assert.deepEqual(await pending(), []);
  const [confirmation] = await pending('?includePickupConfirmations=1');
  assert.equal(confirmation.notificationId, 'PICKUP1:pickup-confirmation');
  assert.equal(confirmation.orderId, 'PICKUP1');
  paid = true;
  const [receipt] = await pending('?includePickupConfirmations=1');
  assert.equal(receipt.notificationId, 'PICKUP1');
  assert.match(receipt.text, /Paid at pickup/);
});

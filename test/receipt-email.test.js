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

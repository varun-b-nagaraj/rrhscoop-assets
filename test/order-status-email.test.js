'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');

const script = readFileSync(require.resolve('../apps-script/teacher-preorder-verification.gs'), 'utf8');
const START = Date.parse('2026-11-10T15:00:00Z');

function order(id, changes = {}) {
  return {
    id,
    email: `${id.toLowerCase()}@roundrockisd.org`,
    // Placed before the job's first run unless a test says otherwise.
    createTimestamp: START / 1000 - 60,
    updateTimestamp: START / 1000 - 60,
    paymentStatus: 'PAID',
    paymentMethod: 'Credit or debit card',
    fulfillmentStatus: 'AWAITING_PROCESSING',
    refundedAmount: 0,
    total: 12,
    billingPerson: { name: 'Pat Teacher', firstName: 'Pat' },
    shippingOption: { shippingMethodName: 'Deliver to Room', fulfillmentType: 'DELIVERY' },
    orderComments: 'FACULTY CHICK-FIL-A PREORDER\nRoom: 1234',
    items: [{ name: 'Grilled Chicken Cobb Salad', quantity: 1, price: 12 }],
    ...changes,
  };
}

/** A fake Apps Script runtime whose clock and Ecwid orders the test controls. */
function runtime() {
  const properties = new Map([['RRHS_ECWID_STORE_ID', '123'], ['RRHS_ECWID_API_TOKEN', 'test-token']]);
  const sent = [];
  const requests = [];
  const state = { now: START, orders: [], failSend: false };
  const context = {
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [state.now])); }
      static now() { return state.now; }
    },
    console: { error() {}, log() {} },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => properties.get(key),
      setProperty: (key, value) => properties.set(key, String(value)),
      deleteProperty: key => properties.delete(key),
      getProperties: () => Object.fromEntries(properties),
    }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    GmailApp: { sendEmail(to, subject, body, options) {
      if (state.failSend) throw new Error('Gmail is down');
      sent.push({ to, subject, body, options });
    } },
    UrlFetchApp: { fetch(url) {
      requests.push(url);
      const params = new URL(url).searchParams;
      const from = Number(params.get('updatedFrom'));
      const items = state.orders.filter(entry => !from || entry.updateTimestamp >= from);
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ total: items.length, items }) };
    } },
  };
  runInNewContext(script, context);
  const run = () => context.sendOrderStatusUpdates();
  const advance = minutes => { state.now += minutes * 60000; };
  const update = (id, changes) => {
    const index = state.orders.findIndex(entry => entry.id === id);
    state.orders[index] = { ...state.orders[index], ...changes, updateTimestamp: state.now / 1000 };
  };
  return { context, properties, sent, requests, state, run, advance, update };
}

test('first run records existing orders without emailing anyone', () => {
  const env = runtime();
  env.state.orders = [order('OLD1', { createTimestamp: START / 1000 - 86400, fulfillmentStatus: 'SHIPPED' })];
  env.run();
  assert.equal(env.sent.length, 0);
  assert.ok(env.properties.get('os_OLD1'));
  assert.equal(env.properties.get('STATUS_START_AT'), String(START / 1000));
});

test('staff status changes send one email each, and nothing repeats', () => {
  const env = runtime();
  env.run();
  env.advance(1);
  env.state.orders = [order('A1', { createTimestamp: env.state.now / 1000, updateTimestamp: env.state.now / 1000 })];
  env.run();
  assert.equal(env.sent.length, 0, 'a new order with no status change gets no status email');

  env.advance(1);
  env.update('A1', { fulfillmentStatus: 'SHIPPED' });
  env.run();
  assert.equal(env.sent.length, 1);
  assert.equal(env.sent[0].to, 'a1@roundrockisd.org');
  assert.match(env.sent[0].subject, /^Your order is on its way · #A1$/);
  assert.match(env.sent[0].body, /bringing your order to Room 1234/);
  assert.equal(env.sent[0].options.replyTo, 'rrhs_coop_store@roundrockisd.org');

  env.advance(1);
  env.run();
  env.advance(1);
  env.run();
  assert.equal(env.sent.length, 1, 'repeat runs inside the overlap window do not resend');

  env.advance(10);
  env.update('A1', { fulfillmentStatus: 'DELIVERED' });
  env.run();
  assert.equal(env.sent.length, 2);
  assert.match(env.sent[1].subject, /^Your order was delivered/);
  assert.match(env.sent[1].body, /dropped off your order at Room 1234/);
});

test('an order that changes before the first check still gets its update', () => {
  const env = runtime();
  env.run();
  env.advance(1);
  env.state.orders = [order('FAST', { createTimestamp: env.state.now / 1000, fulfillmentStatus: 'SHIPPED' })];
  env.run();
  assert.equal(env.sent.length, 1);
  assert.match(env.sent[0].subject, /on its way/);
});

test('only the latest status is sent when several changes land in one minute', () => {
  const env = runtime();
  env.state.orders = [order('B1')];
  env.run();
  env.advance(1);
  env.update('B1', { fulfillmentStatus: 'DELIVERED' });
  env.run();
  assert.deepEqual(env.sent.map(mail => mail.subject), ['Your order was delivered · #B1']);
});

test('refunds report the newly refunded amount', () => {
  const env = runtime();
  env.state.orders = [order('R1', { fulfillmentStatus: 'DELIVERED' })];
  env.run();
  env.advance(1);
  env.update('R1', { paymentStatus: 'PARTIALLY_REFUNDED', refundedAmount: 5 });
  env.run();
  assert.equal(env.sent.length, 1);
  assert.match(env.sent[0].subject, /^Your refund is on the way/);
  assert.match(env.sent[0].body, /We refunded \$5\.00 to your credit or debit card/);
  assert.match(env.sent[0].body, /5–10 business days/);
  env.advance(1);
  env.update('R1', { paymentStatus: 'REFUNDED', refundedAmount: 12 });
  env.run();
  assert.match(env.sent[1].body, /We refunded \$7\.00/);
});

test('cancelling sends only the cancellation, once', () => {
  const env = runtime();
  env.state.orders = [order('C1')];
  env.run();
  env.advance(1);
  env.update('C1', { paymentStatus: 'CANCELLED', fulfillmentStatus: 'WILL_NOT_DELIVER' });
  env.run();
  env.advance(1);
  env.update('C1', { fulfillmentStatus: 'RETURNED' });
  env.run();
  assert.deepEqual(env.sent.map(mail => mail.subject), ['Your order was cancelled · #C1']);
});

test('pickup orders get a ready email with any balance due', () => {
  const env = runtime();
  env.state.orders = [order('P1', {
    paymentStatus: 'AWAITING_PAYMENT', paymentMethod: 'Pay at pickup', total: 12.5,
    shippingOption: { fulfillmentType: 'PICKUP' }, orderComments: 'FACULTY CHICK-FIL-A PREORDER',
  })];
  env.run();
  env.advance(1);
  env.update('P1', { fulfillmentStatus: 'READY_FOR_PICKUP' });
  env.run();
  assert.match(env.sent[0].subject, /^Your order is ready for pickup/);
  assert.match(env.sent[0].body, /Please pay \$12\.50 when you collect it/);
  env.advance(1);
  env.update('P1', { fulfillmentStatus: 'DELIVERED', paymentStatus: 'PAID' });
  env.run();
  assert.match(env.sent[1].subject, /^Your order was picked up/);
  assert.match(env.sent[1].body, /Status: Picked up/);
});

test('the status badge names the update, not the current Ecwid status', () => {
  const env = runtime();
  const { text } = env.context.buildStatusEmail(order('S1', { fulfillmentStatus: 'PROCESSING', trackingNumber: '1Z' }), 'SHIPPED');
  assert.match(text, /Status: Out for delivery/);
  assert.match(text, /^Your order is on its way\n\nHi Pat,\nA CO-OP student/);
});

test('a tracking number counts as shipped', () => {
  const env = runtime();
  env.state.orders = [order('T1', { fulfillmentStatus: 'PROCESSING' })];
  env.run();
  env.advance(1);
  env.update('T1', { trackingNumber: '1Z999' });
  env.run();
  assert.match(env.sent[0].body, /Tracking number: 1Z999/);
});

test('respects Ecwid per-order notification opt-outs and hidden orders', () => {
  const env = runtime();
  env.state.orders = [order('Q1', { disableAllCustomerNotifications: true }), order('H1', { hidden: true }), order('N1', { email: '' })];
  env.run();
  env.advance(1);
  for (const id of ['Q1', 'H1', 'N1']) env.update(id, { fulfillmentStatus: 'DELIVERED' });
  env.run();
  assert.equal(env.sent.length, 0);
});

test('a failed send is retried on the next run instead of being lost', () => {
  const env = runtime();
  env.state.orders = [order('F1')];
  env.run();
  const checkpoint = env.properties.get('STATUS_CHECKED_AT');
  env.advance(1);
  env.update('F1', { fulfillmentStatus: 'SHIPPED' });
  env.state.failSend = true;
  env.run();
  assert.equal(env.properties.get('STATUS_CHECKED_AT'), checkpoint);
  env.state.failSend = false;
  env.advance(1);
  env.run();
  assert.equal(env.sent.length, 1);
  assert.match(env.sent[0].subject, /on its way/);
});

test('looks back five minutes before the last check', () => {
  const env = runtime();
  env.run();
  env.advance(3);
  env.run();
  const from = Number(new URL(env.requests.at(-1)).searchParams.get('updatedFrom'));
  assert.equal(from, START / 1000 - 300);
});

test('old saved states are pruned once a day', () => {
  const env = runtime();
  env.properties.set('os_STALE', JSON.stringify({ p: 'PAID', f: 'DELIVERED', r: 0, t: '', at: START / 1000 - 46 * 86400 }));
  env.properties.set('os_FRESH', JSON.stringify({ p: 'PAID', f: 'DELIVERED', r: 0, t: '', at: START / 1000 - 86400 }));
  env.run();
  assert.equal(env.properties.has('os_STALE'), false);
  assert.equal(env.properties.has('os_FRESH'), true);
});

test('the minute trigger runs dispatch, receipts, status updates, then hunt email retries', () => {
  assert.match(script, /for \(const job of \[sendCfaDispatch, sendPendingReceipts, sendOrderStatusUpdates, requestHuntJobs_\]\)/);
});

test('status emails escape customer text', () => {
  const env = runtime();
  const { html } = env.context.buildStatusEmail(order('X1', { billingPerson: { firstName: '<b>Pat</b>' } }), 'DELIVERED');
  assert.match(html, /&lt;b&gt;Pat&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>Pat<\/b>/);
});

test('unpaid orders get an order-received confirmation instead of a receipt', () => {
  const env = runtime();
  const mail = env.context.buildReceiptEmail(order('U1', { paymentStatus: 'AWAITING_PAYMENT', paymentMethod: 'Custom Payment Method Name' }));
  assert.match(mail.subject, /^Order received · Payment pending · #U1$/);
  assert.match(mail.text, /Payment: Awaiting payment · Custom Payment Method Name/);
  assert.doesNotMatch(mail.text, /tax invoice/);
});

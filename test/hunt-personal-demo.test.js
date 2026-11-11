'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createDemoStore, KEY } = require('../easter-hunt/demo-store');
const baseConfig = require('../easter-hunt/config');
function make({ all = false } = {}) {
  const values = new Map();
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const options = { storage, crypto: crypto.webcrypto, config: { ...baseConfig, DEV_ALL_EGGS_ENABLED: all }, now: () => Date.parse('2026-11-10T12:00:00-06:00') };
  return { store: createDemoStore(options), options, values };
}
const input = (i = 0, extra = {}) => ({ studentId: 's' + (151579 + i), eggId: baseConfig.locations[i].id, idempotencyKey: crypto.randomUUID(), ...extra });
test('personal claims persist in provided browser storage; site results contain no code or preview reference', () => {
  const { store, options } = make(); const value = input(); const result = store.claim(value);
  assert.equal(result.couponStatus, 'not_created'); assert.equal(result.emailStatus, 'simulated');
  assert.equal(result.email, 's151579@student.roundrockisd.org');
  assert.equal('code' in result, false); assert.equal('reference' in result, false);
  const reopened = createDemoStore(options); assert.equal(reopened.snapshot().records[0].studentId, 's151579');
  assert.match(reopened.snapshot().records[0].reference, /^PREVIEW-[A-F0-9]{12}$/);
  assert.deepEqual(reopened.claim(value), result);
});
test('default personal demo exposes only Inventory Intelligence and enforces normalized student/egg uniqueness', () => {
  const { store } = make(); assert.equal(store.availability().eggs.filter(e => e.available).length, 1);
  assert.throws(() => store.claim(input(1)), /unavailable/);
  store.claim(input(0, { studentId: ' S151579 ' }));
  assert.throws(() => store.claim(input()), /unavailable/);
  assert.throws(() => store.claim(input(0, { studentId: '151579' })), /including the s/);
  assert.equal(store.snapshot().records.length, 1);
});
test('personal demo allocates the full prize pool once and reset frees the testing sticker', () => {
  const { store } = make({ all: true });
  for (let i = 0; i < 12; i++) store.claim(input(i));
  assert.deepEqual(store.snapshot().records.map(r => r.percentage).sort((a,b) => a-b), [10,10,10,10,15,15,15,20,20,25,25,35]);
  assert.equal(store.availability().status, 'sold_out');
  store.reset(); assert.equal(store.snapshot().records.length, 0); assert.equal(store.availability().remaining, 12);
});
test('private records are isolated between storage profiles and invalid data is not silently discarded', () => {
  const a = make(), b = make(); a.store.claim(input()); assert.equal(b.store.snapshot().records.length, 0);
  a.values.set(KEY, '{bad'); assert.throws(() => a.store.snapshot(), /saved demo/); assert.equal(a.values.get(KEY), '{bad');
  a.store.reset(); assert.equal(a.store.snapshot().records.length, 0);
});
test('dashboard mirrors restore only an uninitialized store and never overwrite existing claims', () => {
  const a = make(), b = make(); a.store.claim(input()); const snapshot = a.store.snapshot();
  b.store.restoreIfEmpty(snapshot); assert.deepEqual(b.store.snapshot(), snapshot);
  b.store.reset(); b.store.restoreIfEmpty(snapshot); assert.equal(b.store.snapshot().records.length, 0);
});
test('personal demo still expires at the configured deadline and never creates a live coupon', () => {
  const { options } = make(); const expired = createDemoStore({ ...options, now: () => Date.parse(baseConfig.expiresAt) });
  assert.equal(expired.availability().status, 'expired'); assert.throws(() => expired.claim(input()));
  assert.equal(expired.snapshot().records.length, 0);
});
test('public hosted email templates contain no student data and live issuance remains closed', () => {
  const handler = require('../api/v1/easter-hunt');
  const res = { setHeader() {}, end(text) { this.body = JSON.parse(text); } };
  handler({ method: 'GET', url: '/api/v1/easter-hunt?view=email-template&percentage=25' }, res);
  assert.equal(res.statusCode, 200); assert.match(res.body.html, /25% OFF/); assert.doesNotMatch(res.body.html, /s151579/);
  handler({ method: 'POST', url: '/api/v1/easter-hunt', body: input() }, res); assert.equal(res.statusCode, 503);
});

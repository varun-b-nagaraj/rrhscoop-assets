'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../apps-script/teacher-preorder-verification.gs'), 'utf8');
const config = require('../easter-hunt/config');

function runtime({ now = '2026-11-11T12:00:00-06:00' } = {}) {
  const values = new Map([['RRHS_ECWID_STORE_ID', '123'], ['RRHS_ECWID_API_TOKEN', 'token']]);
  const coupons = [], sent = [], state = { now: Date.parse(now), mailFails: false, ecwidStatus: 200, random: 0 };
  const props = { getProperty: key => values.get(key), setProperty: (key, value) => values.set(key, String(value)), deleteProperty: key => values.delete(key), getProperties: () => Object.fromEntries(values) };
  const context = {
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [state.now])); } static now() { return state.now; } },
    Math: Object.assign(Object.create(Math), { random: () => state.random }),
    console: { error() {} }, Logger: { log() {} },
    Utilities: { formatDate: () => '2026-11-11 12:00:00 -0600', getUuid: () => require('node:crypto').randomUUID(), computeDigest: () => Array.from({ length: 32 }, (_, i) => i * 7), DigestAlgorithm: {} },
    PropertiesService: { getScriptProperties: () => props },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    UrlFetchApp: { fetch(url, options) {
      coupons.push({ url, options, body: JSON.parse(options.payload) });
      return { getResponseCode: () => state.ecwidStatus, getContentText: () => JSON.stringify(state.ecwidStatus === 200 ? { id: 900 + coupons.length } : { errorMessage: 'nope' }) };
    } },
    GmailApp: { sendEmail(...message) { if (state.mailFails) throw new Error('Gmail down'); sent.push(message); } },
  };
  vm.runInNewContext(source, context);
  let n = 0;
  const claim = (studentId, eggId, key) => context.huntClaim_({ studentId, eggId, idempotencyKey: key || `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` }, props);
  return { context, props, values, coupons, sent, state, claim };
}

test('Apps Script hunt settings match the website config', () => {
  const { context } = runtime();
  assert.equal(context.HUNT_STARTS_AT, config.startsAt);
  assert.equal(context.HUNT_EXPIRES_AT, config.expiresAt);
  assert.equal(Date.parse(context.HUNT_ECWID_EXPIRES.replace(' ', 'T').replace(' -0600', '-06:00')), Date.parse(config.expiresAt));
  assert.deepEqual([...context.HUNT_EGGS], config.locations.map(location => location.id));
  // The deeper the page, the bigger the reward: 7×10%, 6×15%, 4×20%, 2×25%, 1×35%.
  const counts = {}; Object.values(context.HUNT_REWARDS).forEach(p => { counts[p] = (counts[p] || 0) + 1; });
  assert.deepEqual({ ...counts }, { 10: 7, 15: 6, 20: 4, 25: 2, 35: 1 });
  assert.equal(context.HUNT_REWARDS['inventory-intelligence'], 20);
  assert.equal(context.HUNT_REWARDS['privacy-policy'], 35);
  for (const id of ['shop-snacks', 'shop-drinks', 'shop-long-sleeves', 'shop-t-shirts']) assert.equal(context.HUNT_REWARDS[id], 10);
});

test('a claim creates one single-use Ecwid coupon and emails the code only to the school mailbox', () => {
  const { claim, coupons, sent, context, props } = runtime();
  const result = claim('S151579', 'shop-drinks');
  assert.equal(result.ok, true);
  assert.equal(result.mode, 'live');
  assert.equal(result.percentage, 10, 'Drinks is a product page, worth 10%');
  assert.equal(result.email, 's151579@student.roundrockisd.org');
  assert.equal(result.emailStatus, 'sent');
  assert.equal(JSON.stringify(result).includes('RRHSHUNT-'), false, 'the browser never receives the code');
  assert.equal(coupons.length, 1);
  assert.match(coupons[0].url, /\/123\/discount_coupons$/);
  assert.equal(coupons[0].options.headers.Authorization, 'Bearer token');
  const body = coupons[0].body;
  assert.equal(body.discountType, 'PERCENT'); assert.equal(body.discount, 10); assert.equal(body.usesLimit, 'SINGLE'); assert.equal(body.status, 'ACTIVE');
  assert.equal(body.expirationDate, '2026-11-14 00:00:00 -0600');
  assert.match(body.code, /^RRHSHUNT-[A-Z2-9]{10}$/);
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0], 's151579@student.roundrockisd.org');
  assert.doesNotMatch(sent[0][1], /Preview/);
  assert.match(sent[0][2], new RegExp(body.code));
  assert.doesNotMatch(sent[0][2], /first \$25|DEVELOPMENT PREVIEW/);
  const availability = context.huntAvailability_(props);
  assert.equal(availability.remaining, 19);
  assert.equal(availability.eggs.find(egg => egg.id === 'shop-drinks').available, false);
  assert.equal(availability.eggs.filter(egg => egg.available).length, 19);
  // Found stickers stay on the page, disabled under a magnifying glass, for everyone.
  assert.equal(availability.eggs.filter(egg => egg.found).map(egg => egg.id).join(), 'shop-drinks');
});

test('one reward per student and per sticker, with the same message for both', () => {
  const { claim, coupons } = runtime();
  claim('s100001', 'shop-snacks');
  const again = claim('s100001', 'shop-t-shirts');
  const taken = claim('s100002', 'shop-snacks');
  assert.equal(again.status, 409); assert.equal(taken.status, 409);
  assert.equal(again.error, taken.error);
  assert.equal(coupons.length, 1);
});

test('retrying the same request returns the original reward without a second coupon', () => {
  const { claim, coupons, sent } = runtime();
  const key = '11111111-1111-4111-8111-111111111111';
  const first = claim('s100003', 'shop-snacks', key), repeat = claim('s100003', 'shop-snacks', key);
  assert.deepEqual({ ...repeat }, { ...first });
  assert.equal(coupons.length, 1); assert.equal(sent.length, 1);
});

test('each sticker pays its own fixed reward, and the hunt sells out after all twenty', () => {
  const { claim, context, props, state } = runtime();
  config.locations.forEach((location, i) => {
    state.now += 2000;
    assert.equal(claim('s2000' + String(i).padStart(2, '0'), location.id).percentage, context.HUNT_REWARDS[location.id]);
  });
  const availability = context.huntAvailability_(props);
  assert.equal(availability.status, 'sold_out'); assert.equal(availability.remaining, 0);
  assert.match(claim('s299999', 'shop-snacks').error, /All twenty rewards/);
});

test('a failed coupon leaves the sticker available and nothing recorded', () => {
  const { claim, state, sent, context, props } = runtime();
  state.ecwidStatus = 403;
  const result = claim('s100004', 'shop-snacks');
  assert.equal(result.status, 503); assert.equal(sent.length, 0);
  assert.equal(context.huntAvailability_(props).remaining, 20);
  state.ecwidStatus = 200;
  assert.equal(claim('s100004', 'shop-snacks').ok, true);
});

test('a failed email keeps the reward and the minute job retries it', () => {
  const { claim, state, sent, context, values } = runtime();
  state.mailFails = true;
  const result = claim('s100005', 'shop-snacks');
  assert.equal(result.ok, true); assert.equal(result.emailStatus, 'pending');
  assert.equal(claim('s100005', 'shop-t-shirts').status, 409, 'a mail failure never allows a second reward');
  state.mailFails = false;
  context.retryHuntEmails();
  assert.equal(sent.length, 1); assert.equal(sent[0][0], 's100005@student.roundrockisd.org');
  context.retryHuntEmails();
  assert.equal(sent.length, 1);
  assert.equal(JSON.parse(values.get('hunt_live_state')).claims[0].emailStatus, 'sent');
});

test('claims are refused before the start, after the deadline, and while paused', () => {
  assert.match(runtime({ now: '2026-11-14T00:00:00-06:00' }).claim('s100006', 'shop-snacks').error, /hunt has ended/);
  assert.equal(runtime({ now: '2026-11-08T23:59:00-06:00' }).claim('s100006', 'shop-snacks').status, 409);
  const env = runtime(); env.context.pauseHunt();
  assert.equal(env.claim('s100006', 'shop-snacks').status, 409);
  assert.equal(env.context.huntAvailability_(env.props).status, 'paused');
  env.context.resumeHunt();
  assert.equal(env.claim('s100006', 'shop-snacks').ok, true);
});

test('bad input and bursts are rejected', () => {
  const env = runtime();
  assert.equal(env.claim('151579', 'shop-snacks').status, 400);
  assert.equal(env.claim('s151579', 'not-a-sticker').status, 400);
  for (let i = 0; i < 30; i++) env.claim('s3000' + String(i).padStart(2, '0'), 'nowhere');
  // Invalid requests are rejected before counting; valid ones count toward 30 a minute.
  const burst = runtime();
  for (let i = 0; i < 30; i++) burst.claim('s100007', 'shop-snacks');
  assert.equal(burst.claim('s100008', 'shop-t-shirts').status, 429);
});

test('doPost answers availability without the lock and claims through it', () => {
  const env = runtime();
  let locked = 0;
  env.context.LockService = { getScriptLock: () => ({ tryLock: () => { locked++; return true; }, releaseLock() {} }) };
  env.context.ContentService = { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }) };
  const post = body => env.context.doPost({ postData: { contents: JSON.stringify(body) } });
  assert.equal(post({ action: 'hunt-availability' }).remaining, 20);
  assert.equal(locked, 0);
  assert.equal(post({ action: 'hunt-claim', studentId: 's100009', eggId: 'shop-snacks', idempotencyKey: '22222222-2222-4222-8222-222222222222' }).ok, true);
  assert.equal(locked, 1);
});

test('the API forwards live claims and caches availability at the edge', async () => {
  const before = process.env.RRHS_HUNT_ENABLED; process.env.RRHS_HUNT_ENABLED = 'true';
  const service = require('../teacher-preorders/service'), original = service.mailAction;
  const handler = require('../api/v1/easter-hunt');
  const res = () => ({ headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(value) { this.body = JSON.parse(value); } });
  const calls = [];
  try {
    service.mailAction = async (action, payload) => { calls.push([action, payload]); return action === 'hunt-claim'
      ? { ok: true, mode: 'live', percentage: 25, email: 's151579@student.roundrockisd.org', emailStatus: 'sent', code: 'SHOULD-NOT-LEAK' }
      : { ok: true, mode: 'live', status: 'active', remaining: 9, eggs: [{ id: 'shop-snacks', available: true }] }; };
    const claimed = res();
    await handler({ method: 'POST', headers: {}, body: { action: 'claim', studentId: 's151579', eggId: 'shop-snacks', idempotencyKey: '33333333-3333-4333-8333-333333333333' } }, claimed);
    assert.equal(claimed.statusCode, 200); assert.equal(claimed.body.percentage, 25);
    assert.equal('code' in claimed.body, false);
    assert.deepEqual(calls[0], ['hunt-claim', { studentId: 's151579', eggId: 'shop-snacks', idempotencyKey: '33333333-3333-4333-8333-333333333333' }]);
    const open = res();
    await handler({ method: 'GET', headers: {}, url: '/api/v1/easter-hunt' }, open);
    assert.equal(open.body.mode, 'live'); assert.equal(open.body.remaining, 9);
    assert.match(open.headers['Cache-Control'], /s-maxage=10/);
    service.mailAction = async () => { throw Object.assign(new Error(service.HUNT_TAKEN || 'This package could not be claimed.'), { status: 409 }); };
    const taken = res();
    await handler({ method: 'POST', headers: {}, body: { action: 'claim', studentId: 's1', eggId: 'shop-snacks', idempotencyKey: 'x' } }, taken);
    assert.equal(taken.statusCode, 409); assert.match(taken.body.error, /could not be claimed/);
    service.mailAction = async () => { throw Object.assign(new Error('Unknown action.'), { status: 400 }); };
    const outdated = res();
    await handler({ method: 'POST', headers: {}, body: { action: 'claim', studentId: 's1', eggId: 'shop-snacks', idempotencyKey: 'x' } }, outdated);
    assert.equal(outdated.statusCode, 503);
    const down = res();
    await handler({ method: 'GET', headers: {}, url: '/api/v1/easter-hunt' }, down);
    assert.equal(down.body.status, 'unavailable'); assert.equal(down.headers['Cache-Control'], 'no-store');
  } finally { service.mailAction = original; if (before === undefined) delete process.env.RRHS_HUNT_ENABLED; else process.env.RRHS_HUNT_ENABLED = before; }
});

test('RRHS_HUNT_ENABLED is the only switch: anything but "true" closes the hunt', async () => {
  const service = require('../teacher-preorders/service'), original = service.mailAction;
  const handler = require('../api/v1/easter-hunt');
  const res = () => ({ headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(value) { this.body = JSON.parse(value); } });
  const before = process.env.RRHS_HUNT_ENABLED; let calls = 0;
  service.mailAction = async () => { calls++; return { ok: true, mode: 'live', status: 'active', remaining: 12, eggs: [] }; };
  try {
    for (const value of [undefined, '', 'false', '1', 'yes']) {
      if (value === undefined) delete process.env.RRHS_HUNT_ENABLED; else process.env.RRHS_HUNT_ENABLED = value;
      const get = res(); await handler({ method: 'GET', headers: {}, url: '/api/v1/easter-hunt' }, get);
      assert.equal(get.body.mode, 'disabled');
      const post = res(); await handler({ method: 'POST', headers: {}, body: { action: 'claim', studentId: 's1', eggId: 'shop-snacks', idempotencyKey: 'x' } }, post);
      assert.equal(post.statusCode, 503);
    }
    assert.equal(calls, 0);
    process.env.RRHS_HUNT_ENABLED = ' TRUE ';
    const on = res(); await handler({ method: 'GET', headers: {}, url: '/api/v1/easter-hunt' }, on);
    assert.equal(on.body.mode, 'live'); assert.equal(calls, 1);
  } finally { service.mailAction = original; if (before === undefined) delete process.env.RRHS_HUNT_ENABLED; else process.env.RRHS_HUNT_ENABLED = before; }
});

test('dashboard sign-in: emailed code for approved addresses only, then a session that reads the log and pauses', () => {
  const env = runtime(), mails = [];
  env.context.MailApp = { sendEmail: message => mails.push(message) };
  env.context.Utilities.computeHmacSha256Signature = (text, key) => [...require('node:crypto').createHmac('sha256', key).update(text).digest()];
  env.context.Utilities.base64EncodeWebSafe = bytes => Buffer.from(bytes).toString('base64url');
  const admin = input => env.context.huntAdmin_(input, env.props);
  assert.equal(admin({ action: 'hunt-admin-code', email: 'someone@roundrockisd.org' }).status, 401);
  assert.equal(mails.length, 0);
  assert.equal(admin({ action: 'hunt-admin-code', email: 'RRHS_COOP_STORE@roundrockisd.org' }).ok, true);
  assert.equal(mails[0].to, 'rrhs_coop_store@roundrockisd.org');
  const code = mails[0].subject.match(/^(\d{6}) /)[1];
  assert.equal(admin({ action: 'hunt-admin-code', email: 'rrhs_coop_store@roundrockisd.org' }).status, 429);
  assert.equal(admin({ action: 'hunt-admin-verify', email: 'rrhs_coop_store@roundrockisd.org', code: code === '000000' ? '111111' : '000000' }).status, 401);
  const signedIn = admin({ action: 'hunt-admin-verify', email: 'rrhs_coop_store@roundrockisd.org', code });
  assert.equal(signedIn.ok, true, JSON.stringify(signedIn)); assert.ok(signedIn.token.length >= 40);
  assert.equal(admin({ action: 'hunt-admin-verify', email: 'rrhs_coop_store@roundrockisd.org', code }).status, 401, 'a code works once');
  assert.equal(admin({ action: 'hunt-admin-log', token: 'forged-token-forged-token-forged-token-forged' }).status, 401);
  env.claim('s151579', 'shop-snacks');
  const log = admin({ action: 'hunt-admin-log', token: signedIn.token });
  assert.equal(log.claims.length, 1); assert.match(log.claims[0].code, /^RRHSHUNT-/); assert.equal(log.remaining, 19); assert.equal(log.pool.length, 19);
  assert.equal(admin({ action: 'hunt-admin-pause', token: signedIn.token }).paused, true);
  assert.equal(env.claim('s151580', 'shop-t-shirts').status, 409);
  assert.equal(admin({ action: 'hunt-admin-resume', token: signedIn.token }).status, 'active');
  env.state.now += 13 * 3600000;
  assert.equal(admin({ action: 'hunt-admin-log', token: signedIn.token }).status, 401, 'sessions expire after 12 hours');
});

test('dashboard actions are only accepted from the dashboard origin', async () => {
  const handler = require('../api/v1/easter-hunt');
  const res = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(value) { this.body = JSON.parse(value); } };
  await handler({ method: 'POST', headers: { origin: 'https://rrhscoop.roundrockisd.org' }, body: { action: 'admin-log', token: 'x' } }, res);
  assert.equal(res.statusCode, 403);
});

test('a new promo deletes the hunt coupons, clears every claim and empties the log', () => {
  const env = runtime(), deletes = [];
  const fetch = env.context.UrlFetchApp.fetch;
  env.context.UrlFetchApp.fetch = (url, options) => options.method === 'delete' ? (deletes.push(url), { getResponseCode: () => 200 }) : fetch(url, options);
  let rows = 5;
  env.values.set('HUNT_LOG_SHEET_ID', 'sheet');
  env.context.SpreadsheetApp = { openById: () => ({ getSheets: () => [{ getLastRow: () => rows, deleteRows: (start, count) => { rows -= count; }, appendRow: () => { rows++; } }] }) };
  env.claim('s100010', 'shop-snacks'); env.claim('s100011', 'privacy-policy');
  env.context.resetHuntForNewPromo();
  assert.equal(deletes.length, 2);
  assert.match(deletes[0], /\/discount_coupons\/90\d$/);
  assert.equal(env.values.has('hunt_live_state'), false);
  assert.equal(env.context.huntAvailability_(env.props).remaining, 20);
  assert.equal(rows, 2, 'header plus the "new promo started" row');
  assert.equal(env.claim('s100010', 'shop-snacks').ok, true, 'students can claim again in the new promo');
});

test('staff claim with their @roundrockisd.org email and get the code there, one reward each', () => {
  const env = runtime();
  const result = env.claim(' Jane.Doe@RoundRockISD.org ', 'teachers-top');
  assert.equal(result.ok, true);
  assert.equal(result.email, 'jane.doe@roundrockisd.org');
  assert.equal(result.percentage, 15);
  assert.equal(env.sent[0][0], 'jane.doe@roundrockisd.org');
  assert.match(env.sent[0][2], /RRHSHUNT-/);
  assert.match(env.coupons[0].body.name, /jane\.doe@roundrockisd\.org/);
  assert.equal(env.claim('jane.doe@roundrockisd.org', 'leadership').status, 409, 'one reward per staff email');
  for (const bad of ['jane@gmail.com', 'jane@student.roundrockisd.org', 'jane@roundrockisd.org.evil.com', '@roundrockisd.org']) {
    assert.equal(env.claim(bad, 'faq').status, 400, bad);
  }
  assert.equal(env.sent.length, 1);
});

test('the dashboard screenshot route needs a valid session and returns the circled image', async () => {
  const service = require('../teacher-preorders/service'), original = service.mailAction;
  const handler = require('../api/v1/easter-hunt');
  const res = () => ({ headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(value) { this.body = JSON.parse(value); } });
  const origin = 'https://rrhscoop-assets.vercel.app';
  try {
    service.mailAction = async (action) => { assert.equal(action, 'hunt-admin-check'); throw Object.assign(new Error('Sign in again to view the dashboard.'), { status: 401 }); };
    const denied = res(); await handler({ method: 'POST', headers: { origin }, body: { action: 'admin-location', id: 'faq', token: 'x' } }, denied);
    assert.equal(denied.statusCode, 401); assert.equal('image' in denied.body, false);
    service.mailAction = async () => ({ ok: true, email: 'rrhs_coop_store@roundrockisd.org' });
    const missing = res(); await handler({ method: 'POST', headers: { origin }, body: { action: 'admin-location', id: '../../.env', token: 'x' } }, missing);
    assert.equal(missing.statusCode, 404);
    for (const spot of config.locations) {
      const shown = res(); await handler({ method: 'POST', headers: { origin }, body: { action: 'admin-location', id: spot.id, token: 'x' } }, shown);
      assert.equal(shown.statusCode, 200, spot.id); assert.match(shown.body.image, /^data:image\/jpeg;base64,\/9j\//);
    }
  } finally { service.mailAction = original; }
});

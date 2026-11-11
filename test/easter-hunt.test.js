'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { createPreview, discountCents, normalizeStudent, DISTRIBUTION } = require('../easter-hunt/service');
const { lookupStudent } = require('../easter-hunt/directory');
const config = require('../easter-hunt/config');
const { createServer } = require('../tools/easter-hunt-preview.cjs');
const renderEmail = require('../easter-hunt/email-preview');
const START = Date.parse('2026-11-10T12:00:00-06:00');
const make = options => createPreview({ now: () => START, ...options });
const claim = (i = 0, changes = {}) => ({ studentId: `s${100000 + i}`, eggId: config.locations[i % 12].id, idempotencyKey: crypto.randomUUID(), ...changes });

test('discount applies only to the first $25 of eligible merchandise', () => {
  for (const [percent, cents, expected] of [[35,1000,350],[35,2500,875],[35,4000,875],[10,5000,250],[10,0,0],[15,101,15]]) {
    assert.equal(discountCents(percent, cents), expected);
  }
  for (const cents of [-1, NaN, Infinity, 1.5, '2500']) assert.throws(() => discountCents(35, cents));
  assert.throws(() => discountCents(100, 2500));
});
test('requires the s, normalizes once, and does not accept an email recipient', () => {
  assert.equal(normalizeStudent(' S151579 '), 's151579');
  for (const value of ['151579', 's123', 's12345678901', 's12345@example.com', null, {}, ['s12345']]) assert.throws(() => normalizeStudent(value), { status: 400 });
});
test('12 distinct location identifiers and no client prize mapping', () => {
  assert.equal(config.locations.length, 12);
  assert.equal(new Set(config.locations.map(e => e.id)).size, 12);
  assert.equal(typeof config.HUNT_ENABLED, 'boolean');
  assert.equal(config.DEV_ALL_EGGS_ENABLED, false);
  assert.equal(JSON.stringify(config).includes('percentage'), false);
});
test('server draws from remaining prize pool, never from an egg mapping', () => {
  const a = make({ randomInt: n => n - 1 }), b = make({ randomInt: () => 0 });
  assert.equal(a.claim(claim()).percentage, 35);
  assert.equal(b.claim(claim()).percentage, 10);
  const percentages = [];
  for (let i = 1; i < 12; i++) percentages.push(a.claim(claim(i)).percentage);
  assert.deepEqual([35, ...percentages].sort((x,y) => x-y), [...DISTRIBUTION].sort((x,y) => x-y));
  assert.equal(a.availability().status, 'sold_out');
  assert.ok(a.availability().eggs.every(e => !e.available));
  assert.equal(a.stats().maximumSimulatedLiabilityCents, 5250);
});
test('single-package preview disables the other eleven on the server, including after reset', () => {
  const service = make({ singleEggOnly: true });
  assert.deepEqual(service.availability().eggs.filter(egg => egg.available).map(egg => egg.id), ['inventory-intelligence']);
  assert.throws(() => service.claim(claim(1)), { status: 409 });
  service.admin({ action: 'reset' });
  assert.equal(service.availability().eggs.filter(egg => egg.available).length, 1);
  assert.ok(service.claim(claim()));
});
test('one normalized student and one egg per claim, with idempotent retries', () => {
  const service = make(), input = claim();
  const result = service.claim(input);
  assert.deepEqual(service.claim(input), result);
  assert.throws(() => service.claim({ ...claim(1), studentId: ' S100000 ' }), { status: 409 });
  assert.throws(() => service.claim(claim(1, { eggId: input.eggId })), { status: 409 });
  assert.throws(() => service.claim({ ...input, studentId: 's55555' }), { status: 409 });
  assert.throws(() => service.claim({ ...input, eggId: config.locations[1].id }), { status: 409 });
  assert.equal(service.stats().claims, 1);
  assert.equal(result.couponStatus, 'not_created');
  assert.equal(result.emailStatus, 'simulated');
  assert.equal('code' in result, false);
  assert.equal(JSON.stringify(service.stats()).includes('s100000'), false);
});
test('concurrent local requests cannot allocate an egg or prize twice', async () => {
  const service = make();
  const results = await Promise.allSettled(Array.from({length:50}, (_,i) => Promise.resolve().then(() => service.claim(claim(i, { eggId: config.locations[0].id }), 'client-' + i))));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(service.stats().remaining, 11);
  const other = make();
  const all = await Promise.allSettled(Array.from({length:24}, (_,i) => Promise.resolve().then(() => other.claim(claim(i), 'client-' + i))));
  assert.equal(all.filter(r => r.status === 'fulfilled').length, 12);
  assert.equal(other.stats().remaining, 0);
});
test('scheduled, paused, disabled and expired claims consume no inventory', () => {
  let now = Date.parse('2026-11-08T12:00:00-06:00');
  const service = createPreview({ now: () => now });
  assert.equal(service.availability().status, 'scheduled');
  assert.throws(() => service.claim(claim()), { status: 409 });
  now = START;
  service.admin({action:'pause'});
  assert.throws(() => service.claim(claim()), { status: 409 });
  service.admin({action:'resume'});
  service.admin({action:'disable', eggId:config.locations[0].id});
  assert.throws(() => service.claim(claim()), { status: 409 });
  service.admin({action:'enable', eggId:config.locations[0].id});
  now = Date.parse('2026-11-13T23:59:59.999-06:00');
  assert.equal(service.availability().status, 'active');
  now++;
  assert.equal(service.availability().status, 'expired');
  assert.throws(() => service.claim(claim()), { status: 409 });
  assert.equal(service.stats().remaining, 12);
});
test('global preview availability changes after claim and email retries never redraw', () => {
  const service = make(); const input = claim(), result = service.claim(input);
  assert.equal(service.availability().eggs[0].available, false);
  service.admin({action:'fail-email',claimId:result.claimId});
  assert.equal(service.stats().failedEmails, 1);
  service.admin({action:'retry-email',claimId:result.claimId});
  service.admin({action:'retry-email',claimId:result.claimId});
  assert.equal(service.stats().failedEmails, 0);
  assert.equal(service.stats().claims, 1);
  assert.equal(service.stats().couponsIssued, 0);
  assert.equal(service.stats().emailsSent, 0);
  assert.equal(service.claim(input).percentage, result.percentage);
});
test('rate limits invalid and repeated attempts without keeping raw student IDs', () => {
  let now = START; const service = createPreview({now: () => now});
  for (let i=0; i<15; i++) assert.throws(() => service.claim(claim(0, { studentId:'123' })), { status:400 });
  assert.throws(() => service.claim(claim()), { status:429 });
  now += 60000;
  assert.ok(service.claim(claim()));
});
test('directory request uses the existing HMAC protocol and only accepts confirmed exact addresses', async () => {
  const env = { STUDENT_DIRECTORY_URL:'https://script.google.com/macros/s/test/exec', STUDENT_DIRECTORY_SECRET:'a'.repeat(32) };
  let request;
  const options = {env, now:() => START, fetcher:async (url, init) => {
    request = JSON.parse(init.body);
    return {ok:true,json:async () => ({status:'found',email:'s151579@student.roundrockisd.org',name:'Test Dragon'})};
  }};
  assert.deepEqual(await lookupStudent('S151579', options), {studentId:'s151579',email:'s151579@student.roundrockisd.org',name:'Test Dragon'});
  assert.equal(request.signature, crypto.createHmac('sha256',env.STUDENT_DIRECTORY_SECRET).update('s151579:' + START).digest('base64url'));
  await assert.rejects(lookupStudent('s151579', {...options, fetcher:async () => ({ok:true,json:async () => ({status:'found',email:'attacker@example.com',name:'Dragon'})})}));
  assert.equal(await lookupStudent('s151579', {...options, fetcher:async () => ({ok:true,json:async () => ({status:'not_found'})})}), null);
  await assert.rejects(lookupStudent('s151579', {env:{}}));
});
test('reward emails reuse the shared wrapper, escape names, and include plain text', () => {
  const email = renderEmail(35);
  assert.ok(email.subject.startsWith('[Preview]'));
  assert.match(email.html, /35% OFF/);
  assert.match(email.html, /next eligible CO-OP online order/);
  assert.doesNotMatch(email.html, /first \$25/);
  assert.match(email.html, /November 13, 2026/);
  assert.match(email.text, /No coupon was created/);
  const context = {}; runInNewContext(readFileSync(require.resolve('../apps-script/teacher-preorder-verification.gs'),'utf8'),context);
  const actual = context.buildEasterEggRewardEmail({percentage:10, name:'<img onerror="alert(1)">',code:'TEST-COUPON-123456'});
  assert.match(actual.html, /&lt;img/); assert.doesNotMatch(actual.html, /<img onerror/);
  assert.match(actual.text, /TEST-COUPON-123456/);
  assert.throws(() => context.buildEasterEggRewardEmail({percentage:35}));
});
test('deployed API never returns a coupon code and fails closed without the Apps Script', async () => {
  const handler = require('../api/v1/easter-hunt');
  const url = process.env.RRHS_CFA_VERIFICATION_URL; delete process.env.RRHS_CFA_VERIFICATION_URL;
  try {
    for (const method of ['GET','POST']) {
      const res = {setHeader(){},end(text){this.body=JSON.parse(text);}};
      await handler({method,headers:{},url:'/api/v1/easter-hunt',body:{action:'claim',...claim()}},res);
      assert.equal(res.statusCode, method === 'GET' ? 200 : 503);
      assert.equal('code' in res.body, false);
      if (method === 'GET') assert.deepEqual(res.body.eggs, []);
    }
  } finally { if (url !== undefined) process.env.RRHS_CFA_VERIFICATION_URL = url; }
});
test('preview management is loopback-only, same-origin, and never exposes server files', async t => {
  const server = createServer({preview:make()}); await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  assert.equal((await fetch(base + '/api/v1/easter-hunt/admin')).status,200);
  assert.equal((await fetch(base + '/api/v1/easter-hunt/admin',{headers:{Origin:'https://attacker.example'}})).status,403);
  const badHostStatus = await new Promise(resolve => {
    require('node:http').get(base + '/api/v1/easter-hunt/admin', { headers: { Host:'attacker.example' } }, response => { response.resume(); resolve(response.statusCode); });
  });
  assert.equal(badHostStatus,403);
  for (const file of ['/.env','/.git/config','/easter-hunt/service.js','/apps-script/teacher-preorder-verification.gs','/tools/easter-hunt/../../.env']) {
    assert.equal((await fetch(base + file)).status,404,file);
  }
  assert.equal((await fetch(base + '/api/v1/easter-hunt',{method:'POST',body:'{'})).status,400);
  assert.equal((await fetch(base + '/api/v1/easter-hunt',{method:'POST',body:'x'.repeat(3000)})).status,413);
  const response = await fetch(base + '/api/v1/easter-hunt',{method:'POST',body:JSON.stringify({action:'claim',...claim()})});
  assert.equal(response.status,200);
  assert.equal((await response.json()).couponStatus,'not_created');
  const state = await (await fetch(base + '/api/v1/easter-hunt')).json();
  assert.equal(state.remaining,11);
});

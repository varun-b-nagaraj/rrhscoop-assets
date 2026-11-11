'use strict';
// The live hunt against a real (in-memory) Postgres, with fake Ecwid and fake mail. Nothing leaves this process.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { PGlite } = require('@electric-sql/pglite');
const config = require('../easter-hunt/config');
const { rewards } = require('../easter-hunt/rules');

process.env.RRHS_HUNT_SECRET = 'test-secret-'.repeat(4);
process.env.RRHS_HUNT_PROMO_ID = 'test-promo';
process.env.RRHS_HUNT_STARTS_AT = '2020-01-01T00:00:00Z';
process.env.RRHS_HUNT_EXPIRES_AT = '2099-01-01T00:00:00Z';
const live = require('../easter-hunt/live');
const integrations = require('../easter-hunt/integrations');
const { migrate, reset } = require('../tools/hunt-db.cjs');

async function memory() {
  const pg = new PGlite();
  const db = { query: (text, params) => params ? pg.query(text, params) : pg.exec(text).then(results => results.at(-1) || { rows: [] }),
    connect: async () => ({ query: db.query, release() {} }), end: () => pg.close() };
  return db;
}
function fakes() {
  const coupons = new Map(), mail = [], deleted = [], state = { couponFails: false, mailFails: false };
  let next = 900;
  const services = {
    async findCoupon(code) { return [...coupons.values()].find(c => c.code === code); },
    async ensureCoupon(claim, code, expiresAt, who) {
      if (state.couponFails) throw new Error('Ecwid down');
      const found = await services.findCoupon(code); if (found) return found.id;
      const coupon = { id: String(++next), code, percentage: claim.percentage, who, expiresAt }; coupons.set(coupon.id, coupon); return coupon.id;
    },
    async deleteCoupon(id) { deleted.push(String(id)); return coupons.delete(String(id)); },
    async relay(payload) {
      if (payload.kind === 'legacy-export') return { ok: true, legacy: state.legacy || null };
      if (payload.kind === 'legacy-clear') { state.legacy = null; state.legacyCleared = true; return { ok: true }; }
      if (state.mailFails) throw new Error('Gmail down');
      mail.push(payload); return { ok: true, emailStatus: 'sent' };
    },
  };
  return { services, coupons, mail, deleted, state };
}
async function setup() {
  const db = await memory(); await migrate(db);
  const fake = fakes(); let n = 0;
  const key = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const claim = (studentId, eggId, idempotencyKey = key()) => live.claim({ studentId, eggId, idempotencyKey }, 'client-' + n, db, fake.services);
  return { db, ...fake, claim, key };
}
const refused = (promise, status, pattern) => assert.rejects(promise, error => error.status === status && (!pattern || pattern.test(error.message)));
async function withEnv(values, fn) {
  const before = Object.fromEntries(Object.keys(values).map(k => [k, process.env[k]]));
  for (const [k, v] of Object.entries(values)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  try { return await fn(); } finally { for (const [k, v] of Object.entries(before)) if (v === undefined) delete process.env[k]; else process.env[k] = v; }
}

test('server rewards match the website stickers: 7×10%, 6×15%, 4×20%, 2×25%, 1×35%', () => {
  assert.deepEqual(Object.keys(rewards), config.locations.map(location => location.id));
  const counts = {}; Object.values(rewards).forEach(p => { counts[p] = (counts[p] || 0) + 1; });
  assert.deepEqual(counts, { 10: 7, 15: 6, 20: 4, 25: 2, 35: 1 });
});

test('a claim saves to Neon, creates one single-use coupon and emails the code only to the school inbox', async () => {
  await withEnv({ RRHS_HUNT_ENABLED: 'true' }, async () => {
    const env = await setup();
    const result = await env.claim(' S151579 ', 'privacy-policy');
    assert.equal(result.mode, 'live'); assert.equal(result.percentage, 35);
    assert.equal(result.email, 's151579@student.roundrockisd.org'); assert.equal(result.emailStatus, 'sent');
    assert.doesNotMatch(JSON.stringify(result), /RRHSHUNT/, 'the website never sees the code');
    assert.equal(env.coupons.size, 1);
    const [coupon] = env.coupons.values();
    assert.match(coupon.code, /^RRHSHUNT-[A-F0-9]{16}$/); assert.equal(coupon.percentage, 35); assert.equal(coupon.who, 's151579');
    assert.deepEqual(env.mail.map(m => [m.kind, m.recipient, m.code]), [['reward', 's151579@student.roundrockisd.org', coupon.code]]);
    const a = await live.availability(env.db);
    assert.equal(a.remaining, 19);
    assert.deepEqual(a.eggs.find(e => e.id === 'privacy-policy'), { id: 'privacy-policy', found: true, available: false });
    // Identities and codes are encrypted at rest.
    const row = (await env.db.query('SELECT * FROM hunt.claims', [])).rows[0];
    assert.doesNotMatch(JSON.stringify(row), /s151579|RRHSHUNT/);
  });
});

test('one reward per person and per dragon, with the same message for both', async () => {
  await withEnv({ RRHS_HUNT_ENABLED: 'true' }, async () => {
    const env = await setup();
    await env.claim('s100001', 'shop-snacks');
    await refused(env.claim('s100001', 'shop-drinks'), 409, /could not be claimed/);
    await refused(env.claim('s100002', 'shop-snacks'), 409, /could not be claimed/);
    assert.equal(env.coupons.size, 1);
    const log = (await env.db.query('SELECT event FROM hunt.events ORDER BY id', [])).rows.map(r => r.event);
    assert.ok(log.includes('Refused: already has a reward') && log.includes('Refused: sticker already claimed'));
  });
});

test('repeating the same request returns the original reward without a second coupon', async () => {
  await withEnv({ RRHS_HUNT_ENABLED: 'true' }, async () => {
    const env = await setup(), key = env.key();
    const first = await env.claim('s100003', 'faq', key), again = await env.claim('s100003', 'faq', key);
    assert.deepEqual(again, first);
    assert.equal(env.coupons.size, 1); assert.equal(env.mail.length, 1);
    await refused(env.claim('s100004', 'faq', key), 409);
  });
});

test('each dragon pays its own reward and the hunt sells out after all twenty', async () => {
  await withEnv({ RRHS_HUNT_ENABLED: 'true' }, async () => {
    const env = await setup();
    let i = 0;
    for (const [id, percentage] of Object.entries(rewards)) assert.equal((await env.claim('s2000' + String(++i).padStart(2, '0'), id)).percentage, percentage);
    assert.equal((await live.availability(env.db)).status, 'sold_out');
    await refused(env.claim('s300000', 'faq'), 409);
  });
});

test('a failed coupon or email keeps the reward saved, and the retry job finishes it with the same code', async () => {
  await withEnv({ RRHS_HUNT_ENABLED: 'true' }, async () => {
    const env = await setup();
    env.state.couponFails = true;
    const pending = await env.claim('s100005', 'terms');
    assert.equal(pending.emailStatus, 'pending');
    assert.equal((await live.availability(env.db)).eggs.find(e => e.id === 'terms').found, true, 'the dragon stays claimed');
    env.state.couponFails = false; env.state.mailFails = true;
    await env.db.query('UPDATE hunt.claims SET next_attempt_at=now()', []);
    await live.retry(env.db, env.services);
    assert.equal(env.coupons.size, 1); assert.equal(env.mail.length, 0);
    env.state.mailFails = false;
    await env.db.query('UPDATE hunt.claims SET next_attempt_at=now()', []);
    await live.retry(env.db, env.services);
    const [coupon] = env.coupons.values();
    assert.deepEqual(env.mail.map(m => m.code), [coupon.code]);
    assert.equal((await env.db.query('SELECT email_status FROM hunt.claims', [])).rows[0].email_status, 'sent');
    assert.equal((await live.retry(env.db, env.services)).processed, 0, 'nothing left to do');
  });
});

test('claims are refused when Vercel turns the hunt off, before the start and after the deadline', async () => {
  const env = await setup();
  for (const value of [undefined, '', 'false', '1', 'yes']) await withEnv({ RRHS_HUNT_ENABLED: value }, async () => {
    assert.equal((await live.availability(env.db)).status, 'disabled');
    await refused(env.claim('s100006', 'faq'), 409);
  });
  await withEnv({ RRHS_HUNT_ENABLED: ' TRUE ', RRHS_HUNT_STARTS_AT: '2098-01-01T00:00:00Z' }, async () => {
    assert.equal((await live.availability(env.db)).status, 'scheduled'); await refused(env.claim('s100006', 'faq'), 409);
  });
  await withEnv({ RRHS_HUNT_ENABLED: 'true', RRHS_HUNT_EXPIRES_AT: '2021-01-01T00:00:00Z' }, async () => {
    assert.equal((await live.availability(env.db)).status, 'expired'); await refused(env.claim('s100006', 'faq'), 409, /ended/);
  });
  assert.equal(env.coupons.size, 0);
});

test('bad input and bursts are rejected; staff claim with their district email', async () => {
  await withEnv({ RRHS_HUNT_ENABLED: 'true' }, async () => {
    const env = await setup();
    for (const bad of ['123456', 's12', 'jane@gmail.com', 'jane@student.roundrockisd.org', 'jane@roundrockisd.org.evil.com', '@roundrockisd.org']) await refused(env.claim(bad, 'faq'), 400);
    await refused(env.claim('s100007', 'not-a-dragon'), 400);
    await refused(live.claim({ studentId: 's100007', eggId: 'faq', idempotencyKey: 'x' }, 'c', env.db, env.services), 400);
    const staff = await env.claim(' Jane.Doe@RoundRockISD.org ', 'teachers-top');
    assert.equal(staff.email, 'jane.doe@roundrockisd.org'); assert.equal(env.mail[0].recipient, 'jane.doe@roundrockisd.org');
    for (let i = 0; i < 20; i++) await live.claim({ studentId: 's9', eggId: 'faq', idempotencyKey: 'x' }, 'burst', env.db, env.services).catch(() => {});
    await refused(live.claim({ studentId: 's100008', eggId: 'faq', idempotencyKey: env.key() }, 'burst', env.db, env.services), 429);
  });
});

test('reset deletes this promo’s coupons and the old Apps Script ones, clears claims and the log, and frees every dragon', async () => {
  await withEnv({ RRHS_HUNT_ENABLED: 'true' }, async () => {
    const env = await setup();
    await env.claim('s100010', 'shop-snacks'); await env.claim('s100011', 'privacy-policy');
    env.state.legacy = { promo: 'old', claims: [{ studentId: 's151579', eggId: 'leadership', couponId: 77 }] };
    const before = (await live.availability(env.db)).scope;
    const result = await reset(env.db, env.services);
    assert.equal(result.cleared, 2); assert.equal(result.couponsDeleted, 2);
    assert.deepEqual(result.oldAppsScript, { claims: 1, deleted: 0 });
    assert.deepEqual(env.deleted.sort(), ['77', '901', '902']);
    assert.equal(env.state.legacyCleared, true);
    const after = await live.availability(env.db);
    assert.equal(after.remaining, 20); assert.equal(after.status, 'active'); assert.notEqual(after.scope, before, 'open tabs see a new scope');
    assert.deepEqual((await env.db.query('SELECT event FROM hunt.events', [])).rows.map(r => r.event), ['Hunt reset']);
    assert.equal((await env.claim('s100010', 'shop-snacks')).percentage, 10, 'students can claim again');
  });
});

test('a new RRHS_HUNT_PROMO_ID in Vercel starts an empty hunt', async () => {
  await withEnv({ RRHS_HUNT_ENABLED: 'true' }, async () => {
    const env = await setup();
    await env.claim('s100012', 'faq');
    await withEnv({ RRHS_HUNT_PROMO_ID: 'spring-2027' }, async () => {
      const fresh = await live.availability(env.db);
      assert.equal(fresh.remaining, 20); assert.equal(fresh.scope, 'spring-2027:1');
      assert.equal((await env.claim('s100012', 'faq')).percentage, 15);
    });
  });
});

test('dashboard: server-side password, rate limits, a 12-hour session, and the private log', async () => {
  await withEnv({ RRHS_HUNT_ENABLED: 'true' }, async () => {
    const env = await setup();
    const verify = value => value === 'test-only-password';
    await refused(live.adminLogin('wrong', 'bad-client', env.db, verify), 401);
    for(let i=0;i<4;i++) await refused(live.adminLogin('wrong', 'bad-client', env.db, verify),401);
    await refused(live.adminLogin('test-only-password','bad-client',env.db,verify),429);
    const session = await live.adminLogin('test-only-password', 'owner-client', env.db, verify);
    assert.ok(session.token.length >= 40);
    assert.ok(session.expiresAt>Date.now()+11*3600000 && session.expiresAt<=Date.now()+12*3600000);
    await refused(live.adminLog('forged-token-forged-token-forged', env.db), 401);
    await env.claim('s151579', 'shop-snacks');
    const log = await live.adminLog(session.token, env.db);
    assert.equal(log.email,'CO-OP owner');
    assert.equal(log.claims.length, 1); assert.equal(log.claims[0].studentId, 's151579'); assert.match(log.claims[0].code, /^RRHSHUNT-/);
    assert.equal(log.remaining, 19); assert.equal(log.pool.length, 19); assert.equal(log.promo, 'test-promo');
    assert.ok(log.events.some(e => e.event === 'Claimed' && e.studentId === 's151579' && e.eggId === 'shop-snacks'));
    await env.db.query("UPDATE hunt.sessions SET expires_at=now()-interval '1 second'", []);
    await refused(live.adminLog(session.token, env.db), 401);
    assert.equal(require('../api/_lib/hunt-dashboard-auth.cjs').matchesPassword('incorrect password'),false);
    assert.equal(require('../api/_lib/hunt-dashboard-auth.cjs').matchesPassword(undefined),false);
  });
});

test('the API: CORS, the env switch, edge caching, and claims that never leak the code', async () => {
  const env = await setup();
  require('../easter-hunt/db').use(env.db);
  const saved = { ...integrations };
  Object.assign(integrations, env.services);
  const handler = require('../api/v1/easter-hunt');
  const res = () => ({ headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(value) { this.body = value === undefined ? undefined : JSON.parse(value); } });
  const origin = 'https://rrhscoop.roundrockisd.org';
  try {
    await withEnv({ RRHS_HUNT_ENABLED: 'false' }, async () => {
      const off = res(); await handler({ method: 'GET', headers: {}, url: '/api/v1/easter-hunt' }, off);
      assert.equal(off.body.mode, 'disabled');
      const post = res(); await handler({ method: 'POST', headers: { origin }, body: { action: 'claim', studentId: 's1', eggId: 'faq', idempotencyKey: 'x' } }, post);
      assert.equal(post.statusCode, 503); assert.equal(post.headers['Access-Control-Allow-Origin'], origin);
    });
    await withEnv({ RRHS_HUNT_ENABLED: 'true' }, async () => {
      const open = res(); await handler({ method: 'GET', headers: {}, url: '/api/v1/easter-hunt' }, open);
      assert.equal(open.body.status, 'active'); assert.equal(open.body.remaining, 20); assert.match(open.headers['Cache-Control'], /s-maxage=2/);
      const claimed = res();
      await handler({ method: 'POST', headers: { origin }, body: { action: 'claim', studentId: 's151579', eggId: 'shop-snacks', idempotencyKey: '33333333-3333-4333-8333-333333333333' } }, claimed);
      assert.equal(claimed.statusCode, 200); assert.equal(claimed.body.percentage, 10); assert.doesNotMatch(JSON.stringify(claimed.body), /RRHSHUNT/);
      const taken = res();
      await handler({ method: 'POST', headers: { origin }, body: { action: 'claim', studentId: 's151580', eggId: 'shop-snacks', idempotencyKey: '44444444-3333-4333-8333-333333333333' } }, taken);
      assert.equal(taken.statusCode, 409);
      const admin = res(); await handler({ method: 'POST', headers: { origin }, body: { action: 'admin-log', token: 'x' } }, admin);
      assert.equal(admin.statusCode, 403, 'dashboard actions only from the dashboard origin');
      const preflight = res(); await handler({ method: 'OPTIONS', headers: { origin } }, preflight);
      assert.equal(preflight.statusCode, 204);
      const rejected = res(); await handler({ method: 'OPTIONS', headers: { origin: 'https://untrusted.example' } }, rejected);
      assert.equal(rejected.statusCode, 403); assert.equal(rejected.headers['Access-Control-Allow-Origin'], undefined);
      const down = res(); require('../easter-hunt/db').use({ query: async () => { throw new Error('down'); } });
      await handler({ method: 'GET', headers: {}, url: '/api/v1/easter-hunt' }, down);
      assert.equal(down.body.status, 'unavailable'); assert.equal(down.headers['Cache-Control'], 'no-store');
    });
  } finally { Object.assign(integrations, saved); require('../easter-hunt/db').use(undefined); }
});

test('the dashboard screenshot route needs a valid session and returns the circled image', async () => {
  const env = await setup();
  require('../easter-hunt/db').use(env.db);
  const handler = require('../api/v1/easter-hunt');
  const res = () => ({ headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(value) { this.body = JSON.parse(value); } });
  const origin = 'https://rrhscoop-assets.vercel.app';
  try {
    const denied = res(); await handler({ method: 'POST', headers: { origin }, body: { action: 'admin-location', id: 'faq', token: 'x'.repeat(40) } }, denied);
    assert.equal(denied.statusCode, 401); assert.equal('image' in denied.body, false);
    const { token } = await live.adminLogin('test-only-password', 'screenshot-client', env.db, () => true);
    const missing = res(); await handler({ method: 'POST', headers: { origin }, body: { action: 'admin-location', id: '../../.env', token } }, missing);
    assert.equal(missing.statusCode, 404);
    for (const spot of config.locations) {
      const shown = res(); await handler({ method: 'POST', headers: { origin }, body: { action: 'admin-location', id: spot.id, token } }, shown);
      assert.equal(shown.statusCode, 200, spot.id); assert.match(shown.body.image, /^data:image\/jpeg;base64,\/9j\//);
    }
  } finally { require('../easter-hunt/db').use(undefined); }
});

test('the retry endpoint only accepts a signed tick from Apps Script', async () => {
  const handler = require('../api/v1/hunt-jobs');
  const crypto = require('node:crypto'), secret = 'relay-secret-'.repeat(4);
  const res = () => ({ headers: {}, setHeader() {}, end(value) { this.body = value; } });
  await withEnv({ RRHS_HUNT_RELAY_SECRET: secret, RRHS_HUNT_DATABASE_URL: undefined }, async () => {
    const forged = res(); await handler({ headers: {}, body: { timestamp: Date.now(), signature: 'nope' } }, forged);
    assert.equal(forged.statusCode, 401);
    const timestamp = Date.now(), signature = crypto.createHmac('sha256', secret).update('job:' + timestamp).digest('base64url');
    const ok = res(); await handler({ headers: {}, body: { timestamp, signature } }, ok);
    assert.equal(ok.statusCode, undefined); assert.match(ok.body, /not configured/);
  });
});

test('Apps Script only relays signed mail and never decides anything about the hunt', () => {
  const source = fs.readFileSync(require.resolve('../apps-script/teacher-preorder-verification.gs'), 'utf8');
  for (const gone of ['huntClaim_', 'huntAvailability_', 'resetHuntForNewPromo', 'pauseHunt', 'HUNT_REWARDS', 'hunt-claim', 'hunt-admin']) assert.equal(source.includes(gone), false, gone);
  const crypto = require('node:crypto'), secret = 'relay-secret-'.repeat(4), values = new Map([['RRHS_HUNT_RELAY_SECRET', secret]]), sent = [];
  const props = { getProperty: k => values.get(k) ?? null, setProperty: (k, v) => values.set(k, String(v)), deleteProperty: k => values.delete(k), getProperties: () => Object.fromEntries(values) };
  const context = { console: { error() {} }, Logger: { log() {} },
    Utilities: { computeHmacSha256Signature: (text, key) => [...crypto.createHmac('sha256', key).update(text).digest()], base64EncodeWebSafe: bytes => Buffer.from(bytes).toString('base64url') + '=',
      base64DecodeWebSafe: text => [...Buffer.from(text, 'base64url')], newBlob: bytes => ({ getDataAsString: () => Buffer.from(bytes).toString('utf8') }) },
    MailApp: { getRemainingDailyQuota: () => 100 }, GmailApp: { sendEmail: (...m) => { if (context.fail) throw new Error('quota'); sent.push(m); } } };
  vm.runInNewContext(source, context);
  const call = payload => { const body = Buffer.from(JSON.stringify(payload)).toString('base64url'), timestamp = Date.now();
    return context.huntRelay_({ body, timestamp, signature: crypto.createHmac('sha256', secret).update(timestamp + '.' + body).digest('base64url') }, props); };
  assert.equal(context.huntRelay_({ body: 'e30', timestamp: Date.now(), signature: 'forged' }, props).status, 401);
  const reward = { kind: 'reward', id: '11111111-1111-4111-8111-111111111111', recipient: 's151579@student.roundrockisd.org', name: 'Dragon', percentage: 20, code: 'RRHSHUNT-ABCDEF0123456789' };
  context.fail = true; assert.equal(call(reward).status, 503); assert.equal(sent.length, 0);
  context.fail = false; assert.equal(call(reward).emailStatus, 'sent'); assert.equal(call(reward).emailStatus, 'sent');
  assert.equal(sent.length, 1, 'a repeat never emails twice'); assert.equal(sent[0][0], 's151579@student.roundrockisd.org'); assert.match(sent[0][2], /RRHSHUNT-ABCDEF0123456789/);
  assert.equal(call({ ...reward, id: '22222222-1111-4111-8111-111111111111', recipient: 'someone@gmail.com' }).status, 400);
  values.set('hunt_live_state', '{"claims":[]}'); values.set('hunt_rate', '{}');
  call({ kind: 'legacy-clear' });
  assert.equal([...values.keys()].filter(k => k.startsWith('hunt_')).length, 1, 'only the mail receipt remains');
});

test('dev mode emails a marked test copy with the fake code, to dashboard admins only', async () => {
  const env = await setup(), sent = [];
  const send = async payload => { sent.push(payload); return { ok: true, emailStatus: 'sent' }; };
  const result = await live.devEmail({ studentId: 'S151579', eggId: 'faq', code: 'FAKE-8VKWQLRS' }, 'c', env.db, send);
  assert.deepEqual(result, { emailStatus: 'sent', email: 's151579@student.roundrockisd.org' });
  assert.deepEqual([sent[0].kind, sent[0].recipient, sent[0].percentage, sent[0].code], ['test-reward', 's151579@student.roundrockisd.org', 15, 'FAKE-8VKWQLRS']);
  await refused(live.devEmail({ studentId: 's100001', eggId: 'faq', code: 'FAKE-8VKWQLRS' }, 'c', env.db, send), 403, /dashboard admins/);
  await refused(live.devEmail({ studentId: 's151579', eggId: 'faq', code: 'RRHSHUNT-REALCODE1234' }, 'c', env.db, send), 400);
  for (let i = 0; i < 4; i++) await live.devEmail({ studentId: 's151579', eggId: 'faq', code: 'FAKE-8VKWQLRS' }, 'c', env.db, send);
  await refused(live.devEmail({ studentId: 's151579', eggId: 'faq', code: 'FAKE-8VKWQLRS' }, 'c', env.db, send), 429);
  assert.equal(sent.length, 5);
  assert.equal((await env.db.query('SELECT count(*)::int AS n FROM hunt.claims', [])).rows[0].n, 0, 'a test email never claims anything');
});

test('the Apps Script test-reward email is marked as a test and shows the fake code', () => {
  const source = fs.readFileSync(require.resolve('../apps-script/teacher-preorder-verification.gs'), 'utf8');
  const context = {}; vm.runInNewContext(source, context);
  const email = context.buildEasterEggRewardEmail({ percentage: 15, name: 'Dragon', preview: true, reference: 'FAKE-8VKWQLRS' });
  assert.match(email.subject, /^\[Preview\]/); assert.match(email.text, /FAKE-8VKWQLRS/); assert.match(email.text, /No coupon was created/);
});

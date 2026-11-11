'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const source = readFileSync(require.resolve('../apps-script/teacher-preorder-verification.gs'), 'utf8');
const START = Date.parse('2026-11-10T12:00:00-06:00');

function runtime({ properties = {}, alias = '' } = {}) {
  const props = new Map(Object.entries({ RRHS_ECWID_STORE_ID: '123', RRHS_ECWID_API_TOKEN: 'test-only-token', RRHS_HUNT_RELAY_SECRET: 'r'.repeat(40), ...properties }));
  const state = { now: START, quota: 100, aliases: [], lock: true, triggerError: false, apiStatus: 200,
    pdfType: 'application/pdf', orderId: 'EXAMPLE-ORDER', deployed: true, triggers: [], requests: [], logs: [], sends: 0, locksReleased: 0 };
  const trigger = (name, minutes) => ({ name, minutes, getHandlerFunction: () => name });
  state.triggers = ['sendPendingReceipts', 'sendCfaDispatch', 'sendOrderStatusUpdates', 'runCoopJobs', 'unrelatedJob'].map(name => trigger(name));
  const noSend = () => { state.sends++; throw new Error('Setup must not send email'); };
  const context = {
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [state.now])); } static now() { return state.now; } },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => props.get(key) || null, setProperty: (key, value) => props.set(key, String(value)),
      getProperties: () => Object.fromEntries(props), deleteProperty: key => props.delete(key),
    }) },
    LockService: { getScriptLock: () => ({ tryLock: () => state.lock, releaseLock: () => { state.locksReleased++; } }) },
    Utilities: { getUuid: crypto.randomUUID, formatDate(date, timeZone) {
      return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
    } },
    MailApp: { getRemainingDailyQuota: () => state.quota, sendEmail: noSend },
    GmailApp: { getAliases: () => state.aliases, sendEmail: noSend },
    Logger: { log: message => state.logs.push(message) },
    ScriptApp: {
      getProjectTriggers: () => [...state.triggers],
      deleteTrigger: entry => state.triggers.splice(state.triggers.indexOf(entry), 1),
      newTrigger: name => ({ timeBased: () => ({ everyMinutes: minutes => ({ create: () => {
        if (state.triggerError) throw new Error('Google could not create the trigger');
        const entry = trigger(name, minutes); state.triggers.push(entry); return entry;
      } }) }) }),
      getService: () => ({ getUrl: () => state.deployed ? 'https://script.google.com/macros/s/example/exec' : null }),
    },
    UrlFetchApp: { fetch(url, options) {
      state.requests.push({ url, options });
      assert.equal(options.method || 'GET', 'GET', 'Setup only makes read-only requests');
      return { getResponseCode: () => state.apiStatus,
        getContentText: () => JSON.stringify({ total: state.orderId ? 1 : 0, items: state.orderId ? [{ id: state.orderId }] : [] }),
        getBlob: () => ({ getContentType: () => state.pdfType, setName() { return this; } }),
      };
    } },
  };
  runInNewContext(source.replace("const FROM_ALIAS = '';", `const FROM_ALIAS = '${alias}';`), context);
  return { context, props, state };
}

test('running the reward builder from the editor returns a preview, while invalid explicit inputs still fail', () => {
  const { context, state } = runtime();
  const email = context.buildEasterEggRewardEmail();
  assert.match(email.subject, /^\[Preview\]/); assert.match(email.text, /No coupon was created/);
  for (const value of [null, undefined, {}, { percentage: 99 }, { percentage: 35 }]) assert.throws(() => context.buildEasterEggRewardEmail(value));
  assert.equal(state.sends, 0); assert.equal(state.requests.length, 0);
});
test('setup render tests cover 21 template variants without contacting a service', () => {
  const { context, state } = runtime();
  assert.equal(context.coopTestTemplates_(), 21);
  assert.equal(state.requests.length, 0); assert.equal(state.sends, 0);
});
test('combined setup replaces old triggers and preserves receipt, status, dispatch and verification history', () => {
  const saved = { START_AT: '1234', SENT_IDS: '["ORDER1"]', STATUS_START_AT: '5678', STATUS_CHECKED_AT: '9876',
    cfa_last_dispatch_date: '2026-11-10', cfa_internal_otp_key: 'x'.repeat(64), os_ORDER1: '{"p":"PAID"}' };
  const { context, props, state } = runtime({ properties: saved });
  const report = context.setup(); context.setup();
  for (const [key, value] of Object.entries(saved)) assert.equal(props.get(key), value, key);
  assert.deepEqual(state.triggers.map(t => t.name).sort(), ['runCoopJobs', 'unrelatedJob']);
  assert.equal(state.triggers.find(t => t.name === 'runCoopJobs').minutes, 1);
  assert.equal(props.get('COOP_SETUP_VERSION'), '2');
  assert.ok(report.checks.some(c => c.includes('Receipt PDF')));
  assert.equal(report.warnings.length, 0); assert.equal(state.sends, 0);
  assert.equal(state.locksReleased, 2);
});
test('first setup builds missing state and verification key without backdating order checkpoints', () => {
  const { context, props, state } = runtime(); context.setup();
  for (const key of ['START_AT', 'STATUS_START_AT', 'STATUS_CHECKED_AT']) assert.equal(props.get(key), String(START / 1000));
  assert.equal(props.get('SENT_IDS'), '[]'); assert.ok(props.get('cfa_internal_otp_key').length >= 32);
  assert.equal(props.get('COOP_HEALTH_CHECKED_DAY'), '2026-11-10');
  assert.ok(state.logs.some(log => log.includes('SETUP COMPLETE')));
  assert.equal(state.sends, 0);
});
test('checkCoopSetup is read-only and validates Ecwid order/PDF access', () => {
  const { context, props, state } = runtime(); const before = [...props]; const triggers = [...state.triggers];
  context.checkCoopSetup();
  assert.deepEqual([...props], before); assert.deepEqual(state.triggers, triggers);
  assert.match(state.requests[0].url, /responseFields=total,items\(id\)/);
  assert.match(state.requests[1].url, /\/invoice-pdf$/); assert.equal(state.sends, 0);
});
test('failed configuration, remote access, or PDF checks leave existing automation intact', () => {
  for (const scenario of ['credentials', 'api', 'pdf']) {
    const { context, props, state } = runtime();
    if (scenario === 'credentials') props.delete('RRHS_ECWID_API_TOKEN');
    if (scenario === 'api') state.apiStatus = 403;
    if (scenario === 'pdf') state.pdfType = 'text/html';
    const before = [...props], triggers = [...state.triggers];
    assert.throws(() => context.setup());
    assert.deepEqual([...props], before); assert.deepEqual(state.triggers, triggers); assert.equal(state.sends, 0);
    assert.equal(state.locksReleased, 1);
  }
});
test('setup never clears malformed history or silently replaces an existing verification secret', () => {
  for (const properties of [{ SENT_IDS: 'bad json' }, { SENT_IDS: '{}' }, { START_AT: 'bad' }, { cfa_internal_otp_key: 'short' }]) {
    const { context, props, state } = runtime({ properties }); const before = [...props];
    assert.throws(() => context.setup()); assert.deepEqual([...props], before);
    assert.equal(state.requests.length, 0);
  }
});
test('trigger creation failure preserves old triggers and contention exits without changes', () => {
  for (const kind of ['trigger', 'lock']) {
    const { context, props, state } = runtime(); const triggers = [...state.triggers];
    if (kind === 'trigger') state.triggerError = true; else state.lock = false;
    assert.throws(() => context.setup()); assert.deepEqual(state.triggers, triggers);
    assert.equal(props.has('COOP_SETUP_VERSION'), false);
  }
});
test('missing web deployment, empty store and exhausted quota produce actionable warnings', () => {
  const { context, state } = runtime(); state.deployed = false; state.orderId = null; state.quota = 0;
  const report = context.setup();
  assert.equal(report.warnings.length, 3);
  assert.match(report.warnings.join(' '), /quota.*PDF.*web-app/);
  assert.equal(state.sends, 0); assert.equal(state.triggers.filter(t => t.name === 'runCoopJobs').length, 1);
});
test('setup verifies configured sender aliases before changing triggers', () => {
  const env = runtime({ alias: 'store@example.invalid' });
  assert.throws(() => env.context.setup(), /send-as alias/);
  env.state.aliases = ['store@example.invalid']; env.context.setup();
  assert.equal(env.state.sends, 0);
});
test('daily checks repeat on the next Central day without rerunning setup or replacing triggers', () => {
  const { context, state, props } = runtime();
  state.now = Date.parse('2026-11-11T05:59:00Z'); context.setup();
  const calls = state.requests.length, triggers = [...state.triggers];
  context.coopDailyHealthCheck_(); assert.equal(state.requests.length, calls);
  state.now += 2 * 60000; context.coopDailyHealthCheck_();
  assert.equal(props.get('COOP_HEALTH_CHECKED_DAY'), '2026-11-11'); assert.equal(state.requests.length, calls + 2);
  context.coopDailyHealthCheck_(); assert.equal(state.requests.length, calls + 2);
  assert.deepEqual(state.triggers, triggers); assert.equal(state.sends, 0);
});
test('daily failures remain recoverable and retry after 15 minutes without leaking service details', () => {
  const { context, state, props } = runtime(); context.setup();
  state.now += 86400000; state.apiStatus = 403;
  assert.throws(() => context.coopDailyHealthCheck_(), /retry in 15 minutes/);
  assert.equal(JSON.parse(props.get('COOP_HEALTH_REPORT')).status, 'failed');
  assert.doesNotMatch(props.get('COOP_HEALTH_REPORT'), /test-only-token|EXAMPLE-ORDER/);
  const calls = state.requests.length; context.coopDailyHealthCheck_(); assert.equal(state.requests.length, calls);
  state.now += 15 * 60000; state.apiStatus = 200; context.coopDailyHealthCheck_();
  assert.equal(props.get('COOP_HEALTH_CHECKED_DAY'), '2026-11-11');
});
test('a health check failure never prevents dispatch, receipts or status jobs from running', () => {
  const { context } = runtime(), calls = [];
  context.sendCfaDispatch = () => calls.push('dispatch');
  context.sendPendingReceipts = () => calls.push('receipts');
  context.sendOrderStatusUpdates = () => calls.push('statuses');
  context.coopDailyHealthCheck_ = () => { throw new Error('Health check unavailable'); };
  assert.throws(() => context.runCoopJobs(), /Health check unavailable/);
  assert.deepEqual(calls, ['dispatch', 'receipts', 'statuses']);
});

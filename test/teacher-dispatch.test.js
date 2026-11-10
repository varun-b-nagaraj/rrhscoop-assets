'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');

const script = readFileSync(require.resolve('../apps-script/teacher-preorder-verification.gs'), 'utf8');

function order(placed, changes = {}) {
  return {
    id: 'CFA01',
    createTimestamp: Date.parse(placed) / 1000,
    paymentStatus: 'PAID',
    items: [{ productId: 779182392, quantity: 2 }],
    orderComments: [
      'FACULTY CHICK-FIL-A PREORDER',
      'Verified district email: teacher@roundrockisd.org',
      'Name: Example Teacher',
      'Room: 1314',
      'Sauces: Ketchup: 1',
    ].join('\n'),
    ...changes,
  };
}

function setup(placed) {
  const messages = [];
  const requests = [];
  const properties = new Map([['RRHS_ECWID_STORE_ID', '123'], ['RRHS_ECWID_API_TOKEN', 'test-ecwid-token']]);
  const context = {
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [placed])); }
    },
    Utilities: {
      formatDate(date, timeZone, pattern) {
        const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
          timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
        }).formatToParts(date).map(part => [part.type, part.value]));
        return pattern === 'HHmm' ? parts.hour + parts.minute : [parts.year, parts.month, parts.day].join('-');
      },
    },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => properties.get(key),
      setProperty: (key, value) => properties.set(key, value),
    }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    MailApp: { sendEmail: message => messages.push(message) },
    UrlFetchApp: { fetch(url, options) {
      requests.push({ url, options });
      return {
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({ total: 3, items: [
          order('2026-11-10T19:59:59Z'),
          order('2026-11-10T20:00:00Z', { id: 'LATE' }),
          order('2026-11-10T19:30:00Z', { id: 'REGULAR', orderComments: '' }),
        ] }),
      };
    } },
  };
  runInNewContext(script, context);
  return { context, requests, messages };
}

test('direct Ecwid dispatch sends once after 2:30 Central and excludes orders placed at or after 2', () => {
  const early = setup('2026-11-10T20:29:59Z');
  early.context.sendCfaDispatch();
  assert.equal(early.requests.length, 0);
  assert.equal(early.messages.length, 0);

  const due = setup('2026-11-10T20:30:00Z');
  due.context.sendCfaDispatch();
  due.context.sendCfaDispatch();
  assert.equal(due.requests.length, 1);
  assert.match(due.requests[0].url, /^https:\/\/app\.ecwid\.com\/api\/v3\/123\/orders\?/);
  assert.equal(due.requests[0].options.headers.Authorization, 'Bearer test-ecwid-token');
  assert.equal(due.messages.length, 1);
  assert.equal(due.messages[0].to, 's137323@student.roundrockisd.org,s138524@student.roundrockisd.org');
  assert.match(due.messages[0].htmlBody, /CFA01/);
  assert.doesNotMatch(due.messages[0].htmlBody, /LATE|REGULAR|teacher@roundrockisd\.org/);
});

test('order cutoff follows Central daylight saving time', () => {
  const { context } = setup('2027-04-01T19:30:00Z');
  assert.ok(context.cfaDispatchOrder_(order('2027-04-01T18:59:59Z'), '2027-04-01'));
  assert.equal(context.cfaDispatchOrder_(order('2027-04-01T19:00:00Z'), '2027-04-01'), null);
  assert.equal(context.cfaDispatchOrder_(order('2027-04-01T04:59:59Z'), '2027-04-01'), null);
});

test('combined setup replaces old triggers and preserves receipt history', () => {
  const properties = new Map([
    ['CFA_VERIFICATION_SECRET', 'x'.repeat(32)], ['RECEIPTS_SECRET', 'receipt-key'],
    ['RRHS_ECWID_STORE_ID', '123'], ['RRHS_ECWID_API_TOKEN', 'ecwid-key'],
    ['START_AT', '1234'], ['SENT_IDS', '["ORDER1"]'],
  ]);
  const triggers = ['sendCfaDispatch', 'sendPendingReceipts', 'runCoopJobs', 'other'];
  let installed;
  const context = {
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => properties.get(key),
      setProperty: (key, value) => properties.set(key, value),
    }) },
    ScriptApp: {
      getProjectTriggers: () => triggers.map(name => ({ getHandlerFunction: () => name })),
      deleteTrigger: trigger => triggers.splice(triggers.indexOf(trigger.getHandlerFunction()), 1),
      newTrigger: name => ({ timeBased: () => ({ everyMinutes: minutes => ({
        create: () => { installed = { name, minutes }; },
      }) }) }),
    },
    Logger: { log() {} },
  };
  runInNewContext(script, context);
  context.setup();
  assert.deepEqual(installed, { name: 'runCoopJobs', minutes: 1 });
  assert.deepEqual(triggers, ['other']);
  assert.equal(properties.get('START_AT'), '1234');
  assert.equal(properties.get('SENT_IDS'), '["ORDER1"]');
});

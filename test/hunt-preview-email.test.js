'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../apps-script/teacher-preorder-verification.gs'), 'utf8');
function runtime() {
  const values = new Map(), sent = [], state = { now: Date.parse('2026-11-11T12:00:00-06:00'), fail: false };
  const props = { getProperty: key => values.get(key), setProperty: (key, value) => values.set(key, value) };
  const context = {
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [state.now])); } static now() { return state.now; } },
    Utilities: { formatDate: () => '2026-11-11' }, MailApp: { getRemainingDailyQuota: () => 100 },
    GmailApp: { sendEmail(...message) { if (state.fail) throw new Error('Provider unavailable'); sent.push(message); } },
  };
  vm.runInNewContext(source, context);
  return { context, props, values, sent, state };
}
const input = { studentId: 's151579', percentage: 35, reference: 'PREVIEW-0123456789AB' };
test('Apps Script sends an actual branded preview only to the fixed presenter mailbox and deduplicates retries', () => {
  const { context, props, sent } = runtime();
  assert.equal(context.cfaSendHuntPreview_(input, props).emailStatus, 'sent');
  assert.equal(context.cfaSendHuntPreview_(input, props).emailStatus, 'sent');
  assert.equal(sent.length, 1); assert.equal(sent[0][0], 's151579@student.roundrockisd.org');
  assert.match(sent[0][1], /^\[Preview\]/); assert.match(sent[0][2], /PREVIEW-0123456789AB/);
  assert.doesNotMatch(sent[0][2], /no email was sent/i); assert.match(sent[0][3].htmlBody, /dragon-package-sticker/);
});
test('preview sends reject arbitrary recipients and impose persistent cooldown and daily limits', () => {
  const { context, props, sent, state } = runtime();
  assert.equal(context.cfaSendHuntPreview_({ ...input, studentId: 's100000' }, props).ok, false);
  for (let i=0; i<5; i++) {
    assert.equal(context.cfaSendHuntPreview_({ ...input, reference: 'PREVIEW-' + String(i).padStart(12,'0') }, props).ok, true);
    if (i===0) assert.equal(context.cfaSendHuntPreview_({ ...input, reference:'PREVIEW-ABCDEF012345' }, props).status,429);
    state.now += 61000;
  }
  assert.equal(sent.length,5); assert.equal(context.cfaSendHuntPreview_(input, props).status,429);
});
test('ambiguous provider failures never claim success or automatically duplicate a preview', () => {
  const { context, props, sent, state } = runtime(); state.fail = true;
  assert.equal(context.cfaSendHuntPreview_(input, props).ok,false);
  state.fail = false; state.now += 61000;
  assert.equal(context.cfaSendHuntPreview_(input, props).ok,false); assert.equal(sent.length,0);
});
test('hosted preview endpoint forwards only approved requests and reports an outdated Apps Script deployment honestly', async () => {
  const service = require('../teacher-preorders/service'), original = service.mailAction;
  const handler = require('../api/v1/easter-hunt');
  const res = () => ({ setHeader() {}, end(value) { this.body = JSON.parse(value); } });
  let calls = 0;
  service.mailAction = async () => { calls++; throw Object.assign(new Error('Unknown action.'), {status:400}); };
  try {
    const blocked = res(); await handler({ method:'POST', body:{action:'send-preview', ...input, studentId:'s100000'} }, blocked);
    assert.equal(blocked.statusCode,400); assert.equal(calls,0);
    const outdated = res(); await handler({method:'POST',body:{action:'send-preview',...input}},outdated);
    assert.equal(outdated.statusCode,503); assert.match(outdated.body.error,/Apps Script web-app deployment/);
    service.mailAction = async () => ({ok:true,emailStatus:'sent'});
    const sent = res(); await handler({method:'POST',body:{action:'send-preview',...input}},sent);
    assert.equal(sent.statusCode,200); assert.equal(sent.body.emailStatus,'sent');
  } finally { service.mailAction = original; }
});
test('school-origin preflight succeeds without sending mail and errors retain readable CORS headers', async () => {
  const handler = require('../api/v1/easter-hunt');
  const response = () => ({ headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(value) { this.body = value; } });
  const origin = 'https://rrhscoop.roundrockisd.org';
  const preflight = response();
  await handler({ method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } }, preflight);
  assert.equal(preflight.statusCode, 204);
  assert.equal(preflight.body, undefined);
  assert.equal(preflight.headers['Access-Control-Allow-Origin'], origin);
  assert.match(preflight.headers['Access-Control-Allow-Methods'], /POST/);
  assert.equal(preflight.headers['Access-Control-Allow-Headers'], 'Content-Type');
  const invalid = response();
  await handler({ method: 'POST', headers: { origin }, body: { action: 'send-preview' } }, invalid);
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.headers['Access-Control-Allow-Origin'], origin);
  const rejected = response();
  await handler({ method: 'OPTIONS', headers: { origin: 'https://untrusted.example' } }, rejected);
  assert.equal(rejected.statusCode, 403);
  assert.equal(rejected.headers['Access-Control-Allow-Origin'], undefined);
});

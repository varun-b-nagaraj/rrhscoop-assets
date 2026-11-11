'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

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
  await handler({ method: 'POST', headers: { origin }, body: { action: 'claim' } }, invalid);
  assert.ok([400, 503].includes(invalid.statusCode));
  assert.equal(invalid.headers['Access-Control-Allow-Origin'], origin);
  const rejected = response();
  await handler({ method: 'OPTIONS', headers: { origin: 'https://untrusted.example' } }, rejected);
  assert.equal(rejected.statusCode, 403);
  assert.equal(rejected.headers['Access-Control-Allow-Origin'], undefined);
});
test('Apps Script text avoids emoji, which GmailApp garbles in subject lines', () => {
  const source = require('node:fs').readFileSync(require.resolve('../apps-script/teacher-preorder-verification.gs'), 'utf8');
  assert.equal([...source].filter(ch => ch.codePointAt(0) > 0xffff).join(''), '');
});

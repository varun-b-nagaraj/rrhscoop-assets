'use strict';

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

const KEY = crypto.randomBytes(32);
process.env.RRHS_HAC_VAULT_KEY = KEY.toString('base64');
const vault = require('../api/v1/hac/vault.js');

function call(body) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 0,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      end(b) { resolve({ status: this.statusCode, body: b ? JSON.parse(b) : null, raw: b || '' }); },
    };
    vault({ method: 'POST', body }, res);
  });
}

test('seal returns an opaque token that does not contain the password', async () => {
  const r = await call({ action: 'seal', username: 's151570', password: 'hunter2-secret' });
  assert.strictEqual(r.status, 200);
  assert.match(r.body.token, /^v1\./);
  assert.ok(!r.raw.includes('hunter2-secret'));
  assert.ok(!Buffer.from(r.body.token.slice(3), 'base64url').toString('latin1').includes('hunter2'));
  assert.deepStrictEqual(vault._unseal(KEY, r.body.token), { username: 's151570', password: 'hunter2-secret' });
});

test('tampered, wrong-key, and expired tokens are rejected', () => {
  const token = vault._seal(KEY, 'u', 'p');
  const bytes = Buffer.from(token.slice(3), 'base64url');
  bytes[bytes.length - 1] ^= 1;
  assert.strictEqual(vault._unseal(KEY, 'v1.' + bytes.toString('base64url')), null);
  assert.strictEqual(vault._unseal(crypto.randomBytes(32), token), null);
  const realNow = Date.now;
  Date.now = () => realNow() + 181 * 86400000;
  try {
    assert.strictEqual(vault._unseal(KEY, token), null);
  } finally {
    Date.now = realNow;
  }
});

test('proxy injects credentials server-side, only for allowed HAC calls', async () => {
  const token = vault._seal(KEY, 's151570', 'pw-123');
  const realFetch = global.fetch;
  const seen = [];
  global.fetch = async (url, opts) => {
    seen.push({ url, body: JSON.parse(opts.body) });
    return { status: 200, text: async () => JSON.stringify({ success: true }) };
  };
  try {
    const ok = await call({ action: 'proxy', token, path: '/api/getReport', payload: { student_id: '151570' } });
    assert.strictEqual(ok.status, 200);
    assert.ok(!ok.raw.includes('pw-123'));
    assert.strictEqual(seen[0].url, 'https://hacapi-hh.vercel.app/api/getReport');
    assert.deepStrictEqual(
      { u: seen[0].body.username, p: seen[0].body.password, s: seen[0].body.student_id },
      { u: 's151570', p: 'pw-123', s: '151570' }
    );
    const blocked = await call({ action: 'proxy', token, path: '/api/anythingElse', payload: {} });
    assert.strictEqual(blocked.status, 400);
    const bad = await call({ action: 'proxy', token: 'v1.garbage', path: '/api/login', payload: {} });
    assert.strictEqual(bad.status, 401);
    assert.strictEqual(seen.length, 1);
  } finally {
    global.fetch = realFetch;
  }
});

test('without RRHS_HAC_VAULT_KEY the vault is disabled', async () => {
  const saved = process.env.RRHS_HAC_VAULT_KEY;
  delete process.env.RRHS_HAC_VAULT_KEY;
  try {
    const r = await call({ action: 'seal', username: 'u', password: 'p' });
    assert.strictEqual(r.status, 503);
  } finally {
    process.env.RRHS_HAC_VAULT_KEY = saved;
  }
});

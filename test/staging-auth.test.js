'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const access = require('../api/_lib/staging-auth.cjs');
const deployment = require('../api/_lib/deployment.cjs');

const env = {
  VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'main',
  RRHS_STAGING_PASSWORD: 'fixture-password-1',
  RRHS_STAGING_SESSION_SECRET: 'test-staging-secret-'.repeat(3),
};

function withEnv(values, fn) {
  const keys = Object.keys(values);
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  const restore = () => { for (const key of keys) previous[key] === undefined ? delete process.env[key] : process.env[key] = previous[key]; };
  return Promise.resolve().then(fn).finally(restore);
}

function response() {
  return { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(value) { this.body = value; } };
}

test('server deployment identity separates staging, preview and production', () => {
  assert.equal(deployment.environment(env), 'staging');
  assert.equal(deployment.environment({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feature/x' }), 'preview');
  assert.equal(deployment.environment({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'production' }), 'production');
});

test('readiness reports staging access only when the password and session secret are set', () => {
  assert.equal(deployment.configuration(env).stagingAccess, true);
  assert.equal(deployment.configuration({ RRHS_STAGING_SESSION_SECRET: env.RRHS_STAGING_SESSION_SECRET }).stagingAccess, false);
});

test('only the staging password is accepted', () => {
  assert.doesNotThrow(() => access.checkPassword('fixture-password-1', env));
  for (const wrong of ['fixture-password-2', '', 'FIXTURE-PASSWORD-1', undefined, 'x'.repeat(300)]) {
    assert.throws(() => access.checkPassword(wrong, env), error => error.status === 401);
  }
});

test('staging sessions verify, expire, and end when the password changes', () => {
  const now = Date.parse('2026-11-17T12:00:00Z');
  const token = access.sign(env, now);
  assert.ok(access.verify(token, env, now + 1000));
  assert.throws(() => access.verify(token, env, now + (access.MAX_SECONDS + 1) * 1000), error => error.status === 401);
  assert.throws(() => access.verify(token, { ...env, RRHS_STAGING_PASSWORD: 'rotated-password' }, now + 1000), error => error.status === 401);
  assert.throws(() => access.verify(`${token}x`, env, now + 1000), error => error.status === 401);
});

test('Preview writes fail clearly when staging access is not configured', () => {
  assert.throws(() => access.requirePreviewAccess({ headers: {} }, { ...env, RRHS_STAGING_PASSWORD: '' }),
    error => error.status === 503 && /RRHS_STAGING_PASSWORD/.test(error.message));
  assert.throws(() => access.requirePreviewAccess({ headers: {} }, { ...env, RRHS_STAGING_SESSION_SECRET: '' }),
    error => error.status === 503 && /RRHS_STAGING_SESSION_SECRET/.test(error.message));
});

test('production requests keep their existing authorization path', () => {
  assert.equal(access.requirePreviewAccess({ headers: {} }, { VERCEL_ENV: 'production' }), null);
});

test('the sign-in route issues a session for the right password and delays a wrong one', () => withEnv(env, async () => {
  const handler = require('../api/v1/staging-auth');
  const delays = [];
  const delay = async ms => { delays.push(ms); };

  const ok = response();
  await handler({ method: 'POST', headers: {}, body: { action: 'sign-in', password: 'fixture-password-1' } }, ok, { delay });
  assert.equal(ok.statusCode, 200);
  const { token } = JSON.parse(ok.body);
  assert.ok(access.requirePreviewAccess({ headers: { authorization: `Bearer ${token}` } }));
  assert.deepEqual(delays, []);

  const wrong = response();
  await handler({ method: 'POST', headers: {}, body: { action: 'sign-in', password: 'nope-nope-nope' } }, wrong, { delay });
  assert.equal(wrong.statusCode, 401);
  assert.equal(JSON.parse(wrong.body).token, undefined);
  assert.equal(delays.length, 1);
}));

test('staging hunt rejects an unsigned request before any real write', () => withEnv(env, async () => {
  const res = response();
  await require('../api/v1/easter-hunt')({ method: 'POST', headers: {}, body: { action: 'claim' } }, res);
  assert.equal(res.statusCode, 401);
  assert.match(JSON.parse(res.body).error, /Sign in to staging/);
}));

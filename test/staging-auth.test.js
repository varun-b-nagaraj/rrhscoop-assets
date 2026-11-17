'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const access = require('../api/_lib/staging-auth.cjs');
const deployment = require('../api/_lib/deployment.cjs');

const env = {
  VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'main',
  RRHS_STAGING_TESTERS: 'owner@roundrockisd.org, helper@roundrockisd.org',
  RRHS_STAGING_SESSION_SECRET: 'test-staging-secret-'.repeat(3),
};

test('server deployment identity separates staging, preview and production', () => {
  assert.equal(deployment.environment(env), 'staging');
  assert.equal(deployment.environment({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feature/x' }), 'preview');
  assert.equal(deployment.environment({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'production' }), 'production');
});

test('staging sessions require an allowlisted tester and expire', () => {
  const now = Date.parse('2026-11-17T12:00:00Z');
  const token = access.sign('OWNER@roundrockisd.org', env, now);
  assert.equal(access.verify(token, env, now + 1000).email, 'owner@roundrockisd.org');
  assert.throws(() => access.sign('student@roundrockisd.org', env, now), error => error.status === 403);
  assert.throws(() => access.verify(token, env, now + (access.MAX_SECONDS + 1) * 1000), error => error.status === 401);
});

test('Preview writes fail clearly when staging credentials are missing', () => {
  assert.throws(() => access.requirePreviewAccess({ headers: {} }, {
    VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'main', RRHS_STAGING_TESTERS: 'owner@roundrockisd.org',
  }), error => error.status === 503 && /RRHS_STAGING_SESSION_SECRET/.test(error.message));
});

test('production requests keep their existing authorization path', () => {
  assert.equal(access.requirePreviewAccess({ headers: {} }, { VERCEL_ENV: 'production' }), null);
});

test('staging hunt rejects an unsigned request before any real write', async () => {
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  const response = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(value) { this.body = value; } };
  try {
    await require('../api/v1/easter-hunt')({ method: 'POST', headers: {}, body: { action: 'claim' } }, response);
    assert.equal(response.statusCode, 401);
    assert.match(JSON.parse(response.body).error, /Sign in to staging/);
  } finally {
    for (const key of Object.keys(env)) previous[key] === undefined ? delete process.env[key] : process.env[key] = previous[key];
  }
});

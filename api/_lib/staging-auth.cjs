'use strict';

const crypto = require('node:crypto');
const { environment } = require('./deployment.cjs');
const AUDIENCE = 'rrhs-staging-api-v1';
const MAX_SECONDS = 8 * 60 * 60;

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

function previewRequiresAccess(env = process.env) {
  return environment(env) === 'staging' || environment(env) === 'preview';
}

function testers(env = process.env) {
  return new Set(String(env.RRHS_STAGING_TESTERS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean));
}

function secret(env = process.env) {
  const value = String(env.RRHS_STAGING_SESSION_SECRET || '').trim();
  if (value.length < 32) fail(503, 'Staging access is not configured. Add RRHS_STAGING_SESSION_SECRET to Vercel Preview.');
  return value;
}

function assertTester(email, env = process.env) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !testers(env).has(normalized)) fail(403, 'This account is not authorized for RRHS CO-OP staging.');
  return normalized;
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sign(email, env = process.env, now = Date.now()) {
  const payload = encode({ aud: AUDIENCE, email: assertTester(email, env), exp: Math.floor(now / 1000) + MAX_SECONDS });
  const signature = crypto.createHmac('sha256', secret(env)).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verify(token, env = process.env, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 4096) fail(401, 'Sign in to staging to continue.');
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) fail(401, 'Sign in to staging to continue.');
  const expected = crypto.createHmac('sha256', secret(env)).update(payload).digest();
  const received = Buffer.from(signature, 'base64url');
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) fail(401, 'Your staging session is invalid. Sign in again.');
  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch (_) { fail(401, 'Your staging session is invalid. Sign in again.'); }
  if (data.aud !== AUDIENCE || !Number.isSafeInteger(data.exp) || data.exp <= Math.floor(now / 1000)) fail(401, 'Your staging session expired. Sign in again.');
  data.email = assertTester(data.email, env);
  return data;
}

function bearer(req) {
  const value = String(req.headers && req.headers.authorization || '');
  return value.startsWith('Bearer ') ? value.slice(7) : '';
}

function requirePreviewAccess(req, env = process.env) {
  if (!previewRequiresAccess(env)) return null;
  secret(env);
  if (testers(env).size === 0) fail(503, 'Staging access is not configured. Add RRHS_STAGING_TESTERS to Vercel Preview.');
  return verify(bearer(req), env);
}

module.exports = { MAX_SECONDS, previewRequiresAccess, testers, assertTester, sign, verify, requirePreviewAccess };

'use strict';

// Staging access is one shared password (ADR 0011). The password and the session secret live only
// in Vercel Preview. A session is signed with both, so changing either one ends every session.
const crypto = require('node:crypto');
const { environment } = require('./deployment.cjs');
const AUDIENCE = 'rrhs-staging-api-v2';
const MAX_SECONDS = 8 * 60 * 60;

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

function previewRequiresAccess(env = process.env) {
  return environment(env) === 'staging' || environment(env) === 'preview';
}

function secret(env = process.env) {
  const value = String(env.RRHS_STAGING_SESSION_SECRET || '').trim();
  if (value.length < 32) fail(503, 'Staging access is not configured. Add RRHS_STAGING_SESSION_SECRET to Vercel Preview.');
  return value;
}

function password(env = process.env) {
  const value = String(env.RRHS_STAGING_PASSWORD || '');
  if (value.length < 8) fail(503, 'Staging access is not configured. Add RRHS_STAGING_PASSWORD to Vercel Preview.');
  return value;
}

function signingKey(env) {
  return crypto.createHmac('sha256', secret(env)).update(`password:${password(env)}`).digest();
}

function checkPassword(candidate, env = process.env) {
  const key = signingKey(env);
  const digest = value => crypto.createHmac('sha256', key).update(String(value)).digest();
  const ok = typeof candidate === 'string' && candidate.length <= 256 &&
    crypto.timingSafeEqual(digest(candidate), digest(password(env)));
  if (!ok) fail(401, 'That password is not correct.');
}

function sign(env = process.env, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ aud: AUDIENCE, exp: Math.floor(now / 1000) + MAX_SECONDS })).toString('base64url');
  const signature = crypto.createHmac('sha256', signingKey(env)).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verify(token, env = process.env, now = Date.now()) {
  if (typeof token !== 'string' || !token || token.length > 4096) fail(401, 'Sign in to staging to continue.');
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) fail(401, 'Sign in to staging to continue.');
  const expected = crypto.createHmac('sha256', signingKey(env)).update(payload).digest();
  const received = Buffer.from(signature, 'base64url');
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) fail(401, 'Your staging session ended. Sign in again.');
  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch (_) { fail(401, 'Your staging session ended. Sign in again.'); }
  if (data.aud !== AUDIENCE || !Number.isSafeInteger(data.exp) || data.exp <= Math.floor(now / 1000)) fail(401, 'Your staging session expired. Sign in again.');
  return data;
}

function bearer(req) {
  const value = String(req.headers && req.headers.authorization || '');
  return value.startsWith('Bearer ') ? value.slice(7) : '';
}

function requirePreviewAccess(req, env = process.env) {
  if (!previewRequiresAccess(env)) return null;
  secret(env);
  password(env);
  return verify(bearer(req), env);
}

module.exports = { MAX_SECONDS, previewRequiresAccess, checkPassword, sign, verify, requirePreviewAccess };

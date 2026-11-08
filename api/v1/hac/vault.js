/* api/v1/hac/vault.js - remember a student's HAC login without exposing it
 *
 * POST { action: "seal", username, password }
 *   -> { token }  AES-256-GCM encrypted with RRHS_HAC_VAULT_KEY (server-only).
 *      The browser stores only this token, never the password.
 *
 * POST { action: "proxy", token, path, payload }
 *   -> decrypts the token on the server, adds username/password to `payload`,
 *      and forwards to the HAC API (login, student lookup, schedule report only).
 *      The password is never sent back to the browser.
 *
 * Tokens expire after TOKEN_MAX_AGE_DAYS. Rotating RRHS_HAC_VAULT_KEY
 * invalidates every saved token (students just sign in again).
 */

'use strict';

const crypto = require('crypto');

const HAC_API_BASE = 'https://hacapi-hh.vercel.app';
const HAC_BASE_URL = 'https://accesscenter.roundrockisd.org/';
const ALLOWED_PATHS = new Set(['/api/login', '/lookup/students', '/api/getReport', '/api/getSchedule']);
const TOKEN_MAX_AGE_DAYS = 180;
const TOKEN_PREFIX = 'v1.';
const AAD = Buffer.from('rrhs-hac-vault-v1');

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function vaultKey() {
  const raw = String(process.env.RRHS_HAC_VAULT_KEY || '').trim();
  if (!raw) return null;
  const key = Buffer.from(raw, 'base64');
  return key.length === 32 ? key : null;
}

function seal(key, username, password) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(AAD);
  const plain = Buffer.from(JSON.stringify({ u: username, p: password, t: Date.now() }));
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  return TOKEN_PREFIX + Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64url');
}

function unseal(key, token) {
  const s = String(token || '');
  if (!s.startsWith(TOKEN_PREFIX) || s.length > 4096) return null;
  try {
    const buf = Buffer.from(s.slice(TOKEN_PREFIX.length), 'base64url');
    if (buf.length < 12 + 16 + 1) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12));
    decipher.setAAD(AAD);
    decipher.setAuthTag(buf.subarray(12, 28));
    const plain = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
    const data = JSON.parse(plain.toString('utf8'));
    if (!data || !data.u || !data.p) return null;
    if (Date.now() - Number(data.t || 0) > TOKEN_MAX_AGE_DAYS * 86400000) return null;
    return { username: String(data.u), password: String(data.p) };
  } catch (_) {
    return null; // tampered, wrong key, or malformed
  }
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 64 * 1024) throw new Error('Body too large');
  }
  return raw ? JSON.parse(raw) : {};
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  const key = vaultKey();
  if (!key) return sendJson(res, 503, { error: 'Saved logins are not configured' });

  let body;
  try {
    body = await readBody(req);
  } catch (_) {
    return sendJson(res, 400, { error: 'Invalid request' });
  }

  if (body.action === 'seal') {
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    if (!username || !password || username.length > 128 || password.length > 256) {
      return sendJson(res, 400, { error: 'Username and password are required' });
    }
    return sendJson(res, 200, { token: seal(key, username, password) });
  }

  if (body.action === 'proxy') {
    const creds = unseal(key, body.token);
    if (!creds) return sendJson(res, 401, { success: false, error: 'Saved login expired. Please sign in again.' });
    const path = String(body.path || '');
    if (!ALLOWED_PATHS.has(path)) return sendJson(res, 400, { error: 'Unsupported request' });
    const payload = Object.assign({}, body.payload && typeof body.payload === 'object' ? body.payload : {}, {
      username: creds.username,
      password: creds.password,
      base_url: HAC_BASE_URL,
    });
    try {
      const upstream = await fetch(`${HAC_API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: '*/*' },
        body: JSON.stringify(payload),
      });
      const text = await upstream.text();
      res.statusCode = upstream.status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.end(text || '{}');
    } catch (_) {
      return sendJson(res, 502, { error: 'HAC is unavailable right now' });
    }
  }

  return sendJson(res, 400, { error: 'Unknown action' });
};

module.exports._seal = seal;
module.exports._unseal = unseal;

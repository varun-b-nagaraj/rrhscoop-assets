'use strict';

// Exchanges the shared staging password for an eight-hour staging session (ADR 0011).
const access = require('../_lib/staging-auth.cjs');

const FAILURE_DELAY_MS = 600;

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = typeof req.body === 'string' ? req.body : '';
  if (!raw) for await (const chunk of req) { raw += chunk; if (raw.length > 4000) throw Object.assign(new Error('Invalid request.'), { status: 400 }); }
  try { return JSON.parse(raw || '{}'); } catch (_) { throw Object.assign(new Error('Invalid request.'), { status: 400 }); }
}

module.exports = async function handler(req, res, { delay = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  res.setHeader('Access-Control-Allow-Origin', 'https://rrhscoop.roundrockisd.org');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const send = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
  if (req.method === 'OPTIONS') return send(204, {});
  if (req.method !== 'POST') return send(405, { error: 'Method not allowed' });
  if (!access.previewRequiresAccess()) return send(404, { error: 'Staging access is not available here.' });
  try {
    const body = await readBody(req);
    if (body.action !== 'sign-in') return send(400, { error: 'Unknown action' });
    try { access.checkPassword(body.password); }
    catch (error) { if (error.status === 401) await delay(FAILURE_DELAY_MS); throw error; }
    return send(200, { token: access.sign(), expiresIn: access.MAX_SECONDS });
  } catch (error) {
    return send(error.status || 503, { error: error.status ? error.message : 'Staging sign-in is unavailable. Check the Preview environment configuration.' });
  }
};

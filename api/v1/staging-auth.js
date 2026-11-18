'use strict';

const access = require('../_lib/staging-auth.cjs');
const preorder = require('../../teacher-preorders/service');

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = typeof req.body === 'string' ? req.body : '';
  if (!raw) for await (const chunk of req) { raw += chunk; if (raw.length > 16000) throw new Error('too large'); }
  return JSON.parse(raw || '{}');
}

module.exports = async function handler(req, res) {
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
    const email = access.assertTester(body.email);
    if (body.action === 'send-code') {
      const result = await preorder.mailAction('send-code', { email });
      return send(200, { challenge: result.challenge, retryAfter: 60 });
    }
    if (body.action === 'verify-code') {
      if (!/^\d{6}$/.test(body.code || '') || !/^[a-f0-9-]{36}$/i.test(body.challenge || '')) {
        return send(400, { error: 'Enter the six-digit code from your email.' });
      }
      await preorder.mailAction('verify-code', { email, code: body.code, challenge: body.challenge });
      return send(200, { token: access.sign(email), expiresIn: access.MAX_SECONDS, email });
    }
    return send(400, { error: 'Unknown action' });
  } catch (error) {
    return send(error.status || 503, { error: error.status ? error.message : 'Staging sign-in is unavailable. Check the Preview environment configuration.' });
  }
};

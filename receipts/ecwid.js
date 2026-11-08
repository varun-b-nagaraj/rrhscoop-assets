/* receipts/ecwid.js - shared Ecwid + auth helpers for the receipt endpoints */

'use strict';

const crypto = require('crypto');

function config() {
  return {
    storeId: String(process.env.RRHS_ECWID_STORE_ID || '').trim(),
    token: String(process.env.RRHS_ECWID_API_TOKEN || '').trim(),
    apiBase: String(process.env.RRHS_ECWID_API_BASE || 'https://app.ecwid.com/api/v3').trim().replace(/\/+$/, ''),
    secret: String(process.env.RRHS_RECEIPTS_SECRET || '').trim(),
  };
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

// Shared-secret check (header X-Receipts-Secret). Returns true if the request may proceed.
function authorize(req, res, cfg) {
  if (!cfg.secret) {
    sendJson(res, 503, { error: 'RRHS_RECEIPTS_SECRET is not configured' });
    return false;
  }
  if (!cfg.storeId || !cfg.token) {
    sendJson(res, 503, { error: 'Ecwid store ID or token is not configured' });
    return false;
  }
  const given = Buffer.from(String((req.headers && req.headers['x-receipts-secret']) || ''));
  const expected = Buffer.from(cfg.secret);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return false;
  }
  return true;
}

async function ecwidFetch(cfg, path) {
  return fetch(`${cfg.apiBase}/${encodeURIComponent(cfg.storeId)}${path}`, {
    headers: { Authorization: `Bearer ${cfg.token}` },
    redirect: 'follow',
  });
}

async function ecwidJson(cfg, path) {
  const resp = await ecwidFetch(cfg, path);
  if (!resp.ok) throw new Error(`Ecwid ${path.split('?')[0]} responded ${resp.status}`);
  return resp.json();
}

function requestOrigin(req) {
  const proto = String((req.headers && req.headers['x-forwarded-proto']) || 'https').split(',')[0].trim();
  const host = (req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || 'rrhscoop-assets.vercel.app';
  return `${proto}://${host}`;
}

// Ecwid order IDs look like "ORDAKTLL"; internal numeric IDs are also accepted.
function isOrderId(value) {
  return /^[A-Za-z0-9]{1,32}$/.test(String(value || ''));
}

module.exports = { config, sendJson, authorize, ecwidFetch, ecwidJson, requestOrigin, isOrderId };

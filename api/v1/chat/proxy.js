'use strict';

const DEFAULT_UPSTREAM = 'https://v2-chatbot.vercel.app/chat';
const DEFAULT_BEARER = '5e7571d3a600120047e5ce906c1bdf08f72a95b8c4d37f75cfdf847b10f79c5a';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
}

function getHeader(req, name) {
  const headers = req && req.headers ? req.headers : {};
  const key = String(name || '').toLowerCase();
  return headers[key];
}

async function readRawBody(req) {
  if (req && typeof req.body === 'string') return req.body;
  if (req && req.body && typeof req.body === 'object') return JSON.stringify(req.body);

  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const upstreamUrl = (process.env.RRHS_CHAT_UPSTREAM_URL || DEFAULT_UPSTREAM).trim();
  const explicitAuth = getHeader(req, 'authorization');
  const bearer = (process.env.RRHS_CHAT_BEARER_TOKEN || DEFAULT_BEARER).trim();
  const authHeader = explicitAuth && explicitAuth.trim() ? explicitAuth : `Bearer ${bearer}`;

  let rawBody = '';
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: `Invalid request body: ${err.message || err}` }));
    return;
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': getHeader(req, 'content-type') || 'application/json',
        Authorization: authHeader
      },
      body: rawBody || '{}'
    });

    res.statusCode = upstream.status;
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    if (!upstream.body) {
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: `Upstream request failed: ${err.message || err}` }));
  }
};

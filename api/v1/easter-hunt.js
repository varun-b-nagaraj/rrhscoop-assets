'use strict';
// Public deployment stays closed even if a browser changes its feature flags.
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const query = new URL(req.url || '/', 'https://rrhscoop-assets.vercel.app').searchParams;
  if (req.method === 'POST') {
    let body = req.body;
    try {
      if (body == null) { let raw = ''; for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 2048) throw new Error(); } body = JSON.parse(raw || '{}'); }
      else if (typeof body === 'string') { if (Buffer.byteLength(body) > 2048) throw new Error(); body = JSON.parse(body); }
    } catch (_) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'Invalid preview request.' })); }
    if (body?.action === 'send-preview') {
      const origin = req.headers?.origin;
      if (origin && !['https://rrhscoop-assets.vercel.app', 'https://rrhscoop.roundrockisd.org'].includes(origin) && !(process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))) {
        res.statusCode = 403; return res.end(JSON.stringify({ error: 'Open the CO-OP preview to continue.' }));
      }
      if (body.studentId !== 's151579' || ![10,15,20,25,35].includes(body.percentage) || !/^PREVIEW-[A-F0-9]{12}$/.test(body.reference || '')) {
        res.statusCode = 400; return res.end(JSON.stringify({ error: 'Real preview delivery is currently limited to the presenter mailbox.' }));
      }
      try {
        await require('../../teacher-preorders/service').mailAction('send-hunt-preview', { studentId: body.studentId, percentage: body.percentage, reference: body.reference });
        res.statusCode = 200; return res.end(JSON.stringify({ ok: true, emailStatus: 'sent' }));
      } catch (error) {
        res.statusCode = error.status === 429 ? 429 : 503;
        const message = /Unknown action/i.test(error.message || '') ? 'Update the CO-OP Apps Script web-app deployment to enable preview emails. Your preview is saved.' : 'Preview email could not be confirmed. Check your inbox; your saved reward is available in the dashboard.';
        return res.end(JSON.stringify({ error: message }));
      }
    }
  }
  if (req.method === 'GET' && query.get('view') === 'email-template') {
    const percentage = Number(query.get('percentage'));
    if (![10, 15, 20, 25, 35].includes(percentage)) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'Choose a valid preview percentage.' })); }
    const email = require('../../easter-hunt/email-preview')(percentage);
    res.statusCode = 200; return res.end(JSON.stringify(email));
  }
  res.statusCode = req.method === 'GET' ? 200 : 503;
  res.end(JSON.stringify(req.method === 'GET'
    ? { mode: 'disabled', status: 'disabled', remaining: 0, eggs: [] }
    : { error: 'The hidden package hunt is not open yet.' }));
};

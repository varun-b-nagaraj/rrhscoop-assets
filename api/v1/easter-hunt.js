'use strict';
// The hunt runs only while RRHS_HUNT_ENABLED is 'true' in Vercel. Browsers cannot override it.
const huntEnabled = () => String(process.env.RRHS_HUNT_ENABLED || '').trim().toLowerCase() === 'true';
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const origin = req.headers?.origin;
  const allowedOrigin = !origin || ['https://rrhscoop-assets.vercel.app', 'https://rrhscoop.roundrockisd.org'].includes(origin) ||
    (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin));
  res.setHeader('Vary', 'Origin');
  if (!allowedOrigin) { res.statusCode = 403; return res.end(JSON.stringify({ error: 'Open the CO-OP website to continue.' })); }
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // JSON requests from the school storefront preflight before sending any mail.
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  const query = new URL(req.url || '/', 'https://rrhscoop-assets.vercel.app').searchParams;
  if (req.method === 'POST') {
    let body = req.body;
    try {
      if (body == null) { let raw = ''; for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 2048) throw new Error(); } body = JSON.parse(raw || '{}'); }
      else if (typeof body === 'string') { if (Buffer.byteLength(body) > 2048) throw new Error(); body = JSON.parse(body); }
    } catch (_) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'Invalid request.' })); }
    if (body?.action === 'claim') {
      if (!huntEnabled()) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'The hidden package hunt is not open yet.' })); }
      if (typeof body.studentId !== 'string' || typeof body.eggId !== 'string' || typeof body.idempotencyKey !== 'string') { res.statusCode = 400; return res.end(JSON.stringify({ error: 'Please reopen the package and try again.' })); }
      try {
        const result = await require('../../teacher-preorders/service').mailAction('hunt-claim', { studentId: body.studentId, eggId: body.eggId, idempotencyKey: body.idempotencyKey });
        res.statusCode = 200;
        return res.end(JSON.stringify({ mode: 'live', percentage: result.percentage, email: result.email, emailStatus: result.emailStatus, expiresAt: result.expiresAt }));
      } catch (error) {
        res.statusCode = [400, 409, 429].includes(error.status) && !/Unknown action/i.test(error.message || '') ? error.status : 503;
        return res.end(JSON.stringify({ error: res.statusCode === 503 ? 'We couldn’t open this package just now. Please try again in a minute.' : error.message }));
      }
    }
    // Dashboard: sign in with an emailed code, then read the log or pause the hunt.
    const admin = { 'admin-code': ['hunt-admin-code', ['email']], 'admin-verify': ['hunt-admin-verify', ['email', 'code']],
      'admin-log': ['hunt-admin-log', ['token']], 'admin-pause': ['hunt-admin-pause', ['token']], 'admin-resume': ['hunt-admin-resume', ['token']] }[body?.action];
    // Screenshots reveal where stickers hide, so they are served only to a signed-in admin.
    if (body?.action === 'admin-location') {
      const spot = require('../../easter-hunt/config').locations.find(location => location.id === body.id);
      if (!spot) { res.statusCode = 404; return res.end(JSON.stringify({ error: 'Unknown sticker.' })); }
      try { await require('../../teacher-preorders/service').mailAction('hunt-admin-check', { token: typeof body.token === 'string' ? body.token.slice(0, 200) : '' }); }
      catch (error) { res.statusCode = error.status === 401 ? 401 : 503; return res.end(JSON.stringify({ error: error.status === 401 ? error.message : 'The CO-OP Apps Script is unavailable.' })); }
      try {
        const image = require('node:fs').readFileSync(require('node:path').join(__dirname, '_hunt-locations', spot.id + '.jpg'));
        res.statusCode = 200; return res.end(JSON.stringify({ image: 'data:image/jpeg;base64,' + image.toString('base64') }));
      } catch (_) { res.statusCode = 404; return res.end(JSON.stringify({ error: 'No screenshot for this sticker yet.' })); }
    }
    if (admin) {
      if (origin && origin !== 'https://rrhscoop-assets.vercel.app' && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) { res.statusCode = 403; return res.end(JSON.stringify({ error: 'Open the hunt dashboard to continue.' })); }
      const payload = Object.fromEntries(admin[1].map(key => [key, typeof body[key] === 'string' ? body[key].slice(0, 200) : '']));
      try {
        const { ok, ...result } = await require('../../teacher-preorders/service').mailAction(admin[0], payload);
        res.statusCode = 200; return res.end(JSON.stringify(result));
      } catch (error) {
        res.statusCode = [400, 401, 429].includes(error.status) && !/Unknown action/i.test(error.message || '') ? error.status : 503;
        return res.end(JSON.stringify({ error: res.statusCode === 503 ? 'The CO-OP Apps Script is unavailable. Update its web-app deployment to the newest version.' : error.message }));
      }
    }
  }
  if (req.method === 'GET' && query.get('view') === 'email-template') {
    const percentage = Number(query.get('percentage'));
    if (![10, 15, 20, 25, 35].includes(percentage)) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'Choose a valid preview percentage.' })); }
    const email = require('../../easter-hunt/email-preview')(percentage);
    res.statusCode = 200; return res.end(JSON.stringify(email));
  }
  if (req.method === 'GET' && huntEnabled()) {
    // Every open tab polls every 5 seconds; Vercel's edge answers most of them, at most 2 seconds old.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=2, stale-while-revalidate=2');
    try {
      const { mode, status, expiresAt, remaining, eggs } = await require('../../teacher-preorders/service').mailAction('hunt-availability', {});
      res.statusCode = 200; return res.end(JSON.stringify({ mode, status, expiresAt, remaining, eggs }));
    } catch (_) {
      res.setHeader('Cache-Control', 'no-store');
      res.statusCode = 200; return res.end(JSON.stringify({ mode: 'live', status: 'unavailable', remaining: null, eggs: [] }));
    }
  }
  if (req.method === 'GET') res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=60');
  res.statusCode = req.method === 'GET' ? 200 : 503;
  res.end(JSON.stringify(req.method === 'GET'
    ? { mode: 'disabled', status: 'disabled', remaining: 0, eggs: [] }
    : { error: 'The hidden package hunt is not open yet.' }));
};

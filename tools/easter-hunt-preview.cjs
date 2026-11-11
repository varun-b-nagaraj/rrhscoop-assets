'use strict';
// Local tooling for the existing storefront. Binds loopback, never loads .env.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createPreview, fail } = require('../easter-hunt/service');
const previewEmail = require('../easter-hunt/email-preview');
const config = require('../easter-hunt/config');
const root = path.resolve(__dirname, '..');
const loopbacks = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
async function body(req) {
  let text = '';
  for await (const chunk of req) { text += chunk; if (Buffer.byteLength(text) > 2048) fail(413, 'Request too large.'); }
  try { return JSON.parse(text || '{}'); } catch (_) { fail(400, 'Check the request and try again.'); }
}
function createServer({ preview = createPreview({ singleEggOnly: !config.DEV_ALL_EGGS_ENABLED }) } = {}) {
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, value) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
    try {
      // Validate Host as well as peer, to resist DNS rebinding against local tools.
      const host = new URL('http://' + req.headers.host);
      if (!config.DEV_PREVIEW_ENABLED || process.env.NODE_ENV === 'production' || !loopbacks.has(req.socket.remoteAddress) || !['localhost', '127.0.0.1', '[::1]'].includes(host.hostname)) fail(403, 'Preview is available only on this computer.');
      const url = new URL(req.url, host.origin);
      if (req.headers.origin && req.headers.origin !== host.origin) fail(403, 'Open the local preview to continue.');
      if (req.headers['sec-fetch-site'] === 'cross-site') fail(403, 'Open the local preview to continue.');
      if (url.pathname === '/api/v1/easter-hunt') {
        if (req.method === 'GET') return send(200, preview.availability());
        if (req.method !== 'POST') return send(405, { error: 'Method not allowed' });
        const input = await body(req);
        if (input.action !== 'claim') fail(400, 'Unknown preview action.');
        return send(200, preview.claim(input, req.socket.remoteAddress));
      }
      if (url.pathname === '/api/v1/easter-hunt/admin') {
        if (req.method === 'GET') return send(200, preview.stats());
        if (req.method === 'POST') return send(200, preview.admin(await body(req)));
        return send(405, { error: 'Method not allowed' });
      }
      if (url.pathname === '/easter-hunt/email-preview') {
        if (req.method !== 'GET') return send(405, { error: 'Method not allowed' });
        const email = previewEmail(Number(url.searchParams.get('percentage') || 35));
        res.setHeader('Content-Type', url.searchParams.has('text') ? 'text/plain; charset=utf-8' : 'text/html; charset=utf-8');
        return res.end(url.searchParams.has('text') ? email.text : email.html);
      }
      if (!['GET', 'HEAD'].includes(req.method)) return send(405, { error: 'Method not allowed' });
      const pathname = url.pathname === '/' ? '/tools/easter-hunt/index.html' : decodeURIComponent(url.pathname);
      // Serve only the storefront assets needed by the preview. Never serve source,
      // .env, Apps Script, tests, or the rest of the developer's filesystem.
      const allowed = /^(?:\/iframes\/|\/custom-visuals\/|\/easter-hunt\/|\/tools\/easter-hunt\/)/.test(pathname);
      const file = path.resolve(root, '.' + pathname);
      const ext = path.extname(file);
      const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
      if (!allowed || !file.startsWith(root + path.sep) || pathname.split('/').some(part => part.startsWith('.')) || !types[ext]) fail(404, 'Not found');
      if (pathname.startsWith('/easter-hunt/') && !['boot.js', 'config.js', 'hunt.js', 'hunt.css'].includes(path.basename(file))) fail(404, 'Not found');
      const content = await fs.readFile(file);
      res.setHeader('Content-Type', types[ext] + (['.html', '.js', '.css'].includes(ext) ? '; charset=utf-8' : ''));
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      send(error.status || (error.code === 'ENOENT' ? 404 : 500), { error: error.status ? error.message : 'Preview request could not be completed.' });
    }
  });
}
if (require.main === module) {
  if (process.env.NODE_ENV === 'production') throw new Error('Development preview cannot run in production');
  createServer().listen(4173, '127.0.0.1', () => console.log('Hunt preview: http://127.0.0.1:4173 (no coupons or emails)'));
}
module.exports = { createServer };

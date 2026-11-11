'use strict';
// Public deployment stays closed even if a browser changes its feature flags.
module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const query = new URL(req.url || '/', 'https://rrhscoop-assets.vercel.app').searchParams;
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

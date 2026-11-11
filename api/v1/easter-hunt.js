'use strict';
// Public deployment stays closed even if a browser changes its feature flags.
module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = req.method === 'GET' ? 200 : 503;
  res.end(JSON.stringify(req.method === 'GET'
    ? { mode: 'disabled', status: 'disabled', remaining: 0, eggs: [] }
    : { error: 'The hidden package hunt is not open yet.' }));
};

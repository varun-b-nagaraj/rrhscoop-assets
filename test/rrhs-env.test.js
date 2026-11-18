'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { detect } = require('../rrhs-env');
const vercel = require('../vercel.json');

const STAGING = 'https://rrhscoop-staging.vercel.app';
const PROD = 'https://rrhscoop-assets.vercel.app';

test('a plain visit is prod, even right after a redirect from company.site', () => {
  assert.equal(detect({ search: '' }), 'prod');
  assert.equal(detect({ search: '?x=1' }), 'prod');
});

test('?rrhs_env= starts or ends staging', () => {
  assert.equal(detect({ search: '?rrhs_env=staging' }), 'staging');
  assert.equal(detect({ search: '?rrhs_env=prod', stored: 'staging' }), 'prod');
});

test('staging sticks for the tab once started', () => {
  assert.equal(detect({ search: '', stored: 'staging' }), 'staging');
  assert.equal(detect({ search: '?rrhs_env=nonsense', stored: 'staging' }), 'staging');
});

test('duplicated and restored tabs follow the browser sessionStorage copy', () => {
  assert.equal(detect({ search: '', stored: 'staging' }), 'staging');
  assert.equal(detect({ search: '', stored: null }), 'prod');
});

test('the staging hosts redirect their root to the store with the staging marker', () => {
  const hosts = vercel.redirects.filter(r => r.source === '/').map(r => r.has[0].value);
  assert.deepEqual(hosts.sort(), ['rrhscoop-staging.roundrockisd.org', 'rrhscoop-staging.vercel.app']);
  for (const r of vercel.redirects) {
    assert.equal(r.destination, 'https://rrhscoop.roundrockisd.org/?rrhs_env=staging');
    assert.equal(r.permanent, false);
  }
});

// Runs index.js against a fake page and reports which scripts it added.
function runIndex({ scriptSrc, search = '', stored = null, window = {} }) {
  const added = [];
  const el = () => ({ classList: { add() {}, remove() {} }, setAttribute() {}, appendChild(node) { added.push(node); } });
  const head = el();
  const doc = {
    currentScript: { src: scriptSrc },
    documentElement: el(),
    head,
    readyState: 'complete',
    createElement: () => ({}),
    getElementById: () => null,
    querySelector: () => null,
    addEventListener() {}
  };
  runInNewContext(readFileSync(require.resolve('../index.js'), 'utf8'), {
    window, document: doc, URL, URLSearchParams, Promise, Date,
    location: { search },
    sessionStorage: { getItem: k => (k === 'rrhs_env' ? stored : null) },
    setTimeout: () => 0, clearTimeout() {}
  });
  return added.filter(n => n.src).map(n => n.src);
}

test('production index.js hands a staging tab off to the staging deployment', () => {
  assert.deepEqual(runIndex({ scriptSrc: `${PROD}/index.js`, search: '?rrhs_env=staging' }), [`${STAGING}/index.js`]);
  assert.deepEqual(runIndex({ scriptSrc: `${PROD}/index.js`, stored: 'staging' }), [`${STAGING}/index.js`]);
});

test('production index.js loads its own scripts for prod tabs', () => {
  for (const opts of [{}, { search: '?rrhs_env=prod', stored: 'staging' }]) {
    const srcs = runIndex({ scriptSrc: `${PROD}/index.js`, ...opts });
    assert.ok(srcs.length > 5);
    assert.ok(srcs.every(src => src.startsWith(`${PROD}/`)));
  }
});

test('the staging index.js loads everything from the staging deployment', () => {
  const srcs = runIndex({ scriptSrc: `${STAGING}/index.js`, stored: 'staging' });
  assert.ok(srcs.length > 5);
  assert.ok(srcs.every(src => src.startsWith(`${STAGING}/`)));
  assert.ok(srcs[0].startsWith(`${STAGING}/rrhs-env.js`));
});

test('both loaders include centralized deployment routing from their own origin', () => {
  const staging = runIndex({ scriptSrc: `${STAGING}/index.js`, stored: 'staging' });
  const prod = runIndex({ scriptSrc: `${PROD}/index.js` });
  assert.ok(staging.includes(`${STAGING}/rrhs-deployment.js?v=1`));
  assert.ok(prod.includes(`${PROD}/rrhs-deployment.js?v=1`));
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { detect, PROD_HOST } = require('../rrhs-env');

const direct = { type: 'navigate', redirectCount: 0, fetchStart: 0 };
const viaCompanySite = { type: 'navigate', redirectCount: 0, fetchStart: 449.8 };

test('a direct visit to the prod domain is prod', () => {
  assert.equal(detect({ hostname: PROD_HOST, search: '', nav: direct }).env, 'prod');
  assert.equal(detect({ hostname: PROD_HOST, search: '', nav: { ...direct, fetchStart: 4 } }).env, 'prod');
});

test('arriving through the company.site redirect is staging', () => {
  assert.deepEqual(detect({ hostname: PROD_HOST, search: '', nav: viaCompanySite }), { env: 'staging', reason: 'redirect' });
});

test('reloads, back/forward and same-origin redirects do not count as the redirect', () => {
  for (const nav of [{ ...viaCompanySite, type: 'reload' }, { ...viaCompanySite, type: 'back_forward' }, { ...viaCompanySite, redirectCount: 1 }, null]) {
    assert.equal(detect({ hostname: PROD_HOST, search: '', nav }).env, 'prod');
  }
});

test('staging sticks for the tab once detected', () => {
  assert.deepEqual(detect({ hostname: PROD_HOST, search: '', nav: direct, stored: 'staging' }), { env: 'staging', reason: 'session' });
});

test('?rrhs_env= forces either environment', () => {
  assert.equal(detect({ hostname: PROD_HOST, search: '?rrhs_env=staging', nav: direct }).env, 'staging');
  assert.equal(detect({ hostname: PROD_HOST, search: '?rrhs_env=prod', nav: viaCompanySite, stored: 'staging' }).env, 'prod');
});

test('only the prod host is checked for the redirect', () => {
  assert.equal(detect({ hostname: 'localhost', search: '', nav: viaCompanySite }).env, 'prod');
});

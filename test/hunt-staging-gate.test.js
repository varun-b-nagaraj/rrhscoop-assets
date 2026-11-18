'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const boot = readFileSync(require.resolve('../easter-hunt/boot.js'), 'utf8');
const hunt = readFileSync(require.resolve('../easter-hunt/hunt.js'), 'utf8');
const css = readFileSync(require.resolve('../easter-hunt/hunt.css'), 'utf8');

test('each deployed browser hunt follows its own API status', () => {
  assert.match(boot, /RRHS_DEPLOYMENT\?\.fetch\('\/api\/v1\/easter-hunt'/);
  assert.match(boot, /result\.status !== 'disabled'/);
  assert.doesNotMatch(boot, /Promise\.resolve\(stagingPreview \|\| localPreview\)/);
  assert.match(hunt, /RRHS_DEPLOYMENT\.fetch\(path, options\)/);
});

test('URL and console dev-mode controls are gone', () => {
  for (const source of [boot, hunt]) {
    assert.doesNotMatch(source, /hunt-dev|RRHS_HUNT_DEV|window\.rrhsHunt/);
  }
  assert.doesNotMatch(css, /hunt-dev-badge/);
});

test('staging claims use the real environment-specific API', () => {
  assert.doesNotMatch(hunt, /STAGING_STATE|FAKE-|devRequest/);
  assert.match(hunt, /method: data \? 'POST' : 'GET'/);
  assert.match(hunt, /Authorization|RRHS_DEPLOYMENT/);
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const boot = readFileSync(require.resolve('../easter-hunt/boot.js'), 'utf8');
const hunt = readFileSync(require.resolve('../easter-hunt/hunt.js'), 'utf8');
const css = readFileSync(require.resolve('../easter-hunt/hunt.css'), 'utf8');

test('the deployed browser hunt starts only from the marked staging deployment', () => {
  assert.match(boot, /base\.origin === STAGING_ORIGIN && window\.RRHS_ENVIRONMENT === 'staging'/);
  assert.match(boot, /const status = Promise\.resolve\(stagingPreview \|\| localPreview\)/);
  assert.doesNotMatch(boot, /fetch\([^\n]*easter-hunt/);
  assert.match(hunt, /assetOrigin === 'https:\/\/rrhscoop-staging\.vercel\.app' && window\.RRHS_ENVIRONMENT === 'staging'/);
  assert.match(hunt, /const staging = \(\) => stagingPreview/);
  assert.doesNotMatch(hunt, /const staging = \(\) => window\./);
});

test('URL and console dev-mode controls are gone', () => {
  for (const source of [boot, hunt]) {
    assert.doesNotMatch(source, /hunt-dev|RRHS_HUNT_DEV|window\.rrhsHunt/);
  }
  assert.doesNotMatch(css, /hunt-dev-badge/);
});

test('staging claims are fake and scoped to the tab', () => {
  assert.match(hunt, /sessionStorage\.getItem\(STAGING_STATE\)/);
  assert.match(hunt, /sessionStorage\.setItem\(STAGING_STATE/);
  assert.match(hunt, /mode: 'staging'/);
  assert.match(hunt, /const code = 'FAKE-'/);
});

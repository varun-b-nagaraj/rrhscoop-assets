'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const workflow = readFileSync(require.resolve('../.github/workflows/promote-to-production.yml'), 'utf8');

test('promotion dispatch is guarded to trusted main and an exact full SHA', () => {
  assert.match(workflow, /test "\$DISPATCH_REF" = refs\/heads\/main/);
  assert.match(workflow, /test "\$\{#RELEASE_SHA\}" -eq 40/);
  assert.match(workflow, /test "\$RELEASE_SHA" = "\$main_sha"/);
  assert.match(workflow, /ref: refs\/heads\/main/);
});

test('main is revalidated after approval and production only fast-forwards', () => {
  assert.match(workflow, /environment: Production/);
  assert.match(workflow, /test "\$VALIDATED_SHA" = "\$current_main"/);
  assert.match(workflow, /git merge-base --is-ancestor origin\/production "\$current_main"/);
  assert.match(workflow, /git push origin "\$current_main:refs\/heads\/production"/);
  assert.doesNotMatch(workflow, /force|--force/);
});

test('only the approved production job can mint the narrow App token', () => {
  assert.match(workflow, /actions\/create-github-app-token@[0-9a-f]{40}/);
  assert.match(workflow, /permission-contents: write/);
  assert.match(workflow, /PRODUCTION_APP_ID/);
  assert.match(workflow, /PRODUCTION_APP_PRIVATE_KEY/);
  assert.match(workflow, /permissions:\n\s+contents: read/);
  assert.doesNotMatch(workflow, /permissions:\n\s+contents: write/);
});

test('level 2 repeats CI and uses read-only deployed smoke checks', () => {
  for (const command of ['lint', 'check:secrets', 'check:config', 'test:unit', 'test:integration', 'test:browser']) {
    assert.match(workflow, new RegExp(`npm run ${command.replace(':', '\\:')}`));
  }
  assert.match(workflow, /npm test/);
  assert.match(workflow, /SMOKE_URL: https:\/\/rrhscoop-staging\.vercel\.app/);
  assert.match(workflow, /SMOKE_URL: https:\/\/rrhscoop-assets\.vercel\.app/);
  assert.doesNotMatch(workflow, /hunt:migrate|hunt:reset|discount_coupons|send-code|place-order/);
});

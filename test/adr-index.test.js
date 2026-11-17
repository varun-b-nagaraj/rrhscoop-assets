'use strict';
// Runs the ADR check (ADR 0000) as part of `npm test`, so it runs before every
// commit and in the Promote to production workflow.
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('every ADR is indexed, well-formed, and names only files that exist', () => {
  const script = path.join(__dirname, '..', 'ops', 'scripts', 'adr-index-check.sh');
  const result = spawnSync('bash', [script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

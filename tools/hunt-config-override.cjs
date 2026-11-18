'use strict';
// Tests and the isolated Neon check override easter-hunt/config.js in memory. Production code reads
// the switch and dates only from that file (ADR 0012), so this is the one way to vary them.
const path = require.resolve('../easter-hunt/config');
const original = require(path);

function setHuntConfig(overrides = {}) {
  require.cache[path].exports = Object.freeze({ ...original, ...overrides });
}

async function withHuntConfig(overrides, fn) {
  const before = require.cache[path].exports;
  setHuntConfig({ ...before, ...overrides });
  try { return await fn(); } finally { require.cache[path].exports = before; }
}

module.exports = { setHuntConfig, withHuntConfig };

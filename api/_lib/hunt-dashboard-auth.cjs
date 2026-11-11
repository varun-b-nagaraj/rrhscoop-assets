'use strict';
const crypto = require('node:crypto');
// The dashboard password is configured here as a hash, not in environment variables.
const SALT = 'a6dae39f8f5de10bca2b40d936fde5c1';
const HASH = '2122944cc6463c3a29c71d5e15f6428c887284cd43b607b97ddd86d370812a0fd3ac89a5e27053eab97cca41ca6fc0f10fdf9820ac99c9710011413d515097a8';
function matchesPassword(value) {
  if (typeof value !== 'string' || value.length > 128) return false;
  const actual = crypto.scryptSync(value, SALT, 64);
  return crypto.timingSafeEqual(actual, Buffer.from(HASH, 'hex'));
}
module.exports = { matchesPassword };

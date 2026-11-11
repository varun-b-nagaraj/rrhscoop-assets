'use strict';
const crypto = require('node:crypto');
const config = require('./config');
const DISTRIBUTION = Object.freeze([10, 10, 10, 10, 15, 15, 15, 20, 20, 25, 25, 35]);
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function normalizeStudent(value) {
  if (typeof value !== 'string' || !/^s\d{4,10}$/i.test(value.trim())) fail(400, 'Enter your S-number including the s, for example s123456.');
  return value.trim().toLowerCase();
}
// Input is eligible merchandise in cents, with taxes, fees and delivery excluded.
function discountCents(percentage, eligibleCents) {
  if (!DISTRIBUTION.includes(percentage) || !Number.isSafeInteger(eligibleCents) || eligibleCents < 0) throw new TypeError('Invalid eligible merchandise subtotal');
  return Math.round(percentage * Math.min(eligibleCents, 2500) / 100);
}

// A single-process simulator only. Never used for production inventory or fulfillment.
function createPreview({ now = Date.now, randomInt = crypto.randomInt, singleEggOnly = false } = {}) {
  const salt = crypto.randomBytes(32);
  let pool, claims, students, eggs, audit, paused, disabled, limits;
  function reset() {
    pool = [...DISTRIBUTION]; claims = new Map(); students = new Set(); eggs = new Set();
    audit = []; paused = false;
    disabled = new Set(singleEggOnly ? config.locations.filter(egg => egg.id !== 'inventory-intelligence').map(egg => egg.id) : []);
    limits = new Map();
  }
  reset();
  const hash = value => crypto.createHmac('sha256', salt).update(value).digest('hex');
  function status() {
    if (now() >= Date.parse(config.expiresAt)) return 'expired';
    if (now() < Date.parse(config.startsAt)) return 'scheduled';
    if (paused) return 'paused';
    return pool.length ? 'active' : 'sold_out';
  }
  function availability() {
    return { mode: 'preview', status: status(), expiresAt: config.expiresAt, remaining: pool.length,
      eggs: config.locations.map(({ id }) => ({ id, available: status() === 'active' && !eggs.has(id) && !disabled.has(id) })) };
  }
  function rateLimit(key) {
    const bucket = Math.floor(now() / 60000);
    // Only salted keys retained, for at most one minute.
    for (const [id, record] of limits) if (record.bucket !== bucket) limits.delete(id);
    const id = hash(key), record = limits.get(id) || { bucket, count: 0 };
    if (++record.count > 15) fail(429, 'Please wait a minute before trying again.');
    limits.set(id, record);
  }
  function claim(input, client = 'local') {
    rateLimit('client:' + client);
    const studentId = normalizeStudent(input.studentId);
    const student = hash(studentId);
    rateLimit('student:' + student);
    if (typeof input.idempotencyKey !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.idempotencyKey)) fail(400, 'Please reopen the package and try again.');
    const key = input.idempotencyKey;
    const previous = claims.get(key);
    if (previous) {
      if (previous.student !== student || previous.eggId !== input.eggId) fail(409, 'Please reopen the package and try again.');
      return result(previous, studentId);
    }
    if (status() !== 'active') fail(409, status() === 'expired' ? 'The hunt has ended. Thanks for exploring!' : 'The packages are resting right now. Please try again later.');
    if (!config.locations.some(egg => egg.id === input.eggId) || disabled.has(input.eggId)) fail(409, 'This package is unavailable. Keep exploring!');
    // Same public response for duplicate students and lost egg races.
    if (students.has(student) || eggs.has(input.eggId)) fail(409, 'This package could not be claimed. You may already have a reward, or another Dragon got here first.');
    // No await between checks and writes: atomic within this local simulator.
    const index = randomInt(pool.length);
    const percentage = pool.splice(index, 1)[0];
    const record = { id: crypto.randomUUID(), student, eggId: input.eggId, percentage, emailStatus: 'simulated', createdAt: new Date(now()).toISOString() };
    students.add(student); eggs.add(input.eggId); claims.set(key, record);
    audit.push({ claimId: record.id, action: 'preview.claimed', eggId: record.eggId, at: record.createdAt });
    return result(record, studentId);
  }
  function result(record, studentId) {
    return { mode: 'preview', claimId: record.id, percentage: record.percentage, name: 'Dragon',
      // This address is a simulation, never directory verification or a recipient for a send.
      email: studentId + '@student.roundrockisd.org', emailStatus: record.emailStatus, couponStatus: 'not_created', expiresAt: config.expiresAt };
  }
  function stats() {
    return { ...availability(), total: 12, claims: claims.size, couponsIssued: 0, couponsRedeemed: 0,
      emailsSent: 0, failedEmails: [...claims.values()].filter(c => c.emailStatus === 'failed').length,
      remainingDistribution: Object.fromEntries([10, 15, 20, 25, 35].map(p => [p, pool.filter(v => v === p).length])),
      maximumSimulatedLiabilityCents: [...claims.values()].reduce((sum, c) => sum + discountCents(c.percentage, 2500), 0), audit };
  }
  function admin(input) {
    if (input.action === 'pause') paused = true;
    else if (input.action === 'resume') paused = false;
    else if (['disable', 'enable'].includes(input.action)) {
      if (!config.locations.some(e => e.id === input.eggId)) fail(400, 'Unknown package.');
      if (input.action === 'disable') disabled.add(input.eggId); else disabled.delete(input.eggId);
    } else if (['fail-email', 'retry-email'].includes(input.action)) {
      const record = [...claims.values()].find(c => c.id === input.claimId);
      if (!record) fail(404, 'Preview claim not found.');
      record.emailStatus = input.action === 'fail-email' ? 'failed' : 'simulated';
    } else if (input.action === 'reset') { reset(); return stats(); }
    else fail(400, 'Unknown preview action.');
    audit.push({ action: 'preview.' + input.action, at: new Date(now()).toISOString() });
    return stats();
  }
  return { availability, claim, stats, admin };
}
module.exports = { DISTRIBUTION, normalizeStudent, discountCents, createPreview, fail };

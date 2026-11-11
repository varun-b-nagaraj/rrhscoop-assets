/* Personal presentation data only. Never a coupon or student identity authority. */
(function (root) {
  'use strict';
  const KEY = 'rrhs-hunt-personal-demo-v1';
  const POOL = [10, 10, 10, 10, 15, 15, 15, 20, 20, 25, 25, 35];
  function createDemoStore({ storage, crypto, config, now = Date.now }) {
    const fail = message => { throw new Error(message); };
    const empty = () => ({ version: 1, updatedAt: 0, paused: false, records: [] });
    function validate(state) {
      if (!state || state.version !== 1 || !Array.isArray(state.records) || state.records.length > 12 || !Number.isFinite(state.updatedAt) || typeof state.paused !== 'boolean') fail('The saved demo could not be read. Export or clear it from the dashboard.');
      const students = new Set(), eggs = new Set(), keys = new Set(), ids = new Set(), remaining = [...POOL];
      for (const r of state.records) {
        if (!r || !/^s\d{4,10}$/.test(r.studentId) || !config.locations.some(e => e.id === r.eggId) ||
            !/^[a-f0-9-]{36}$/i.test(r.id) || !/^[a-f0-9-]{36}$/i.test(r.idempotencyKey) ||
            !/^PREVIEW-[A-F0-9]{12}$/.test(r.reference) || !Number.isFinite(Date.parse(r.createdAt)) ||
            students.has(r.studentId) || eggs.has(r.eggId) || keys.has(r.idempotencyKey) || ids.has(r.id) || !remaining.includes(r.percentage)) fail('The saved demo could not be read. Export or clear it from the dashboard.');
        students.add(r.studentId); eggs.add(r.eggId); keys.add(r.idempotencyKey); ids.add(r.id);
        remaining.splice(remaining.indexOf(r.percentage), 1);
      }
      return state;
    }
    function snapshot() {
      let value;
      try { value = storage.getItem(KEY); } catch (_) { fail('Browser storage is unavailable. Allow site storage to use the presentation demo.'); }
      if (!value) return empty();
      try { return validate(JSON.parse(value)); } catch (_) { fail('The saved demo could not be read. Export or clear it from the dashboard.'); }
    }
    function write(state) {
      validate(state); state.updatedAt = now();
      try { storage.setItem(KEY, JSON.stringify(state)); } catch (_) { fail('This browser could not save the demo. Free some site storage and try again.'); }
      return state;
    }
    function status(state) {
      if (now() >= Date.parse(config.expiresAt)) return 'expired';
      if (now() < Date.parse(config.startsAt)) return 'scheduled';
      if (state.paused) return 'paused';
      return state.records.length === 12 ? 'sold_out' : 'active';
    }
    function availability() {
      const state = snapshot(), current = status(state);
      return { mode: 'preview', status: current, remaining: 12 - state.records.length, expiresAt: config.expiresAt,
        eggs: config.locations.map(({ id }) => ({ id, available: current === 'active' &&
          (config.DEV_ALL_EGGS_ENABLED || id === 'inventory-intelligence') && !state.records.some(r => r.eggId === id) })) };
    }
    function publicResult(record) {
      // The website never receives the dashboard's preview reference as a coupon code.
      return { mode: 'preview', claimId: record.id, percentage: record.percentage, name: 'Dragon',
        email: record.studentId + '@student.roundrockisd.org', emailStatus: 'simulated', couponStatus: 'not_created', expiresAt: config.expiresAt };
    }
    function claim(input) {
      const studentId = typeof input.studentId === 'string' ? input.studentId.trim().toLowerCase() : '';
      if (!/^s\d{4,10}$/.test(studentId)) fail('Enter your S-number including the s, for example s123456.');
      if (!/^[a-f0-9-]{36}$/i.test(input.idempotencyKey || '')) fail('Reopen the sticker and try again.');
      const state = snapshot(), previous = state.records.find(r => r.idempotencyKey === input.idempotencyKey);
      if (previous) {
        if (previous.studentId !== studentId || previous.eggId !== input.eggId) fail('Reopen the sticker and try again.');
        return publicResult(previous);
      }
      if (!availability().eggs.some(e => e.id === input.eggId && e.available) || state.records.some(r => r.studentId === studentId)) fail('This demo sticker is unavailable, or this S-number already has a preview reward. Reset the demo from your dashboard to present it again.');
      const remaining = [...POOL];
      state.records.forEach(r => remaining.splice(remaining.indexOf(r.percentage), 1));
      const ceiling = Math.floor(0x100000000 / remaining.length) * remaining.length;
      let draw; do { draw = crypto.getRandomValues(new Uint32Array(1))[0]; } while (draw >= ceiling);
      const reference = 'PREVIEW-' + [...crypto.getRandomValues(new Uint8Array(6))].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
      const record = { id: crypto.randomUUID(), studentId, eggId: input.eggId, percentage: remaining[draw % remaining.length],
        reference, idempotencyKey: input.idempotencyKey, createdAt: new Date(now()).toISOString() };
      state.records.push(record); write(state); return publicResult(record);
    }
    return { snapshot, availability, claim,
      reset: () => write(empty()),
      restoreIfEmpty(state) { const current = snapshot(); return current.updatedAt === 0 ? write(validate(state)) : current; },
    };
  }
  const api = { KEY, createDemoStore };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RRHS_HUNT_DEMO_STORE = api;
})(typeof window === 'undefined' ? globalThis : window);

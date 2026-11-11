'use strict';
const crypto = require('node:crypto');
const { normalizeStudent } = require('./service');

// Server-only adapter for barcode-pass-verification's signed Apps Script directory.
// A directory match proves eligibility, not possession of the student's identity.
// Live claims must additionally prove school mailbox access before drawing a prize.
async function lookupStudent(value, { env = process.env, fetcher = fetch, now = Date.now } = {}) {
  const studentId = normalizeStudent(value);
  const endpoint = env.STUDENT_DIRECTORY_URL || '';
  const secret = env.STUDENT_DIRECTORY_SECRET || '';
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(endpoint) || secret.length < 32) throw new Error('Student directory is not configured');
  const timestamp = now();
  const signature = crypto.createHmac('sha256', secret).update(studentId + ':' + timestamp).digest('base64url');
  const response = await fetcher(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId, timestamp, signature }), signal: AbortSignal.timeout(10000), redirect: 'follow' });
  if (!response.ok) throw new Error('Student directory unavailable');
  const data = await response.json();
  const expectedEmail = studentId + '@student.roundrockisd.org';
  if (data.status !== 'found') return null;
  // Accept only the directory-confirmed exact address, never a browser recipient.
  if (typeof data.email !== 'string' || data.email.toLowerCase() !== expectedEmail || typeof data.name !== 'string' || !data.name.trim()) throw new Error('Invalid directory response');
  return { studentId, email: data.email.toLowerCase(), name: data.name.trim().slice(0, 150) };
}
module.exports = { lookupStudent };

'use strict';

const crypto = require('node:crypto');
const calendar = require('../check-out-page/aday-bday.json');
const MENU = Object.freeze([
  { sku: '601_sku', id: 779182392, name: 'Original Chicken Sandwich', price: 6.25, image: 'chicken-sandwich.webp' },
  { sku: '782_sku', id: 864700011, name: 'Grilled Chicken Cobb Salad', price: 12, image: 'cobb-salad.webp' },
  { sku: '698_sku', id: 813619469, name: '8-count Chicken Nuggets', price: 6.5, image: 'chicken-nuggets.webp' },
]);
const SAUCES = Object.freeze({ ranch: 'Garden Herb Ranch', cfa: 'Chick-fil-A Sauce', buffalo: 'Zesty Buffalo', ketchup: 'Ketchup' });
const SESSION_SECONDS = 30 * 24 * 60 * 60;

function fail(status, message) { const err = new Error(message); err.status = status; throw err; }
function emailAddress(value) {
  const email = String(value || '').trim().toLowerCase();
  if (email !== 'varunnagaraj2009@gmail.com' && !/^[a-z0-9][a-z0-9._+-]{0,63}@roundrockisd\.org$/.test(email)) fail(400, 'Use your district email ending in @roundrockisd.org.');
  return email;
}
function signingSecret() {
  const secret = String(process.env.RRHS_CFA_VERIFICATION_SECRET || '').trim();
  if (secret.length < 32) fail(503, 'Email verification is not connected yet. Please try again once the CO-OP enables it.');
  return secret;
}
function sign(payload, type, seconds, now = Date.now()) {
  const data = Buffer.from(JSON.stringify({ ...payload, type, exp: Math.floor(now / 1000) + seconds })).toString('base64url');
  const sig = crypto.createHmac('sha256', signingSecret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}
function verify(token, type, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 10000) fail(401, 'Verify your district email to continue.');
  const parts = token.split('.');
  if (parts.length !== 2) fail(401, 'Verify your district email to continue.');
  const expected = crypto.createHmac('sha256', signingSecret()).update(parts[0]).digest();
  const given = Buffer.from(parts[1], 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) fail(401, 'Your verification has expired. Please verify your email again.');
  let data;
  try { data = JSON.parse(Buffer.from(parts[0], 'base64url').toString()); } catch (_) { fail(401, 'Verify your district email to continue.'); }
  if (data.type !== type || !Number.isFinite(data.exp) || data.exp <= now / 1000) fail(401, 'Your verification has expired. Please verify your email again.');
  emailAddress(data.email);
  return data;
}
function localParts(now) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(p => [p.type, p.value]));
}
function nextDelivery(now = new Date(), dates = calendar.dates) {
  const p = localParts(now);
  const today = `${p.year}-${p.month}-${p.day}`;
  const start = new Date(`${today}T12:00:00Z`);
  for (let i = 1; i <= 370; i++) {
    const day = new Date(start); day.setUTCDate(day.getUTCDate() + i);
    const key = day.toISOString().slice(0, 10);
    const entry = dates[key];
    if (!entry || !entry.instructional || !['A', 'B'].includes(entry.dayType)) continue;
    const label = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' }).format(day);
    return { date: key, label, defaultTime: '12:45' };
  }
  fail(503, 'The next delivery date is not on our school calendar yet. Please contact the CO-OP.');
}
function validateOrder(body) {
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 3) fail(400, 'Choose at least one lunch item.');
  const seen = new Set();
  const items = body.items.map(line => {
    const product = MENU.find(p => p.sku === line.sku);
    if (!product || seen.has(line.sku)) fail(400, 'Choose items from the faculty lunch menu.');
    seen.add(line.sku);
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20) fail(400, 'Choose between 1 and 20 of each item.');
    return { ...product, quantity: line.quantity };
  });
  const sauces = {};
  // Accept tabs opened before the sauce controls moved out of the product cards.
  const sauceInputs = body.sauces == null ? body.items.map(line => line.sauces) : [body.sauces];
  for (const input of sauceInputs) {
    if (input == null) continue;
    if (typeof input !== 'object' || Array.isArray(input)) fail(400, 'Check your sauce quantities.');
    for (const [key, count] of Object.entries(input)) {
      if (!Object.hasOwn(SAUCES, key) || !Number.isInteger(count) || count < 0 || count > 3) {
        fail(400, 'Choose up to 3 packets of each sauce per order.');
      }
      sauces[key] = (sauces[key] || 0) + count;
      if (sauces[key] > 3) fail(400, 'Choose up to 3 packets of each sauce per order.');
    }
  }
  const name = String(body.name || '').trim();
  const fulfillment = body.fulfillment || 'delivery';
  if (fulfillment !== 'delivery' && fulfillment !== 'pickup') fail(400, 'Choose classroom delivery or store pickup.');
  const room = fulfillment === 'delivery' ? String(body.room || '').trim() : '';
  if (!name || name.length > 100 || /[\r\n<>]/.test(name)) fail(400, 'Enter your name (up to 100 characters).');
  if (fulfillment === 'delivery' && (!room || room.length > 40 || /[\r\n<>]/.test(room))) fail(400, 'Enter your room number (up to 40 characters).');
  const time = fulfillment === 'delivery' ? String(body.time || '').trim() : '';
  if (time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) fail(400, 'Choose a valid delivery time or leave it blank.');
  return { items, sauces, name, room, time, fulfillment };
}
async function ecwid(path) {
  const token = String(process.env.RRHS_ECWID_API_TOKEN || '').trim();
  const storeId = String(process.env.RRHS_ECWID_STORE_ID || '').trim();
  if (!token || !storeId) fail(503, 'The preorder menu is not connected yet.');
  const base = String(process.env.RRHS_ECWID_API_BASE || 'https://app.ecwid.com/api/v3').trim().replace(/\/+$/, '');
  const r = await fetch(`${base}/${encodeURIComponent(storeId)}${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) { console.warn('[cfa] Ecwid request failed', { status: r.status, path: path.split('?')[0] }); fail(502, 'We could not load the current menu. Please try again shortly.'); }
  return r.json();
}
async function catalog() {
  return Promise.all(MENU.map(async item => {
    const p = await ecwid(`/products/${item.id}?responseFields=id,sku,price,enabled,inStock,unlimited,quantity,outOfStockVisibilityBehaviour`);
    if (p.sku !== item.sku || !Number.isFinite(p.price) || p.price <= 0) fail(502, 'The menu has changed. Please contact the CO-OP.');
    return { ...item, price: p.price, available: p.enabled === true, canCheckout: p.enabled === true && (p.inStock === true || p.unlimited === true || p.outOfStockVisibilityBehaviour === 'ALLOW_PREORDER'), canPreorder: p.outOfStockVisibilityBehaviour === 'ALLOW_PREORDER', stock: p.unlimited ? null : p.quantity };
  }));
}
async function mailAction(action, payload) {
  const secret = signingSecret();
  const endpoint = String(process.env.RRHS_CFA_VERIFICATION_URL || '').trim();
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(endpoint)) fail(503, 'Email verification is not connected yet. Please try again once the CO-OP enables it.');
  const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, secret, ...payload }), signal: AbortSignal.timeout(20000), redirect: 'follow' });
  if (!r.ok) fail(502, 'District email is temporarily unavailable. Please try again.');
  const result = await r.json();
  if (!result.ok) fail([400,401,429,503].includes(result.status) ? result.status : 502, result.error || 'We could not verify that code. Please try again.');
  return result;
}
function orderSauces(order) {
  if (order.sauces) return order.sauces;
  // Already-issued checkout grants retain the packet counts they were issued with.
  return Object.fromEntries(Object.keys(SAUCES).map(key => [
    key, order.items.reduce((total, item) => total + (item.sauces?.[key] || 0), 0),
  ]));
}
function orderComments(order, email, delivery) {
  const counts = orderSauces(order);
  const packets = Object.entries(SAUCES)
    .filter(([key]) => counts[key] > 0)
    .map(([key, label]) => `${label}: ${counts[key]}`);
  return [
    'FACULTY CHICK-FIL-A PREORDER',
    `Verified district email: ${email}`,
    `Name: ${order.name}`,
    ...(order.fulfillment === 'pickup'
      ? ['Fulfillment preference: Store pickup. Pickup date and time are selected in checkout.']
      : [`Room: ${order.room}`, `Delivery: ${delivery.label} (${delivery.date})`,
         `Requested time: ${order.time || 'Around 12:45 p.m.'} Central`]),
    ...order.items.map(item => `${item.quantity} × ${item.name}`),
    `Sauces: ${packets.join(', ') || 'None'}`,
  ].join('\n');
}
module.exports = { MENU, SAUCES, SESSION_SECONDS, fail, emailAddress, sign, verify, nextDelivery, validateOrder, catalog, mailAction, orderSauces, orderComments };

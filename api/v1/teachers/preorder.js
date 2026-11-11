'use strict';
const service = require('../../../teacher-preorders/service');

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    if (Buffer.byteLength(req.body) > 16000) service.fail(413, 'This request is too large.');
    return JSON.parse(req.body);
  }
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 16000) service.fail(413, 'This request is too large.'); }
  return JSON.parse(raw || '{}');
}
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const send = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
  try {
    if (req.method === 'GET') {
      const delivery = service.nextDelivery();
      const [menu, pickupTimes] = await Promise.all([service.catalog(), service.pickupTimes(delivery).catch(() => [])]);
      return send(200, { menu, sauces: service.SAUCES, sauceLimit: service.SAUCE_LIMIT, delivery, pickupTimes, storeId: String(process.env.RRHS_ECWID_STORE_ID || '').trim(), verificationReady: Boolean(process.env.RRHS_CFA_VERIFICATION_URL && (process.env.RRHS_CFA_VERIFICATION_SECRET || '').trim().length >= 32) });
    }
    if (req.method !== 'POST') return send(405, { error: 'Method not allowed' });
    const origin = req.headers?.origin;
    if (origin && !['https://rrhscoop-assets.vercel.app', 'https://rrhscoop.roundrockisd.org'].includes(origin) && !(process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))) service.fail(403, 'Open the teacher preorder page to continue.');
    const body = await readBody(req);
    if (body.action === 'send-code') {
      const email = service.emailAddress(body.email);
      const result = await service.mailAction('send-code', { email });
      return send(200, { challenge: result.challenge, retryAfter: 60 });
    }
    if (body.action === 'verify-code') {
      const email = service.emailAddress(body.email);
      if (!/^\d{6}$/.test(body.code || '') || !/^[a-f0-9-]{36}$/i.test(body.challenge || '')) service.fail(400, 'Enter the six-digit code from your district email.');
      await service.mailAction('verify-code', { email, code: body.code, challenge: body.challenge });
      return send(200, { token: service.sign({ email }, 'faculty', service.SESSION_SECONDS), email, expiresIn: service.SESSION_SECONDS });
    }
    const session = service.verify(body.token, 'faculty');
    if (body.action === 'session') return send(200, { email: session.email });
    if (body.action === 'resume') {
      const checkout = service.verify(body.grant, 'checkout');
      if (checkout.email !== session.email) service.fail(401, 'Verify the email used for this preorder.');
      if (checkout.delivery.date !== service.nextDelivery().date) service.fail(409, 'The lunch date has changed. Review your preorder again.');
      return send(200, { ...checkout, sauces: service.orderSauces(checkout), comments: service.orderComments(checkout, checkout.email, checkout.delivery), grant: body.grant, expiresAt: checkout.exp * 1000 });
    }
    if (body.action !== 'checkout') service.fail(400, 'Unknown preorder action.');
    const order = service.validateOrder(body);
    const quotedDate = service.nextDelivery();
    if (body.deliveryDate !== quotedDate.date) service.fail(409, `The lunch date has changed to ${quotedDate.label}. Refresh the menu and review your order.`);
    if (order.fulfillment === 'pickup' && !(await service.pickupTimes(quotedDate)).includes(order.time)) {
      service.fail(409, 'That pickup time is unavailable. Refresh the menu and choose another time.');
    }
    const menu = await service.catalog();
    for (const item of order.items) {
      const current = menu.find(p => p.sku === item.sku);
      if (!current?.canCheckout || (!current.canPreorder && current.stock != null && current.stock < item.quantity)) service.fail(409, `${item.name} is not available in that quantity. Please update your order.`);
      if (current.price !== body.items.find(p => p.sku === item.sku).price) service.fail(409, 'A menu price changed. Refresh the page and review the new prices.');
      item.price = current.price;
    }
    const now = new Date();
    const delivery = service.nextDelivery(now);
    if (body.deliveryDate !== delivery.date) service.fail(409, `The lunch date has changed to ${delivery.label}. Refresh the menu and review your order.`);
    const subtotal = Math.round(order.items.reduce((sum,p) => sum + p.price * p.quantity, 0) * 100) / 100;
    const checkout = { email: session.email, name: order.name, room: order.room, time: order.time, fulfillment: order.fulfillment, pickupSchedule: service.pickupScheduleLabel(order, delivery), delivery, items: order.items, sauces: order.sauces, subtotal };
    const seconds = service.checkoutSeconds(now);
    return send(200, { ...checkout, comments: service.orderComments(order, session.email, delivery), grant: service.sign(checkout, 'checkout', seconds, now.getTime()), expiresAt: (Math.floor(now.getTime() / 1000) + seconds) * 1000 });
  } catch (err) {
    if (!err.status) console.warn('[cfa-preorder]', err.name);
    return send(err.status || 502, { error: err.status ? err.message : 'We could not complete that request. Please try again.' });
  }
};

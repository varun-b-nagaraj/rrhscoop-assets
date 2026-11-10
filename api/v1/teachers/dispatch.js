'use strict';

const { timingSafeEqual } = require('node:crypto');
const { config, ecwidJson, sendJson } = require('../../../receipts/ecwid');
const { MENU } = require('../../../teacher-preorders/service');
const { isPreorder } = require('../../../check-out-page/cfa-products');

const central = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', hourCycle: 'h23',
});

function centralTime(date) {
  const parts = Object.fromEntries(central.formatToParts(date).map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

function dispatchOrder(order, date) {
  const stamp = Number(order.createTimestamp);
  if (!Number.isFinite(stamp) || stamp <= 0) return null;
  const placed = centralTime(new Date(stamp > 1e12 ? stamp : stamp * 1000));
  if (placed.date !== date || placed.hour >= 14 || !['PAID', 'AWAITING_PAYMENT'].includes(order.paymentStatus) || order.hidden) return null;

  const comments = String(order.orderComments || '').split(/\r?\n/);
  const extra = key => order.extraFields?.[key] ||
    order.orderExtraFields?.find(field => field.id === key)?.value;
  if (comments[0]?.trim() !== 'FACULTY CHICK-FIL-A PREORDER' &&
      extra('cfa_preorder') !== 'Faculty Chick-fil-A preorder') return null;

  const items = (order.items || []).filter(item => isPreorder({ id: item.productId, sku: item.sku })).map(item => ({
    name: MENU.find(product => product.id === Number(item.productId) || product.sku === item.sku)?.name || item.name,
    quantity: item.quantity,
  }));
  if (!items.length) return null;
  const field = label => comments.find(line => line.startsWith(label + ': '))?.slice(label.length + 2).trim() || '';
  return {
    number: String(order.vendorOrderNumber || order.id || order.orderNumber),
    paymentStatus: order.paymentStatus,
    name: field('Name') || order.shippingPerson?.name || '',
    room: extra('cfa_delivery_room') || field('Room'),
    delivery: extra('cfa_delivery_date') || field('Delivery'),
    time: extra('cfa_delivery_time') || field('Requested time') || 'Around 12:45 p.m.',
    sauces: field('Sauces') || 'None',
    items,
  };
}

async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  const secret = Buffer.from(String(process.env.RRHS_CFA_DISPATCH_SECRET || '').trim());
  if (secret.length < 32) return sendJson(res, 503, { error: 'Dispatch is not configured' });
  const supplied = Buffer.from(String(req.headers?.['x-cfa-dispatch-secret'] || ''));
  if (supplied.length !== secret.length || !timingSafeEqual(supplied, secret)) return sendJson(res, 401, { error: 'Unauthorized' });

  const today = centralTime(new Date());
  if (today.hour < 14) return sendJson(res, 409, { error: 'The 2 p.m. Central cutoff has not passed' });
  const cfg = config();
  if (!cfg.storeId || !cfg.token) return sendJson(res, 503, { error: 'Ecwid is not configured' });

  // This UTC window covers midnight through 2 p.m. Central in both seasons.
  // Filter again using the local timestamp so the 2 p.m. boundary is exclusive.
  const start = Date.parse(today.date + 'T00:00:00Z') / 1000;
  const orders = [];
  try {
    for (let offset = 0; ; offset += 100) {
      const params = new URLSearchParams({
        paymentStatus: 'PAID,AWAITING_PAYMENT', productId: MENU.map(p => p.id).join(','),
        createdFrom: String(start), createdTo: String(start + 86400),
        limit: '100', offset: String(offset),
      });
      const page = await ecwidJson(cfg, '/orders?' + params);
      if (!Array.isArray(page.items)) throw new Error('Missing Ecwid order list');
      for (const order of page.items) {
        const row = dispatchOrder(order, today.date);
        if (row) orders.push(row);
      }
      if (page.items.length < 100 || offset + page.items.length >= page.total) break;
    }
    return sendJson(res, 200, { date: today.date, orders });
  } catch (error) {
    console.warn('[cfa-dispatch]', error.name);
    return sendJson(res, 502, { error: 'Could not load faculty orders' });
  }
}

module.exports = handler;
module.exports.dispatchOrder = dispatchOrder;

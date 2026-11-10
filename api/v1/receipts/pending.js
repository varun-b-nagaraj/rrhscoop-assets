/* api/v1/receipts/pending.js
 *
 * GET /api/v1/receipts/pending?since=<unix seconds>
 * Header: X-Receipts-Secret: <RRHS_RECEIPTS_SECRET>
 *
 * Returns ready-to-send receipt emails for PAID orders created at or after
 * `since` (default: last 24h, never further back than 7 days).
 * includePickupConfirmations=1 also returns pay-at-pickup confirmations and
 * recently paid pickups. The sender de-duplicates by notificationId.
 *
 * { receipts: [ { orderId, notificationId, createdAt, to, subject, html, text,
 *                 attachments: [ { filename, url } ] } ] }
 */

'use strict';

const { config, sendJson, authorize, ecwidJson, requestOrigin } = require('../../../receipts/ecwid.js');
const { buildReceiptEmail } = require('../../../receipts/receipt-email.js');

const { facultyPreorder, payAtPickup } = require('../../../teacher-preorders/fulfillment');

const DAY = 24 * 60 * 60;
const PAGE = 100;
const MAX_ORDERS = 500;

async function ordersSince(cfg, status, since, dateField = 'createdFrom') {
  const orders = [];
  for (let offset = 0; offset < MAX_ORDERS; offset += PAGE) {
    const page = await ecwidJson(
      cfg,
      `/orders?paymentStatus=${status}&${dateField}=${since}&limit=${PAGE}&offset=${offset}`
    );
    const items = Array.isArray(page.items) ? page.items : [];
    orders.push(...items);
    if (items.length < PAGE || orders.length >= Number(page.total || 0)) break;
  }
  return orders;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  const cfg = config();
  if (!authorize(req, res, cfg)) return;

  const now = Math.floor(Date.now() / 1000);
  const url = new URL(req.url, 'http://localhost');
  const requested = Number(url.searchParams.get('since'));
  const since = Math.max(Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : now - DAY, now - 7 * DAY);

  try {
    const paid = await ordersSince(cfg, 'PAID', since);
    const orders = new Map(paid.map(order => [String(order.id), order]));
    if (url.searchParams.get('includePickupConfirmations') === '1') {
      const [awaiting, recentlyUpdated] = await Promise.all([
        ordersSince(cfg, 'AWAITING_PAYMENT', since),
        ordersSince(cfg, 'PAID', since, 'updatedFrom'),
      ]);
      for (const order of [...recentlyUpdated, ...awaiting]) {
        if (facultyPreorder(order) && payAtPickup(order) && !orders.has(String(order.id))) {
          orders.set(String(order.id), order);
        }
      }
    }
    const origin = requestOrigin(req);
    const receipts = Array.from(orders.values())
      .filter((o) => o && o.email && !o.hidden && !o.disableAllCustomerNotifications)
      .sort((a, b) => (a.createTimestamp || 0) - (b.createTimestamp || 0))
      .map((order) => {
        const id = String(order.id);
        const pickupConfirmation = order.paymentStatus === 'AWAITING_PAYMENT';
        const { subject, html, text } = buildReceiptEmail(order);
        const pdf = (type) => `${origin}/api/v1/receipts/pdf?order=${encodeURIComponent(id)}&type=${type}`;
        const attachments = [{ filename: `Order-Confirmation-${id}.pdf`, url: pdf('confirmation') }];
        if (!pickupConfirmation && Array.isArray(order.invoices) && order.invoices.length) {
          attachments.push({ filename: `Tax-Invoice-${id}.pdf`, url: pdf('tax-invoice') });
        }
        return { orderId: id, notificationId: pickupConfirmation ? id + ':pickup-confirmation' : id, createdAt: order.createTimestamp, to: order.email, subject, html, text, attachments };
      });
    return sendJson(res, 200, { since, receipts });
  } catch (err) {
    console.error('[receipts/pending]', err && err.message);
    return sendJson(res, 502, { error: 'Could not load orders from Ecwid' });
  }
};

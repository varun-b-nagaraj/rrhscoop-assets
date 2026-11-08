/* api/v1/receipts/pdf.js
 *
 * GET /api/v1/receipts/pdf?order=<orderId>&type=confirmation|tax-invoice
 * Header: X-Receipts-Secret: <RRHS_RECEIPTS_SECRET>
 *
 * Streams the PDF straight from Lightspeed/Ecwid:
 *   confirmation -> GET /orders/{id}/invoice-pdf (the printable order confirmation)
 *   tax-invoice  -> the order's tax invoice link (order.invoices[0].link)
 */

'use strict';

const { config, sendJson, authorize, ecwidFetch, ecwidJson, isOrderId } = require('../../../receipts/ecwid.js');

async function sendPdf(res, resp, filename) {
  const type = String(resp.headers.get('content-type') || '');
  if (!resp.ok || !type.includes('pdf')) {
    return sendJson(res, 502, { error: `Lightspeed returned ${resp.status} (${type || 'no content type'})` });
  }
  const body = Buffer.from(await resp.arrayBuffer());
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  const cfg = config();
  if (!authorize(req, res, cfg)) return;

  const url = new URL(req.url, 'http://localhost');
  const order = url.searchParams.get('order');
  const type = url.searchParams.get('type');
  if (!isOrderId(order)) return sendJson(res, 400, { error: 'Invalid order' });

  try {
    if (type === 'confirmation') {
      const resp = await ecwidFetch(cfg, `/orders/${encodeURIComponent(order)}/invoice-pdf`);
      return await sendPdf(res, resp, `Order-Confirmation-${order}.pdf`);
    }
    if (type === 'tax-invoice') {
      const data = await ecwidJson(cfg, `/orders/${encodeURIComponent(order)}?responseFields=invoices`);
      const invoice = Array.isArray(data.invoices) ? data.invoices.find((i) => i && i.link) : null;
      if (!invoice) return sendJson(res, 404, { error: 'This order has no tax invoice' });
      const resp = await fetch(invoice.link, { redirect: 'follow' });
      return await sendPdf(res, resp, `Tax-Invoice-${order}.pdf`);
    }
    return sendJson(res, 400, { error: 'type must be confirmation or tax-invoice' });
  } catch (err) {
    console.error('[receipts/pdf]', err && err.message);
    return sendJson(res, 502, { error: 'Could not load the PDF from Lightspeed' });
  }
};

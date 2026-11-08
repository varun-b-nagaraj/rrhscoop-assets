/* receipts/receipt-email.js
 *
 * Builds the customer receipt email (subject, HTML, plain text) from an Ecwid
 * order object. Pure functions only: no network, so it can be unit-tested.
 */

'use strict';

const LOGO_URL = 'https://rrhscoop-assets.vercel.app/custom-visuals/regular-logo.png';
const STORE_NAME = 'RRHS CO-OP';
const STORE_EMAIL = 'rrhs_coop_store@roundrockisd.org';
const STORE_URL = 'https://rrhscoop.roundrockisd.org';
const ETA_MINUTES = 20;

const COLORS = {
  maroon: '#6e1f2a',
  ink: '#141414',
  muted: '#6b625e',
  paper: '#faf8f4',
  cream: '#f1eee8',
  line: '#e4ddd2',
};

const STATUS_LABELS = {
  AWAITING_PROCESSING: 'Order received',
  PROCESSING: 'Being prepared',
  SHIPPED: 'Out for delivery',
  DELIVERED: 'Delivered',
  READY_FOR_PICKUP: 'Ready for pickup',
  OUT_FOR_DELIVERY: 'Out for delivery',
  WILL_NOT_DELIVER: 'Unable to deliver',
  RETURNED: 'Returned',
};

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function money(value) {
  const n = Number(value) || 0;
  return (n < 0 ? '-$' : '$') + Math.abs(n).toFixed(2);
}

function extraField(order, pattern) {
  const fields = Array.isArray(order.orderExtraFields) ? order.orderExtraFields : [];
  const hit = fields.find((f) => f && pattern.test(String(f.title || '')) && String(f.value || '').trim());
  return hit ? String(hit.value).trim() : '';
}

function firstName(order) {
  const people = [order.billingPerson, order.shippingPerson].filter(Boolean);
  for (const p of people) {
    if (p.firstName && p.firstName.trim()) return p.firstName.trim();
    if (p.name && p.name.trim()) return p.name.trim().split(/\s+/)[0];
  }
  return '';
}

function fullName(order) {
  const p = order.billingPerson || order.shippingPerson || {};
  return (p.name || [p.firstName, p.lastName].filter(Boolean).join(' ') || '').trim();
}

function statusLabel(status) {
  return STATUS_LABELS[status] || String(status || 'Order received').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function isPickup(order) {
  const opt = order.shippingOption || {};
  return Boolean(opt.isPickup) || opt.fulfillmentType === 'PICKUP';
}

function etaMessage(order, schedule) {
  if (schedule) return `We'll bring it to you at your scheduled time: ${schedule}.`;
  if (isPickup(order)) return `We'll have it ready for pickup in about ${ETA_MINUTES} minutes.`;
  return `We'll have it to you in about ${ETA_MINUTES} minutes.`;
}

function lineItems(order) {
  return (Array.isArray(order.items) ? order.items : []).map((item) => {
    const quantity = Number(item.quantity) || 1;
    const unit = Number(item.price) || 0;
    const options = (Array.isArray(item.selectedOptions) ? item.selectedOptions : [])
      .map((o) => {
        const value = o.value != null ? o.value : Array.isArray(o.selections) ? o.selections.map((s) => s.selectionTitle).join(', ') : '';
        // Internal helper fields like "SauceQty1" aren't meaningful to customers.
        if (/qty\d*$/i.test(String(o.name || ''))) return '';
        return o.name && value ? `${o.name}: ${value}` : '';
      })
      .filter(Boolean);
    return {
      name: String(item.name || 'Item'),
      options,
      quantity,
      unit,
      total: unit * quantity,
      imageUrl: item.imageUrl || item.smallThumbnailUrl || '',
    };
  });
}

function summaryRows(order) {
  const rows = [{ label: 'Subtotal', value: Number(order.subtotal) || 0 }];
  const discount =
    (Number(order.couponDiscount) || 0) +
    (Number(order.discount) || 0) +
    (Number(order.volumeDiscount) || 0) +
    (Number(order.membershipBasedDiscount) || 0);
  if (discount > 0) rows.push({ label: 'Discount', value: -discount });
  (Array.isArray(order.customSurcharges) ? order.customSurcharges : []).forEach((s) => {
    const total = Number(s.total != null ? s.total : s.value) || 0;
    if (total) rows.push({ label: s.description || 'Fee', value: total });
  });
  const opt = order.shippingOption || {};
  const delivery = Number(opt.shippingRate) || 0;
  rows.push({ label: isPickup(order) ? 'Pickup' : 'Delivery', value: delivery, free: delivery === 0 });
  const tax = Number(order.tax) || 0;
  if (tax) rows.push({ label: 'Tax', value: tax });
  return rows;
}

function orderNumber(order) {
  return String(order.id || order.orderNumber || '');
}

function buildReceiptEmail(order) {
  const number = orderNumber(order);
  const name = firstName(order);
  const rawRoom = extraField(order, /delivery\s*location|room/i);
  const room = /^\d+[a-z]?$/i.test(rawRoom) ? `Room ${rawRoom}` : rawRoom;
  const schedule = extraField(order, /^schedule$/i);
  const gift = extraField(order, /gift\s*message/i);
  const status = statusLabel(order.fulfillmentStatus);
  const items = lineItems(order);
  const rows = summaryRows(order);
  const total = Number(order.total) || 0;
  const eta = etaMessage(order, schedule);
  const greeting = name ? `Thank you, ${name}!` : 'Thank you!';
  const method = (order.shippingOption && order.shippingOption.shippingMethodName) || '';
  const placed = order.createTimestamp
    ? new Date(order.createTimestamp * 1000).toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '';

  const subject = `Thank you for your order! Receipt for #${number}`;

  const e = escapeHtml;
  const c = COLORS;
  const cell = 'padding:0;margin:0;';

  const itemRows = items
    .map(
      (it) => `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid ${c.line};vertical-align:top;width:56px;">
            ${
              it.imageUrl
                ? `<img src="${e(it.imageUrl)}" width="48" height="48" alt="" style="display:block;width:48px;height:48px;object-fit:cover;border:1px solid ${c.line};">`
                : ''
            }
          </td>
          <td style="padding:14px 12px;border-bottom:1px solid ${c.line};vertical-align:top;">
            <div style="font-size:16px;font-weight:bold;color:${c.ink};">${e(it.name)}</div>
            ${it.options.map((o) => `<div style="font-size:13px;color:${c.muted};margin-top:2px;">${e(o)}</div>`).join('')}
            <div style="font-size:13px;color:${c.muted};margin-top:2px;">Qty ${it.quantity} &times; ${money(it.unit)}</div>
          </td>
          <td style="padding:14px 0;border-bottom:1px solid ${c.line};vertical-align:top;text-align:right;font-size:16px;color:${c.ink};white-space:nowrap;">${money(it.total)}</td>
        </tr>`
    )
    .join('');

  const summaryHtml = rows
    .map(
      (r) => `
        <tr>
          <td style="padding:4px 0;font-size:14px;color:${c.muted};">${e(r.label)}</td>
          <td style="padding:4px 0;font-size:14px;color:${c.ink};text-align:right;">${r.free ? 'Free' : money(r.value)}</td>
        </tr>`
    )
    .join('');

  const detail = (label, value) =>
    value
      ? `<tr>
          <td style="padding:6px 0;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:${c.muted};width:42%;vertical-align:top;">${e(label)}</td>
          <td style="padding:6px 0;font-size:15px;color:${c.ink};vertical-align:top;">${e(value)}</td>
        </tr>`
      : '';

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${e(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${c.paper};font-family:Georgia,'Times New Roman',serif;color:${c.ink};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${e(`${greeting} ${eta}`)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.paper};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${c.line};">
          <tr>
            <td align="center" style="padding:32px 32px 8px;">
              <img src="${LOGO_URL}" width="66" height="96" alt="Round Rock CO-OP" style="display:block;width:66px;height:96px;">
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:16px 32px 4px;">
              <div style="font-size:30px;line-height:1.15;color:${c.maroon};font-weight:bold;">${e(greeting)}</div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 40px 24px;font-size:16px;line-height:1.55;color:${c.ink};">
              We've got your order and we're on it. ${e(eta)}
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.cream};">
                <tr>
                  <td style="padding:16px 20px;">
                    <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${c.muted};">Order number</div>
                    <div style="font-size:20px;font-weight:bold;color:${c.ink};margin-top:2px;">#${e(number)}</div>
                  </td>
                  <td style="padding:16px 20px;text-align:right;">
                    <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${c.muted};">Status</div>
                    <div style="display:inline-block;margin-top:4px;padding:4px 10px;background:${c.maroon};color:#ffffff;font-size:13px;font-weight:bold;">${e(status)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 4px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${detail('Name', fullName(order))}
                ${detail(isPickup(order) ? 'Pickup' : 'Deliver to', room || method)}
                ${detail('Scheduled for', schedule)}
                ${detail('Placed', placed)}
                ${detail('Payment', order.paymentMethod)}
                ${detail('Gift message', gift)}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0;">
              <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${c.muted};padding-bottom:4px;border-bottom:2px solid ${c.ink};">Your items</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows}</table>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 32px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${summaryHtml}
                <tr>
                  <td style="padding:10px 0 0;border-top:1px solid ${c.line};font-size:18px;font-weight:bold;color:${c.ink};">Total</td>
                  <td style="padding:10px 0 0;border-top:1px solid ${c.line};font-size:18px;font-weight:bold;color:${c.maroon};text-align:right;">${money(total)}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;font-size:14px;line-height:1.55;color:${c.muted};">
              Your order confirmation and tax invoice are attached as PDFs for your records.
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 32px;font-size:14px;line-height:1.55;color:${c.muted};">
              Questions about your order? Just reply to this email or write to
              <a href="mailto:${STORE_EMAIL}" style="color:${c.maroon};">${STORE_EMAIL}</a>.
              Thanks for supporting the student-run CO-OP!
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:18px 32px;background:${c.maroon};font-size:13px;color:#ffffff;">
              <a href="${STORE_URL}" style="color:#ffffff;text-decoration:none;font-weight:bold;">${STORE_NAME}</a>
              &middot; Round Rock High School
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    greeting,
    '',
    `We've got your order and we're on it. ${eta}`,
    '',
    `Order number: #${number}`,
    `Status: ${status}`,
    fullName(order) ? `Name: ${fullName(order)}` : null,
    room || method ? `${isPickup(order) ? 'Pickup' : 'Deliver to'}: ${room || method}` : null,
    schedule ? `Scheduled for: ${schedule}` : null,
    placed ? `Placed: ${placed}` : null,
    order.paymentMethod ? `Payment: ${order.paymentMethod}` : null,
    gift ? `Gift message: ${gift}` : null,
    '',
    'Your items:',
    ...items.map(
      (it) => `- ${it.name}${it.options.length ? ` (${it.options.join('; ')})` : ''} x${it.quantity}: ${money(it.total)}`
    ),
    '',
    ...rows.map((r) => `${r.label}: ${r.free ? 'Free' : money(r.value)}`),
    `Total: ${money(total)}`,
    '',
    'Your order confirmation and tax invoice are attached as PDFs.',
    `Questions? Reply to this email or write to ${STORE_EMAIL}.`,
    '',
    `${STORE_NAME} - ${STORE_URL}`,
  ]
    .filter((line) => line !== null)
    .join('\n');

  return { subject, html, text };
}

module.exports = {
  buildReceiptEmail,
  escapeHtml,
  money,
  statusLabel,
  extraField,
};

'use strict';

function pickupOrder(order) {
  const shipping = order.shippingOption || {};
  return Boolean(shipping.isPickup) ||
    String(shipping.fulfillmentType || shipping.fulfilmentType || '').toUpperCase() === 'PICKUP' ||
    /^pickup at round rock high school co-op store$/i.test(shipping.shippingMethodName || '');
}

function facultyPreorder(order) {
  return /^FACULTY CHICK-FIL-A PREORDER(?:\r?\n|$)/.test(order.orderComments || '') ||
    preorderField(order, 'cfa_preorder') === 'Faculty Chick-fil-A preorder';
}

function preorderField(order, key) {
  return order.extraFields?.[key] || order.orderExtraFields?.find(field => field.id === key)?.value || '';
}

function preorderComment(order, label) {
  const prefix = label + ': ';
  const line = String(order.orderComments || '').split(/\r?\n/).find(entry => entry.startsWith(prefix));
  return line ? line.slice(prefix.length).trim() : '';
}

function payAtPickup(order) {
  return pickupOrder(order) && /^pay at pickup$/i.test(String(order.paymentMethod || '').trim());
}

function pickupSchedule(order) {
  if (!order.pickupTime) return '';
  // Ecwid sends UTC timestamps with a space between the date and time.
  const value = String(order.pickupTime).replace(/^(\d{4}-\d{2}-\d{2}) /, '$1T').replace(/ \+0000$/, 'Z');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    timeZone: 'America/Chicago', dateStyle: 'full', timeStyle: 'short',
  }) + ' Central';
}

function facultyDeliverySchedule(order) {
  const date = preorderField(order, 'cfa_delivery_date');
  const time = preorderField(order, 'cfa_delivery_time') || 'Around 12:45 p.m.';
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const formatted = new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', {
      timeZone: 'UTC', dateStyle: 'full',
    });
    return formatted + ' · ' + time + ' Central';
  }
  return [preorderComment(order, 'Delivery'), preorderComment(order, 'Requested time')].filter(Boolean).join(' · ');
}

module.exports = { pickupOrder, facultyPreorder, preorderField, preorderComment, payAtPickup, pickupSchedule, facultyDeliverySchedule };

/**
 * RRHS CO-OP district automation: email verification, faculty dispatch, and receipts.
 *
 * Paste this file into the existing district web app project. Keep the same deployment
 * URL and Script properties. Add RECEIPTS_SECRET from RRHS_RECEIPTS_SECRET in Vercel.
 * Faculty dispatch uses RRHS_ECWID_STORE_ID and RRHS_ECWID_API_TOKEN in Script properties.
 * The verification web app uses CFA_VERIFICATION_SECRET.
 *
 * Run checkCoopSetup() to check connections, then setup() to install the minute trigger.
 */
function doPost(e) {
  if (!e || !e.postData) return cfaJson_({ ok: false, status: 400, error: 'Use the preorder page to request or verify a code.' });
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return cfaJson_({ ok: false, status: 429, error: 'Please wait a moment and try again.' });
  try {
    var input = JSON.parse(e.postData.contents || '{}');
    var props = PropertiesService.getScriptProperties();
    var secret = props.getProperty('CFA_VERIFICATION_SECRET');
    if (!secret || secret.length < 32 || !cfaEqual_(String(input.secret || ''), secret)) return cfaJson_({ ok: false, status: 401, error: 'Verification service is not connected.' });
    var email = String(input.email || '').trim().toLowerCase();
    if (!['varunnagaraj2009@gmail.com', 'isabellen90@gmail.com'].includes(email) && !/^[a-z0-9][a-z0-9._+-]{0,63}@roundrockisd\.org$/.test(email)) return cfaJson_({ ok: false, status: 400, error: 'Use your @roundrockisd.org email.' });
    var key = 'cfa_email_' + cfaDigest_(email, secret);
    var record = JSON.parse(props.getProperty(key) || '{}');
    var now = Date.now();
    if (input.action === 'send-code') {
      if (record.sentAt && now - record.sentAt < 60000) return cfaJson_({ ok: false, status: 429, error: 'Wait one minute before requesting another code.' });
      var hour = Math.floor(now / 3600000);
      var count = record.hour === hour ? record.count || 0 : 0;
      var global = JSON.parse(props.getProperty('cfa_rate') || '{}');
      var total = global.hour === hour ? global.count || 0 : 0;
      if (count >= 5 || total >= 100 || MailApp.getRemainingDailyQuota() < 1) return cfaJson_({ ok: false, status: 429, error: 'Too many code requests. Please try again later.' });
      var challenge = Utilities.getUuid();
      var bytes = Utilities.computeHmacSha256Signature(Utilities.getUuid() + challenge + now, secret);
      var number = ((bytes[0] & 255) * 16777216 + (bytes[1] & 255) * 65536 + (bytes[2] & 255) * 256 + (bytes[3] & 255)) % 1000000;
      var code = ('000000' + number).slice(-6);
      record = { challenge: challenge, hash: cfaDigest_(challenge + ':' + code, secret), expires: now + 10 * 60000, attempts: 0, sentAt: now, hour: hour, count: count + 1 };
      // Persist rate limits before sending, even if the mail service fails.
      props.setProperty(key, JSON.stringify(record));
      props.setProperty('cfa_rate', JSON.stringify({ hour: hour, count: total + 1 }));
      MailApp.sendEmail({
        to: email,
        subject: code + ' is your RRHS CO-OP verification code',
        body: 'Your verification code is ' + code + '. It expires in 10 minutes. If you did not request a code, ignore this email.',
        htmlBody: cfaEmail_('Faculty lunch', 'Your verification code',
          '<p>Enter this code on the RRHS CO-OP preorder page. It expires in 10 minutes.</p>' +
          '<p style="background:#f1eee8;border-left:3px solid #6e1f2a;padding:16px 20px;color:#6e1f2a;font:400 34px/1.2 Georgia,serif;letter-spacing:6px;">' + code + '</p>' +
          '<p>If you did not request a code, ignore this email.</p>'),
        name: 'RRHS CO-OP'
      });
      cfaCleanup_(props, now);
      return cfaJson_({ ok: true, challenge: challenge });
    }
    if (input.action === 'verify-code') {
      if (!record.hash || record.expires <= now || record.challenge !== input.challenge || record.attempts >= 5) return cfaJson_({ ok: false, status: 401, error: 'This code expired. Request a new one.' });
      record.attempts++;
      var correct = cfaEqual_(cfaDigest_(input.challenge + ':' + String(input.code || ''), secret), record.hash);
      if (correct) { delete record.hash; delete record.challenge; }
      props.setProperty(key, JSON.stringify(record));
      return cfaJson_(correct ? { ok: true } : { ok: false, status: 401, error: 'That code does not match. Check your email and try again.' });
    }
    return cfaJson_({ ok: false, status: 400, error: 'Unknown action.' });
  } catch (err) {
    console.error('Faculty verification failed: ' + err.name);
    return cfaJson_({ ok: false, status: 503, error: 'District email is temporarily unavailable. Please try again.' });
  } finally { lock.releaseLock(); }
}
function cfaDigest_(text, secret) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(text, secret));
}
function cfaEqual_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function cfaJson_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function cfaCleanup_(props, now) {
  var all = props.getProperties();
  Object.keys(all).forEach(function (key) {
    if (key.indexOf('cfa_email_') !== 0) return;
    try { if (JSON.parse(all[key]).sentAt < now - 24 * 3600000) props.deleteProperty(key); } catch (_) { props.deleteProperty(key); }
  });
}

function cfaEscape_(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
  });
}

function cfaEmail_(label, title, content) {
  return '<!doctype html><html lang="en"><body style="margin:0;background:#f1eee8;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1eee8;"><tr><td align="center" style="padding:20px 12px;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#faf8f4;color:#141414;">' +
    '<tr><td style="padding:20px 24px;background:#6e1f2a;color:#faf8f4;font:400 23px Georgia,serif;">RRHS CO-OP</td></tr>' +
    '<tr><td style="padding:24px;font:400 16px/1.55 Spectral,Georgia,serif;">' +
    '<p style="margin:0 0 8px;color:#6e1f2a;font:600 11px/1.5 Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;">' + cfaEscape_(label) + '</p>' +
    '<h1 style="margin:0 0 18px;color:#6e1f2a;font:400 30px/1.2 \'Playfair Display\',Georgia,serif;">' + cfaEscape_(title) + '</h1>' +
    content + '</td></tr></table></td></tr></table></body></html>';
}

function cfaDispatchMessage_(data) {
  var total = data.orders.length;
  var title = total + (total === 1 ? ' faculty preorder' : ' faculty preorders');
  var intro = 'Orders placed before 2 p.m. Central on ' + data.date + '.';
  var text = [intro];
  var html = '<p style="margin:0 0 20px;color:#655a53;">' + cfaEscape_(intro) + '</p>';
  if (!total) {
    text.push('No faculty preorders for this dispatch.');
    html += '<p>No faculty preorders for this dispatch.</p>';
  }
  data.orders.forEach(function (order) {
    var customer = order.name + (order.room ? ' · Room ' + order.room : '');
    var delivery = [order.pickup ? 'Pickup at the RRHS CO-OP' : 'Classroom delivery', order.delivery, order.time].filter(Boolean).join(' · ');
    var items = order.items.map(function (item) { return item.quantity + ' × ' + item.name; });
    var payment = order.paymentStatus === 'PAID' ? 'Paid' : (order.payAtPickup ? 'Pay at pickup' : 'Awaiting payment');
    var orderLabel = 'Order ' + order.number + ' · ' + payment;
    text.push('', orderLabel, customer, delivery, items.join('\n'), 'Sauces: ' + order.sauces);
    html += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:12px;background:#f1eee8;"><tr><td style="padding:16px;border-left:3px solid #6e1f2a;">' +
      '<p style="margin:0 0 4px;color:#6e1f2a;font:600 14px/1.4 Georgia,serif;">' + cfaEscape_(orderLabel) + '</p>' +
      '<p style="margin:0;font-weight:600;">' + cfaEscape_(customer) + '</p>' +
      '<p style="margin:0;color:#655a53;">' + cfaEscape_(delivery) + '</p>' +
      '<ul style="margin:10px 0;padding-left:22px;">' +
      items.map(function (item) { return '<li>' + cfaEscape_(item) + '</li>'; }).join('') + '</ul>' +
      '<p style="margin:0;"><strong>Sauces</strong> ' + cfaEscape_(order.sauces) + '</p></td></tr></table>';
  });
  return {
    subject: 'Faculty Chick-fil-A dispatch · ' + data.date,
    body: text.join('\n'),
    htmlBody: cfaEmail_('Chick-fil-A dispatch', title, html),
    name: 'RRHS CO-OP'
  };
}

function sendCfaDispatch() {
  var now = new Date();
  var timeZone = 'America/Chicago';
  if (Number(Utilities.formatDate(now, timeZone, 'HHmm')) < 1430) return;
  var date = Utilities.formatDate(now, timeZone, 'yyyy-MM-dd');
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('cfa_last_dispatch_date') === date) return;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    if (props.getProperty('cfa_last_dispatch_date') === date) return;
    var orders = cfaReadOrders_(date, cfaEcwidConfig_(props));
    var message = cfaDispatchMessage_({ date: date, orders: orders });
    message.to = 's137323@student.roundrockisd.org,s138524@student.roundrockisd.org';
    MailApp.sendEmail(message);
    props.setProperty('cfa_last_dispatch_date', date);
  } finally {
    lock.releaseLock();
  }
}

// Run from the editor to send a sample with fictional order details.
function sendCfaDispatchPreview() {
  var message = cfaDispatchMessage_({
    date: Utilities.formatDate(new Date(), 'America/Chicago', 'yyyy-MM-dd'),
    orders: [{
      number: 'SAMPLE', paymentStatus: 'PAID', name: 'Example Teacher', room: '1314', delivery: 'Next school day',
      time: 'Around 12:45 p.m.', sauces: 'Chick-fil-A Sauce: 2, Ketchup: 1',
      items: [{ quantity: 2, name: 'Original Chicken Sandwich' }]
    }]
  });
  message.subject = '[Preview] ' + message.subject;
  message.to = 'varunnagaraj2009@gmail.com';
  MailApp.sendEmail(message);
}

function cfaEcwidConfig_(properties) {
  var storeId = String(properties.getProperty('RRHS_ECWID_STORE_ID') || '').trim();
  var token = String(properties.getProperty('RRHS_ECWID_API_TOKEN') || '').trim();
  if (!/^\d+$/.test(storeId) || !token) {
    throw new Error('Set RRHS_ECWID_STORE_ID and RRHS_ECWID_API_TOKEN in Script properties.');
  }
  return { storeId: storeId, token: token };
}

var CFA_DISPATCH_PRODUCTS = [
  { id: 779182392, sku: '601_sku', name: 'Original Chicken Sandwich' },
  { id: 864700011, sku: '782_sku', name: 'Grilled Chicken Cobb Salad' },
  { id: 813619469, sku: '698_sku', name: '8-count Chicken Nuggets' }
];

function cfaReadOrders_(date, config) {
  // This UTC window covers the requested Central-time window in both seasons.
  // Filter again by the local date and cutoff before sending.
  var start = Date.parse(date + 'T00:00:00Z') / 1000;
  var orderUrl = 'https://app.ecwid.com/api/v3/' + config.storeId + '/orders' +
    '?paymentStatus=PAID%2CAWAITING_PAYMENT&productId=' +
    encodeURIComponent(CFA_DISPATCH_PRODUCTS.map(function (product) { return product.id; }).join(',')) +
    '&createdFrom=' + start + '&createdTo=' + (start + 86400) + '&limit=100';

  var orders = [];
  for (var offset = 0; ; offset += 100) {
    var response = UrlFetchApp.fetch(orderUrl + '&offset=' + offset, {
      headers: { Authorization: 'Bearer ' + config.token, Accept: 'application/json' },
      muteHttpExceptions: true,
      followRedirects: false
    });
    if (response.getResponseCode() !== 200) {
      throw new Error('Ecwid order lookup returned ' + response.getResponseCode());
    }
    var page = JSON.parse(response.getContentText());
    if (!Array.isArray(page.items)) throw new Error('Ecwid did not return an order list.');
    page.items.forEach(function (order) {
      var row = cfaDispatchOrder_(order, date);
      if (row) orders.push(row);
    });
    if (page.items.length < 100 || offset + page.items.length >= page.total) break;
  }
  return orders;
}

function cfaDispatchOrder_(order, date) {
  var timestamp = Number(order.createTimestamp);
  if (!Number.isFinite(timestamp) || timestamp <= 0 || order.hidden) return null;
  if (['PAID', 'AWAITING_PAYMENT'].indexOf(order.paymentStatus) === -1) return null;
  var placed = new Date(timestamp > 1e12 ? timestamp : timestamp * 1000);
  var timeZone = 'America/Chicago';
  if (Utilities.formatDate(placed, timeZone, 'yyyy-MM-dd') !== date ||
      Number(Utilities.formatDate(placed, timeZone, 'HHmm')) >= 1400) return null;

  var comments = String(order.orderComments || '').split(/\r?\n/);
  function extra(key) {
    if (order.extraFields && order.extraFields[key]) return order.extraFields[key];
    var field = (order.orderExtraFields || []).find(function (entry) { return entry.id === key; });
    return field ? field.value : '';
  }
  if (comments[0].trim() !== 'FACULTY CHICK-FIL-A PREORDER' &&
      extra('cfa_preorder') !== 'Faculty Chick-fil-A preorder') return null;

  var items = [];
  (order.items || []).forEach(function (item) {
    var product = CFA_DISPATCH_PRODUCTS.find(function (entry) {
      return entry.id === Number(item.productId) || entry.sku === item.sku;
    });
    if (product) items.push({ name: product.name, quantity: item.quantity });
  });
  if (!items.length) return null;

  function comment(label) {
    var prefix = label + ': ';
    var line = comments.find(function (entry) { return entry.indexOf(prefix) === 0; });
    return line ? line.slice(prefix.length).trim() : '';
  }
  var shipping = order.shippingOption || {};
  var pickup = shipping.isPickup || String(shipping.fulfillmentType || shipping.fulfilmentType || '').toUpperCase() === 'PICKUP' ||
    /^pickup at round rock high school co-op store$/i.test(shipping.shippingMethodName || '');
  var pickupTime = '';
  if (pickup && order.pickupTime) {
    var stamp = String(order.pickupTime).replace(/^(\d{4}-\d{2}-\d{2}) /, '$1T').replace(/ \+0000$/, 'Z');
    var pickupDate = new Date(stamp);
    if (Number.isFinite(pickupDate.getTime())) {
      pickupTime = Utilities.formatDate(pickupDate, timeZone, "EEE, MMM d 'at' h:mm a") + ' Central';
    }
  }
  return {
    number: String(order.vendorOrderNumber || order.id || order.orderNumber),
    paymentStatus: order.paymentStatus,
    name: comment('Name') || (order.shippingPerson && order.shippingPerson.name) || '',
    pickup: Boolean(pickup),
    payAtPickup: Boolean(pickup) && /^pay at pickup$/i.test(order.paymentMethod || ''),
    room: pickup ? '' : extra('cfa_delivery_room') || comment('Room'),
    delivery: pickup ? '' : extra('cfa_delivery_date') || comment('Delivery'),
    time: pickup ? pickupTime || 'See pickup time in Ecwid' :
      extra('cfa_delivery_time') || comment('Requested time') || 'Around 12:45 p.m.',
    sauces: comment('Sauces') || 'None',
    items: items
  };
}

const RECEIPTS_API = 'https://rrhscoop-assets.vercel.app/api/v1/receipts';
const SENDER_NAME = 'RRHS CO-OP';
const REPLY_TO = 'rrhs_coop_store@roundrockisd.org';
// To send *from* the store address instead of your own, add it in Gmail under
// Settings → Accounts → "Send mail as", then set FROM_ALIAS to it.
const FROM_ALIAS = '';
const MAX_SENT_IDS = 400;

function coopSettings_() {
  const props = PropertiesService.getScriptProperties();
  if ((props.getProperty('CFA_VERIFICATION_SECRET') || '').length < 32) {
    throw new Error('Set CFA_VERIFICATION_SECRET in Script properties.');
  }
  if (!props.getProperty('RECEIPTS_SECRET')) {
    throw new Error('Set RECEIPTS_SECRET in Script properties.');
  }
  return { props, ecwid: cfaEcwidConfig_(props) };
}

/** Checks the receipt and Ecwid connections without sending mail. */
function checkCoopSetup() {
  const { ecwid } = coopSettings_();
  const url = 'https://app.ecwid.com/api/v3/' + ecwid.storeId + '/orders?limit=1&responseFields=total';
  const response = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ecwid.token },
    muteHttpExceptions: true,
    followRedirects: false,
  });
  if (response.getResponseCode() !== 200) {
    throw new Error('Ecwid order access returned ' + response.getResponseCode());
  }
  receiptApiJson_('/pending?since=' + Math.floor(Date.now() / 1000));
  Logger.log('Ecwid order access and the receipt API are connected. Test email verification from the preorder page.');
}

/** Installs a single trigger and preserves this project's receipt history. */
function setup() {
  const { props } = coopSettings_();
  if (!props.getProperty('START_AT')) {
    props.setProperty('START_AT', String(Math.floor(Date.now() / 1000)));
  }
  const handlers = ['sendPendingReceipts', 'sendCfaDispatch', 'runCoopJobs'];
  const oldTriggers = ScriptApp.getProjectTriggers().filter(trigger => handlers.includes(trigger.getHandlerFunction()));
  ScriptApp.newTrigger('runCoopJobs').timeBased().everyMinutes(1).create();
  oldTriggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
  Logger.log('Receipt and faculty dispatch automation is on.');
}

/** Run both jobs even if one service is temporarily unavailable. */
function runCoopJobs() {
  const failures = [];
  for (const job of [sendCfaDispatch, sendPendingReceipts]) {
    try {
      job();
    } catch (error) {
      failures.push(job.name + ': ' + error.message);
    }
  }
  if (failures.length) throw new Error(failures.join(' | '));
}

function sendPendingReceipts() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return; // a previous run is still going
  try {
    const props = PropertiesService.getScriptProperties();
    const startAt = Number(props.getProperty('START_AT')) || Math.floor(Date.now() / 1000);
    const since = Math.max(startAt, Math.floor(Date.now() / 1000) - 24 * 60 * 60);
    const sent = JSON.parse(props.getProperty('SENT_IDS') || '[]');

    const data = receiptApiJson_('/pending?includePickupConfirmations=1&since=' + since);
    (data.receipts || []).forEach((receipt) => {
      const notificationId = receipt.notificationId || receipt.orderId;
      if (sent.indexOf(notificationId) !== -1) return;
      try {
        sendReceipt_(receipt, receipt.to);
        sent.push(notificationId);
        props.setProperty('SENT_IDS', JSON.stringify(sent.slice(-MAX_SENT_IDS)));
      } catch (err) {
        // Leave it unmarked so the next run retries it.
        console.error('Receipt for ' + receipt.orderId + ' failed: ' + err);
      }
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Sends receipts for paid orders from the last hour that haven't been emailed
 * yet (e.g. orders placed just before setup() was run). Safe to run again.
 */
function catchUpLastHour() {
  const props = PropertiesService.getScriptProperties();
  const hourAgo = Math.floor(Date.now() / 1000) - 60 * 60;
  const startAt = Number(props.getProperty('START_AT')) || hourAgo;
  props.setProperty('START_AT', String(Math.min(startAt, hourAgo)));
  sendPendingReceipts();
  Logger.log('Sent any missing receipts from the last hour. Check Executions for errors.');
}

/** Emails the most recent paid order's receipt to you, without marking it sent. */
function sendTestReceipt() {
  const weekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
  const receipts = receiptApiJson_('/pending?since=' + weekAgo).receipts || [];
  if (!receipts.length) throw new Error('No paid orders in the last 7 days to use as a sample.');
  const sample = receipts[receipts.length - 1];
  sendReceipt_(sample, Session.getActiveUser().getEmail());
  Logger.log('Sent a sample receipt for order ' + sample.orderId + ' to you.');
}

function sendReceipt_(receipt, to) {
  const attachments = (receipt.attachments || []).map((a) =>
    receiptApiFetch_(a.url).getBlob().setName(a.filename)
  );
  const options = {
    htmlBody: receipt.html,
    attachments: attachments,
    name: SENDER_NAME,
    replyTo: REPLY_TO,
  };
  if (FROM_ALIAS) options.from = FROM_ALIAS;
  GmailApp.sendEmail(to, receipt.subject, receipt.text, options);
}

function receiptApiJson_(path) {
  return JSON.parse(receiptApiFetch_(RECEIPTS_API + path).getContentText());
}

function receiptApiFetch_(url) {
  if (!url.startsWith(RECEIPTS_API + '/')) throw new Error('Unexpected receipt URL.');
  const secret = PropertiesService.getScriptProperties().getProperty('RECEIPTS_SECRET');
  const resp = UrlFetchApp.fetch(url, {
    headers: { 'X-Receipts-Secret': secret },
    muteHttpExceptions: true,
    followRedirects: false,
  });
  if (resp.getResponseCode() !== 200) {
    throw new Error('Receipt API returned ' + resp.getResponseCode());
  }
  return resp;
}

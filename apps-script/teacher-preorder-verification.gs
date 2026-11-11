/**
 * RRHS CO-OP district automation: email verification, faculty dispatch, and receipts.
 *
 * Paste this file into the existing district web app project. Keep the same deployment
 * URL. Keep RRHS_ECWID_STORE_ID and RRHS_ECWID_API_TOKEN in Script properties.
 * setup() creates the verification key if missing; existing keys and send history are retained.
 *
 * Run setup() once to initialize, test connections/templates, and install the minute job.
 * The job checks health daily. Running setup() again preserves existing send history.
 */
function doPost(e) {
  if (!e || !e.postData) return cfaJson_({ ok: false, status: 400, error: 'Use the preorder page to request or verify a code.' });
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return cfaJson_({ ok: false, status: 429, error: 'Please wait a moment and try again.' });
  try {
    var input = JSON.parse(e.postData.contents || '{}');
    var props = PropertiesService.getScriptProperties();
    if (input.action === 'send-hunt-preview') return cfaJson_(cfaSendHuntPreview_(input, props));
    if (input.action !== 'send-code' && input.action !== 'verify-code') {
      return cfaJson_({ ok: false, status: 400, error: 'Unknown action.' });
    }
    var email = String(input.email || '').trim().toLowerCase();
    if (!['varunnagaraj2009@gmail.com', 'isabellen90@gmail.com'].includes(email) && !/^[a-z0-9][a-z0-9._+-]{0,63}@roundrockisd\.org$/.test(email)) return cfaJson_({ ok: false, status: 400, error: 'Use your @roundrockisd.org email.' });
    var secret = props.getProperty('cfa_internal_otp_key');
    if (!secret) {
      secret = Utilities.getUuid() + Utilities.getUuid();
      props.setProperty('cfa_internal_otp_key', secret);
    }
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

/** Pure template. Preview delivery is handled separately; no coupons are issued. */
function buildEasterEggRewardEmail(reward) {
  // The Apps Script editor's Run button supplies no arguments. Never mint a live reward.
  if (arguments.length === 0) reward = { percentage: 35, name: 'Dragon', preview: true };
  if (!reward || [10, 15, 20, 25, 35].indexOf(reward.percentage) === -1) throw new Error('Invalid reward percentage');
  var preview = reward.preview === true;
  if (!preview && !/^[A-Z0-9-]{16,80}$/.test(reward.code || '')) throw new Error('A fulfilled reward code is required');
  var name = String(reward.name || 'Dragon').trim().slice(0, 150);
  var code = preview ? (/^PREVIEW-[A-F0-9]{12}$/.test(reward.reference || '') ? reward.reference : 'NO CODE · DEVELOPMENT PREVIEW') : reward.code;
  var subject = (preview ? '[Preview] ' : '') + 'You Found a Hidden CO-OP Reward! 🎁';
  var terms = 'Valid on the first $25 of your eligible merchandise subtotal. One use only. Excludes taxes, delivery fees, and other noneligible charges. Cannot be combined with other promotional codes. Expires Friday, November 13, 2026, at 11:59 PM Central.';
  var text = (preview ? 'DEVELOPMENT PREVIEW. No coupon was created. Preview references cannot be redeemed.\n\n' : '') +
    'Hi ' + name + ',\n\nCongratulations! You spotted the red CO-OP dragon sticker holding a package in the RRHS CO-OP E-Commerce Easter Egg Hunt!\n\n' +
    "You've unlocked " + reward.percentage + '% OFF your next eligible CO-OP online order.\n\n' +
    (preview ? code : 'Your exclusive discount code: ' + code) + '\n\n' + terms + '\n\n' +
    'Shop now at https://rrhscoop.roundrockisd.org\n\nThanks for participating in our E-Commerce Opening Week!\nRRHS CO-OP';
  var html = cfaEmail_('E-Commerce Opening Week', 'A little luck. A lovely reward.',
    (preview ? '<p style="padding:12px;border:1px dashed #6e1f2a;background:#f1eee8;">Development preview. No coupon was created. Preview references cannot be redeemed.</p>' : '') +
    '<p style="margin:16px 0;text-align:center;"><img src="https://rrhscoop-assets.vercel.app/easter-hunt/dragon-package-sticker.png?v=1" width="128" height="128" alt="Red CO-OP dragon holding a package" style="display:block;width:128px;height:128px;margin:0 auto;object-fit:contain;"></p>' +
    '<p>Hi ' + cfaEscape_(name) + ',</p><p>You found one of our twelve hidden CO-OP dragon stickers. Consider this a little thank-you for exploring the student-run CO-OP.</p>' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px;background:#f1eee8;border-top:3px solid #6e1f2a;border-bottom:1px solid #cbb991;">' +
    '<p style="margin:0;color:#6e1f2a;font:400 56px/1.1 Georgia,serif;">' + reward.percentage + '% OFF</p>' +
    '<p style="margin:12px 0 0;">On the first $25 of your eligible cart subtotal.</p></td></tr></table>' +
    '<p style="margin:24px 0 8px;font-weight:bold;">' + (preview ? 'Preview reference · not redeemable' : 'Your exclusive code') + '</p>' +
    '<p style="padding:16px 12px;background:#fff;border:1px dashed #6e1f2a;color:#6e1f2a;font:600 18px/1.5 monospace;text-align:center;overflow-wrap:anywhere;word-break:break-word;">' + cfaEscape_(code) + '</p>' +
    '<p>' + cfaEscape_(terms) + '</p>' +
    '<table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#6e1f2a" style="border-radius:4px;">' +
    '<a href="https://rrhscoop.roundrockisd.org" style="display:inline-block;padding:14px 24px;color:#faf8f4;text-decoration:none;font-weight:bold;">Shop Now &rarr;</a></td></tr></table>' +
    '<p style="margin-top:24px;">Thanks for participating in our E-Commerce Opening Week!</p>' +
    '<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #d4c9bd;color:#655b55;font-size:13px;">RRHS CO-OP · Built by students. Made for Dragons.<br><a href="mailto:rrhs_coop_store@roundrockisd.org" style="color:#6e1f2a;">Questions? Contact the CO-OP.</a></p>');
  return { subject: subject, text: text, html: html };
}

/** Caller holds the script lock. Preview mail is restricted to the presenter's mailbox. */
function cfaSendHuntPreview_(input, props) {
  if (input.studentId !== 's151579' || [10, 15, 20, 25, 35].indexOf(input.percentage) === -1 || !/^PREVIEW-[A-F0-9]{12}$/.test(input.reference || '')) {
    return { ok: false, status: 400, error: 'Real preview delivery is currently limited to the presenter mailbox.' };
  }
  var key = 'hunt_preview_' + input.reference;
  var previous = JSON.parse(props.getProperty(key) || '{}');
  if (previous.percentage && previous.percentage !== input.percentage) return { ok: false, status: 409, error: 'This preview reference already belongs to another reward.' };
  if (previous.status === 'sent') return { ok: true, emailStatus: 'sent' };
  if (previous.status === 'sending') return { ok: false, status: 503, error: 'Delivery is unconfirmed. Check your inbox before sending another preview.' };
  var day = Utilities.formatDate(new Date(), 'America/Chicago', 'yyyy-MM-dd');
  var rate = JSON.parse(props.getProperty('hunt_preview_rate') || '{}');
  if ((rate.last && Date.now() - rate.last < 60000) || (rate.day === day && rate.count >= 5) || MailApp.getRemainingDailyQuota() < 1) return { ok: false, status: 429, error: 'Preview email limit reached. Wait before trying again; at most five previews are sent per day.' };
  props.setProperty('hunt_preview_rate', JSON.stringify({ day: day, count: (rate.day === day ? rate.count || 0 : 0) + 1, last: Date.now() }));
  props.setProperty(key, JSON.stringify({ status: 'sending', percentage: input.percentage }));
  var email = buildEasterEggRewardEmail({ percentage: input.percentage, name: 'Dragon', preview: true, reference: input.reference });
  try {
    var options = { htmlBody: email.html, name: SENDER_NAME, replyTo: REPLY_TO };
    if (FROM_ALIAS) options.from = FROM_ALIAS;
    GmailApp.sendEmail('s151579@student.roundrockisd.org', email.subject, email.text, options);
    props.setProperty(key, JSON.stringify({ status: 'sent', percentage: input.percentage }));
    return { ok: true, emailStatus: 'sent' };
  } catch (_) {
    // A provider error may occur after acceptance. Do not automatically duplicate mail.
    return { ok: false, status: 503, error: 'Delivery is unconfirmed. Check your inbox before sending another preview.' };
  }
}

/** Optional editor action; setup itself never sends preview messages. */
function sendEasterEggPreview() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Another CO-OP job is running. Try again shortly.');
  try {
    var result = cfaSendHuntPreview_({ studentId: 's151579', percentage: 35, reference: 'PREVIEW-' + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase() }, PropertiesService.getScriptProperties());
    if (!result.ok) throw new Error(result.error);
    Logger.log('Preview email sent to the presenter school mailbox. No coupon was created.');
  } finally { lock.releaseLock(); }
}

function cfaDispatchMessage_(data) {
  var total = data.orders.length;
  var title = total + (total === 1 ? ' faculty preorder' : ' faculty preorders');
  var intro = 'Orders received from yesterday at 4 p.m. through today’s cutoff, ' + data.date + ' at 4 p.m. Central.';
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
  if (Number(Utilities.formatDate(now, timeZone, 'HHmm')) < 1605) return;
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
      number: 'SAMPLE', paymentStatus: 'PAID', name: 'Example Teacher', room: '1234', delivery: 'Next school day',
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
  // Cover both Central cutoff boundaries in either season.
  // Filter again by the local date and cutoff before sending.
  var start = Date.parse(date + 'T00:00:00Z') / 1000;
  var orderUrl = 'https://app.ecwid.com/api/v3/' + config.storeId + '/orders' +
    '?paymentStatus=PAID%2CAWAITING_PAYMENT&productId=' +
    encodeURIComponent(CFA_DISPATCH_PRODUCTS.map(function (product) { return product.id; }).join(',')) +
    '&createdFrom=' + (start - 86400) + '&createdTo=' + (start + 86400) + '&limit=100';

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
  var previousDate = new Date(Date.parse(date + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
  var placedDate = Utilities.formatDate(placed, timeZone, 'yyyy-MM-dd');
  var placedTime = Number(Utilities.formatDate(placed, timeZone, 'HHmm'));
  if (!(placedDate === previousDate && placedTime >= 1600) &&
      !(placedDate === date && placedTime < 1600)) return null;

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
  var pickupTime = pickup ? pickupSchedule(order) : '';
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
    sauces: comment('Sauces') || extra('cfa_sauces') || 'None',
    items: items
  };
}

const SENDER_NAME = 'RRHS CO-OP';
const REPLY_TO = 'rrhs_coop_store@roundrockisd.org';
// To send *from* the store address instead of your own, add it in Gmail under
// Settings → Accounts → "Send mail as", then set FROM_ALIAS to it.
const FROM_ALIAS = '';
const MAX_SENT_IDS = 400;

const COOP_SETUP_VERSION = '2';

/** Read-only connection and template checks. No customer mail or coupon creation. */
function checkCoopSetup() {
  const report = coopSetupChecks_(PropertiesService.getScriptProperties());
  coopLogSetup_(report);
  return report;
}

/** One editor action: validate first, initialize missing state, then install automation. */
function setup() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Another CO-OP job is running. Run setup again in a moment.');
  try {
    const props = PropertiesService.getScriptProperties();
    const report = coopSetupChecks_(props);
    // Retain the same key so setup never invalidates verification codes already sent.
    if (!props.getProperty('cfa_internal_otp_key')) {
      props.setProperty('cfa_internal_otp_key', Utilities.getUuid() + Utilities.getUuid());
    }
    const now = String(Math.floor(Date.now() / 1000));
    if (!props.getProperty('START_AT')) {
      props.setProperty('START_AT', now);
    }
    if (!props.getProperty('SENT_IDS')) props.setProperty('SENT_IDS', '[]');
    if (!props.getProperty('STATUS_START_AT')) props.setProperty('STATUS_START_AT', now);
    if (!props.getProperty('STATUS_CHECKED_AT')) props.setProperty('STATUS_CHECKED_AT', props.getProperty('STATUS_START_AT'));
    const handlers = ['sendPendingReceipts', 'sendCfaDispatch', 'sendOrderStatusUpdates', 'runCoopJobs'];
    const oldTriggers = ScriptApp.getProjectTriggers().filter(trigger => handlers.includes(trigger.getHandlerFunction()));
    // Keep the old automation if Google cannot create its replacement.
    ScriptApp.newTrigger('runCoopJobs').timeBased().everyMinutes(1).create();
    oldTriggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
    props.setProperty('COOP_SETUP_VERSION', COOP_SETUP_VERSION);
    props.setProperty('COOP_HEALTH_CHECKED_DAY', Utilities.formatDate(new Date(), 'America/Chicago', 'yyyy-MM-dd'));
    props.setProperty('COOP_HEALTH_REPORT', JSON.stringify(report));
    coopLogSetup_(report);
    Logger.log('SETUP COMPLETE: one minute trigger installed for receipts, faculty dispatch, status emails, and daily health checks.');
    Logger.log('No test emails were sent. No coupons were created. You do not need to run setup each day.');
    Logger.log('After changing web-app code, update the existing web-app deployment to a new version. setup cannot publish it for you.');
    return report;
  } finally { lock.releaseLock(); }
}

function coopLogSetup_(report) {
  report.checks.forEach(check => Logger.log('PASS: ' + check));
  report.warnings.forEach(warning => Logger.log('WARNING: ' + warning));
  Logger.log(report.warnings.length ? 'Checks completed with warnings; review the messages above.' : 'All configured checks passed.');
}

function coopSetupChecks_(props) {
  const report = { checkedAt: new Date().toISOString(), checks: [], warnings: [], rewardMode: 'preview-mail-only' };
  const config = cfaEcwidConfig_(props);
  for (const key of ['START_AT', 'STATUS_START_AT', 'STATUS_CHECKED_AT']) {
    const value = props.getProperty(key);
    if (value && (!/^\d+$/.test(value) || Number(value) <= 0 || !Number.isSafeInteger(Number(value)))) throw new Error(key + ' is invalid. Restore its saved value before running setup; send history was not reset.');
  }
  const sentIds = props.getProperty('SENT_IDS');
  if (sentIds) {
    let parsed;
    try { parsed = JSON.parse(sentIds); } catch (_) { throw new Error('SENT_IDS is not valid JSON. Restore send history before running setup; it was not reset.'); }
    if (!Array.isArray(parsed) || parsed.some(id => typeof id !== 'string')) throw new Error('SENT_IDS must be an array of sent references. Restore send history before running setup.');
  }
  const secret = props.getProperty('cfa_internal_otp_key');
  if (secret && secret.length < 32) throw new Error('The saved verification key is too short. Check cfa_internal_otp_key; setup will not rotate an existing key.');
  report.checks.push('Saved send history and verification settings');
  const templates = coopTestTemplates_();
  report.checks.push(templates + ' email render checks, including all reward percentages and order statuses');
  const quota = MailApp.getRemainingDailyQuota();
  if (!Number.isInteger(quota) || quota < 0) throw new Error('Google did not return a valid mail quota. Check mail permissions and run setup again.');
  report.mailQuotaRemaining = quota;
  report.checks.push('MailApp authorization and quota access');
  if (quota === 0) report.warnings.push('Mail quota is exhausted. Jobs can send again when Google restores the quota.');
  const aliases = GmailApp.getAliases();
  if (FROM_ALIAS && !aliases.some(alias => alias.toLowerCase() === FROM_ALIAS.toLowerCase())) throw new Error('FROM_ALIAS is not configured as a Gmail send-as alias for this account.');
  report.checks.push('Gmail authorization and configured sender alias');
  const result = JSON.parse(coopEcwidFetch_(config, '/orders?limit=1&responseFields=total,items(id)').getContentText());
  if (!Number.isSafeInteger(result.total) || result.total < 0) throw new Error('Ecwid did not return an order count. Check the store token and order-read access.');
  report.checks.push('Ecwid order-read access');
  const sample = Array.isArray(result.items) && result.items[0];
  if (sample && sample.id != null) {
    receiptPdf_(coopEcwidPdf_(config, '/orders/' + encodeURIComponent(String(sample.id)) + '/invoice-pdf'), 'setup-receipt-check.pdf');
    report.checks.push('Receipt PDF download and PDF content type');
  } else report.warnings.push('No order is available for a receipt PDF download check. Email rendering was checked with fictional orders.');
  if (!ScriptApp.getService().getUrl()) report.warnings.push('No verification web-app deployment was found. Deploy this project as a web app before using website email verification.');
  report.checks.push('Live coupons remain disabled; real preview mail is limited to the presenter mailbox');
  return report;
}

/** Pure render tests with fictional data. Never calls a send function. */
function coopTestTemplates_() {
  let count = 0;
  function verify(email) {
    const plain = email && (email.text || email.body);
    const html = email && (email.html || email.htmlBody);
    if (!email || !email.subject || !plain || !html || !html.includes('RRHS CO-OP') || /\b(?:undefined|NaN)\b/.test(plain + html)) throw new Error('An email template failed its setup render check.');
    count++;
  }
  const sample = { id: 'SETUP-PREVIEW', email: 'preview@example.invalid',
    paymentStatus: 'PAID', fulfillmentStatus: 'AWAITING_PROCESSING', paymentMethod: 'Credit or debit card',
    subtotal: 10, total: 10, billingPerson: { name: 'Example Dragon', firstName: 'Example' },
    items: [{ name: 'Example item', quantity: 1, price: 10 }], shippingOption: { shippingMethodName: 'Classroom delivery' } };
  verify(buildReceiptEmail(sample));
  verify(buildReceiptEmail({ ...sample, paymentStatus: 'AWAITING_PAYMENT' }));
  verify(buildReceiptEmail({ ...sample, paymentStatus: 'AWAITING_PAYMENT', paymentMethod: 'Pay at pickup', shippingOption: { isPickup: true } }));
  const before = orderStatusState_(sample);
  [...STATUS_EVENTS, 'REFUNDED', 'CANCELLED'].forEach(event => verify(buildStatusEmail(sample, event, before)));
  [10, 15, 20, 25, 35].forEach(percentage => verify(buildEasterEggRewardEmail({ percentage: percentage, name: 'Example Dragon', preview: true })));
  verify(buildEasterEggRewardEmail());
  verify(cfaDispatchMessage_({ date: '2026-11-11', orders: [] }));
  verify(cfaDispatchMessage_({ date: '2026-11-11', orders: [{ number: 'SETUP-PREVIEW', name: 'Example Teacher', paymentStatus: 'PAID', pickup: false, room: 'Example room', delivery: 'Example school day', time: '12:45 PM Central', sauces: 'None', items: [{ quantity: 1, name: 'Example item' }] }] }));
  const verification = cfaEmail_('Faculty lunch', 'Your verification code', '<p>Example verification code. Not valid for sign-in.</p>');
  if (!verification.includes('RRHS CO-OP') || !verification.includes('Not valid for sign-in')) throw new Error('The verification email template failed its setup render check.');
  return count + 1;
}

/** The existing minute trigger runs this daily, retrying failed checks after 15 minutes. */
function coopDailyHealthCheck_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('COOP_SETUP_VERSION') !== COOP_SETUP_VERSION) return;
  const day = Utilities.formatDate(new Date(), 'America/Chicago', 'yyyy-MM-dd');
  const now = Date.now();
  if (props.getProperty('COOP_HEALTH_CHECKED_DAY') === day || now - Number(props.getProperty('COOP_HEALTH_ATTEMPT_AT') || 0) < 15 * 60000) return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    if (props.getProperty('COOP_HEALTH_CHECKED_DAY') === day || now - Number(props.getProperty('COOP_HEALTH_ATTEMPT_AT') || 0) < 15 * 60000) return;
    props.setProperty('COOP_HEALTH_ATTEMPT_AT', String(now));
    try {
      const report = coopSetupChecks_(props);
      props.setProperty('COOP_HEALTH_REPORT', JSON.stringify(report));
      props.setProperty('COOP_HEALTH_CHECKED_DAY', day);
      coopLogSetup_(report);
    } catch (error) {
      // Store no raw service errors, credentials, order data or student identifiers.
      props.setProperty('COOP_HEALTH_REPORT', JSON.stringify({ checkedAt: new Date().toISOString(), status: 'failed' }));
      throw new Error('Daily CO-OP health check failed. Run checkCoopSetup in the editor for the specific check. Automatic checks retry in 15 minutes.');
    }
  } finally { lock.releaseLock(); }
}

/** Run every job even if one service is temporarily unavailable. Receipts go before status updates. */
function runCoopJobs() {
  const failures = [];
  for (const job of [sendCfaDispatch, sendPendingReceipts, sendOrderStatusUpdates]) {
    try {
      job();
    } catch (error) {
      failures.push(job.name + ': ' + error.message);
    }
  }
  try { coopDailyHealthCheck_(); } catch (error) { failures.push(error.message); }
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

    const config = cfaEcwidConfig_(props);
    const orders = coopReceiptOrders_(config, since, true, sent);
    orders.forEach(order => {
      const id = String(order.id);
      // ':pickup-confirmation' is the historical key for any unpaid-order confirmation.
      const notificationId = order.paymentStatus === 'AWAITING_PAYMENT' ? id + ':pickup-confirmation' : id;
      if (sent.includes(notificationId)) return;
      try {
        sendReceipt_(order, order.email, config);
        sent.push(notificationId);
        props.setProperty('SENT_IDS', JSON.stringify(sent.slice(-MAX_SENT_IDS)));
      } catch (err) {
        console.error('Receipt for ' + id + ' failed: ' + err.message);
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
  const config = cfaEcwidConfig_(PropertiesService.getScriptProperties());
  const weekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
  const orders = coopReceiptOrders_(config, weekAgo, false);
  if (!orders.length) throw new Error('No paid orders in the last 7 days to use as a sample.');
  const sample = orders[orders.length - 1];
  sendReceipt_(sample, Session.getActiveUser().getEmail(), config);
  Logger.log('Sent a sample receipt for order ' + sample.id + ' to you.');
}

function coopEcwidFetch_(config, path) {
  const response = UrlFetchApp.fetch('https://app.ecwid.com/api/v3/' + config.storeId + path, {
    headers: { Authorization: 'Bearer ' + config.token },
    muteHttpExceptions: true,
    followRedirects: false,
  });
  if (response.getResponseCode() !== 200) {
    throw new Error('Ecwid returned ' + response.getResponseCode() + ' for ' + path.split('?')[0]);
  }
  return response;
}

/**
 * Ecwid answers invoice-pdf with a 302 to a short-lived signed S3 link. Follow it only to
 * Ecwid's PDF bucket, and without the API token (the link carries its own signature).
 */
function coopEcwidPdf_(config, path) {
  return coopFetchPdf_('https://app.ecwid.com/api/v3/' + config.storeId + path,
    { Authorization: 'Bearer ' + config.token }, path.split('?')[0]);
}

/** Tax invoice links point at Ecwid's download page, which also redirects to S3. */
const TAX_INVOICE_LINK = /^https:\/\/app\.(ecwid|shopsettings)\.com\/download_tax_invoice\?/;

function coopFetchPdf_(url, headers, label) {
  const options = { muteHttpExceptions: true, followRedirects: false };
  if (headers) options.headers = headers;
  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();
  if (code === 200) return response;
  if (code !== 301 && code !== 302 && code !== 303 && code !== 307) {
    throw new Error('Ecwid returned ' + code + ' for ' + label);
  }
  const responseHeaders = response.getHeaders() || {};
  const location = String(responseHeaders.Location || responseHeaders.location || '');
  if (!/^https:\/\/save-pdf\.s3\.amazonaws\.com\//.test(location)) {
    throw new Error('Ecwid redirected ' + label + ' to an unexpected address.');
  }
  const pdf = UrlFetchApp.fetch(location, { muteHttpExceptions: true, followRedirects: false });
  if (pdf.getResponseCode() !== 200) {
    throw new Error('Ecwid PDF download returned ' + pdf.getResponseCode() + ' for ' + label);
  }
  return pdf;
}

function coopReadOrders_(config, filters) {
  const orders = [];
  for (let offset = 0; offset < 500; offset += 100) {
    const response = coopEcwidFetch_(config, '/orders?' + filters + '&limit=100&offset=' + offset);
    const page = JSON.parse(response.getContentText());
    if (!Array.isArray(page.items)) throw new Error('Ecwid did not return an order list.');
    orders.push(...page.items);
    if (page.items.length < 100 || orders.length >= page.total) break;
  }
  return orders;
}

/**
 * Orders that need a confirmation or receipt: new paid orders, new unpaid orders (confirmation),
 * and unpaid orders we already confirmed that have since been paid (receipt).
 */
function coopReceiptOrders_(config, since, includeUnpaid = true, sent = []) {
  const paid = coopReadOrders_(config, 'paymentStatus=PAID&createdFrom=' + since);
  const orders = new Map(paid.map(order => [String(order.id), order]));
  if (includeUnpaid) {
    const awaiting = coopReadOrders_(config, 'paymentStatus=AWAITING_PAYMENT&createdFrom=' + since);
    const recentPayments = coopReadOrders_(config, 'paymentStatus=PAID&updatedFrom=' + since);
    for (const order of recentPayments) {
      const id = String(order.id);
      const confirmedUnpaid = sent.includes(id + ':pickup-confirmation') || (facultyPreorder(order) && payAtPickup(order));
      if (!orders.has(id) && confirmedUnpaid) orders.set(id, order);
    }
    for (const order of awaiting) {
      if (!orders.has(String(order.id))) orders.set(String(order.id), order);
    }
  }
  return Array.from(orders.values())
    .filter(order => order.email && !order.hidden && !order.disableAllCustomerNotifications)
    .sort((a, b) => (a.createTimestamp || 0) - (b.createTimestamp || 0));
}

function receiptPdf_(response, name) {
  const blob = response.getBlob();
  if (!String(blob.getContentType()).toLowerCase().includes('application/pdf')) {
    throw new Error('Ecwid did not return a PDF.');
  }
  return blob.setName(name);
}

function sendReceipt_(order, to, config) {
  const id = String(order.id);
  const confirmation = coopEcwidPdf_(config, '/orders/' + encodeURIComponent(id) + '/invoice-pdf');
  const attachments = [receiptPdf_(confirmation, 'Order-Confirmation-' + id + '.pdf')];
  const invoice = order.paymentStatus === 'PAID' && Array.isArray(order.invoices) &&
    order.invoices.find(entry => TAX_INVOICE_LINK.test(entry.link || ''));
  if (invoice) {
    attachments.push(receiptPdf_(coopFetchPdf_(invoice.link, null, 'tax invoice'), 'Tax-Invoice-' + id + '.pdf'));
  }
  const receipt = buildReceiptEmail(order);
  const options = { htmlBody: receipt.html, attachments, name: SENDER_NAME, replyTo: REPLY_TO };
  if (FROM_ALIAS) options.from = FROM_ALIAS;
  GmailApp.sendEmail(to, receipt.subject, receipt.text, options);
}

// Customer receipt formatting.
function isPickup(order) {
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
  return isPickup(order) && /^pay at pickup$/i.test(String(order.paymentMethod || '').trim());
}

function pickupSchedule(order) {
  if (facultyPreorder(order)) {
    const requested = preorderField(order, 'cfa_pickup_schedule') || preorderComment(order, 'Pickup schedule');
    if (requested) return requested;
  }
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

function etaMessage(order, schedule, faculty) {
  if (isPickup(order)) {
    if (schedule) return `Pick up your order at the RRHS CO-OP on ${schedule}.`;
    return faculty ? 'Pick up your preorder at the RRHS CO-OP at your selected time.' :
      `We'll have it ready for pickup in about ${ETA_MINUTES} minutes.`;
  }
  if (schedule) return `We'll bring it to you at your scheduled time: ${schedule}.`;
  return faculty ? 'Check your preorder details for your classroom delivery time.' :
    `We'll have it to you in about ${ETA_MINUTES} minutes.`;
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

function orderRoom_(order) {
  if (isPickup(order)) return '';
  const raw = preorderField(order, 'cfa_delivery_room') || extraField(order, /delivery\s*location|room/i) ||
    (facultyPreorder(order) ? preorderComment(order, 'Room') : '');
  return /^\d+[a-z]?$/i.test(raw) ? `Room ${raw}` : raw;
}

function orderNumber(order) {
  return String(order.id || order.orderNumber || '');
}

function buildReceiptEmail(order) {
  const number = orderNumber(order);
  const name = firstName(order);
  const faculty = facultyPreorder(order);
  const pickup = isPickup(order);
  const awaiting = order.paymentStatus === 'AWAITING_PAYMENT';
  const dueAtPickup = payAtPickup(order) && awaiting;
  const room = orderRoom_(order);
  const schedule = pickup ? pickupSchedule(order) || extraField(order, /^schedule$/i) :
    (faculty ? facultyDeliverySchedule(order) : '') || extraField(order, /^schedule$/i);
  const gift = extraField(order, /gift\s*message/i);
  const sauces = faculty ? preorderComment(order, 'Sauces') : '';
  const status = statusLabel(order.fulfillmentStatus);
  const items = lineItems(order);
  const rows = summaryRows(order);
  const total = Number(order.total) || 0;
  const eta = etaMessage(order, schedule, faculty);
  const greeting = name ? `Thank you, ${name}!` : 'Thank you!';
  const method = pickup && faculty ? 'RRHS CO-OP store' : (order.shippingOption?.shippingMethodName || '');
  const payment = dueAtPickup ? `Pay at pickup · ${money(total)} due` :
    order.paymentStatus === 'PAID' ? (payAtPickup(order) ? 'Paid at pickup' :
      `Paid${order.paymentMethod ? ' · ' + order.paymentMethod : ''}`) :
    awaiting ? `Awaiting payment${order.paymentMethod ? ' · ' + order.paymentMethod : ''}` : order.paymentMethod;
  const intro = dueAtPickup ? 'Your pickup order is confirmed. Please pay when you collect it.' :
    awaiting ? "We've got your order. Payment is still pending." :
    "We've got your order and we're on it.";
  const attachmentNote = !awaiting && order.invoices?.length
    ? 'Your order confirmation and tax invoice are attached as PDFs.'
    : 'Your order confirmation is attached as a PDF.';
  const placed = order.createTimestamp
    ? new Date(order.createTimestamp * 1000).toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '';

  const subject = dueAtPickup ? `Pickup confirmed · Pay at pickup · #${number}` :
    awaiting ? `Order received · Payment pending · #${number}` : `Thank you for your order! Receipt for #${number}`;

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
              ${e(intro)} ${e(eta)}
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
                ${detail('Payment', payment)}
                ${detail('Sauces', sauces)}
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
              ${e(attachmentNote)}
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
    `${intro} ${eta}`,
    '',
    `Order number: #${number}`,
    `Status: ${status}`,
    fullName(order) ? `Name: ${fullName(order)}` : null,
    room || method ? `${isPickup(order) ? 'Pickup' : 'Deliver to'}: ${room || method}` : null,
    schedule ? `Scheduled for: ${schedule}` : null,
    placed ? `Placed: ${placed}` : null,
    payment ? `Payment: ${payment}` : null,
    sauces ? `Sauces: ${sauces}` : null,
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
    attachmentNote,
    `Questions? Reply to this email or write to ${STORE_EMAIL}.`,
    '',
    `${STORE_NAME} - ${STORE_URL}`,
  ]
    .filter((line) => line !== null)
    .join('\n');

  return { subject, html, text };
}


// ---------------------------------------------------------------------------
// Order status emails. These replace Ecwid's built-in customer notifications:
// order status changed, shipped, ready for pickup, delivered, refunded, cancelled.
// Order confirmations and receipts are sent by sendPendingReceipts above.
// ---------------------------------------------------------------------------

const STATUS_KEY_PREFIX = 'os_';
const STATUS_OVERLAP_SECONDS = 5 * 60;
const STATUS_NEW_ORDER_SECONDS = 2 * 24 * 60 * 60;
const STATUS_KEEP_DAYS = 45;
const STATUS_EVENTS = ['PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'READY_FOR_PICKUP', 'DELIVERED', 'WILL_NOT_DELIVER', 'RETURNED'];

function trackingNumber_(order) {
  if (order.trackingNumber) return String(order.trackingNumber);
  const shipment = (Array.isArray(order.shipments) ? order.shipments : [])
    .find(entry => entry && (entry.trackingNumber || entry.tracking?.trackingNumber));
  return shipment ? String(shipment.trackingNumber || shipment.tracking.trackingNumber) : '';
}

function orderStatusState_(order) {
  return {
    p: String(order.paymentStatus || ''),
    f: String(order.fulfillmentStatus || ''),
    r: Math.round((Number(order.refundedAmount) || 0) * 100),
    t: trackingNumber_(order),
  };
}

function readStatusState_(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch (_) { return null; }
}

/** Customer-facing events between the last state we saw and the order now. */
function orderStatusEvents_(before, order) {
  const after = orderStatusState_(order);
  const events = [];
  if (after.p === 'CANCELLED') return before.p === 'CANCELLED' ? [] : ['CANCELLED'];
  const refundedNow = /REFUNDED$/.test(after.p) && after.p !== before.p;
  if (after.r > before.r || refundedNow) events.push('REFUNDED');
  if (after.f !== before.f && STATUS_EVENTS.includes(after.f)) events.push(after.f);
  else if (after.t && after.t !== before.t) events.push('SHIPPED');
  return events;
}

function canEmailCustomer_(order) {
  return Boolean(order.email) && !order.hidden && !order.disableAllCustomerNotifications;
}

/** Runs every minute: emails customers when staff change an order's status in Ecwid. */
function sendOrderStatusUpdates() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const props = PropertiesService.getScriptProperties();
    const now = Math.floor(Date.now() / 1000);
    let startAt = Number(props.getProperty('STATUS_START_AT'));
    if (!startAt) {
      // First run: orders that already exist are recorded without sending anything.
      startAt = now;
      props.setProperty('STATUS_START_AT', String(now));
    }
    const checkedAt = Number(props.getProperty('STATUS_CHECKED_AT')) || startAt;
    const config = cfaEcwidConfig_(props);
    const orders = coopReadOrders_(config, 'updatedFrom=' + (Math.min(checkedAt, now) - STATUS_OVERLAP_SECONDS))
      .sort((a, b) => (a.updateTimestamp || 0) - (b.updateTimestamp || 0));
    let failed = false;
    orders.forEach(order => {
      const key = STATUS_KEY_PREFIX + order.id;
      const created = Number(order.createTimestamp) || 0;
      const isNew = created >= startAt && created >= now - STATUS_NEW_ORDER_SECONDS;
      const before = readStatusState_(props.getProperty(key)) ||
        (isNew ? { p: '', f: 'AWAITING_PROCESSING', r: 0, t: '' } : orderStatusState_(order));
      try {
        if (canEmailCustomer_(order)) {
          orderStatusEvents_(before, order).forEach(event => sendStatusEmail_(order, event, before, order.email));
        }
        props.setProperty(key, JSON.stringify({ ...orderStatusState_(order), at: now }));
      } catch (err) {
        failed = true;
        console.error('Status email for ' + order.id + ' failed: ' + err.message);
      }
    });
    // On a failure, keep the old checkpoint so the next run retries those orders.
    if (!failed) props.setProperty('STATUS_CHECKED_AT', String(now));
    pruneStatusStates_(props, now);
  } finally {
    lock.releaseLock();
  }
}

function pruneStatusStates_(props, now) {
  const today = String(Math.floor(now / 86400));
  if (props.getProperty('STATUS_PRUNED_DAY') === today) return;
  const all = props.getProperties();
  Object.keys(all).forEach(key => {
    if (key.indexOf(STATUS_KEY_PREFIX) !== 0) return;
    const state = readStatusState_(all[key]);
    if (!state || !state.at || state.at < now - STATUS_KEEP_DAYS * 86400) props.deleteProperty(key);
  });
  props.setProperty('STATUS_PRUNED_DAY', today);
}

function sendStatusEmail_(order, event, before, to, subjectPrefix = '') {
  const email = buildStatusEmail(order, event, before);
  const options = { htmlBody: email.html, name: SENDER_NAME, replyTo: REPLY_TO };
  if (FROM_ALIAS) options.from = FROM_ALIAS;
  GmailApp.sendEmail(to, subjectPrefix + email.subject, email.text, options);
}

function statusEmailCopy_(order, event, before) {
  const pickup = isPickup(order);
  const room = orderRoom_(order);
  const tracking = trackingNumber_(order);
  const total = Number(order.total) || 0;
  const dueAtPickup = payAtPickup(order) && order.paymentStatus === 'AWAITING_PAYMENT';
  const card = /card|stripe|apple pay|google pay|link/i.test(order.paymentMethod || '');
  switch (event) {
    case 'PROCESSING':
      return { title: 'We’re preparing your order', message: 'A CO-OP student is getting your order ready now.' };
    case 'SHIPPED':
    case 'OUT_FOR_DELIVERY':
      if (pickup) return statusEmailCopy_(order, 'READY_FOR_PICKUP', before);
      return {
        title: 'Your order is on its way',
        message: room ? `A CO-OP student is bringing your order to ${room}.` : 'A CO-OP student is on the way with your order.',
        extra: tracking ? `Tracking number: ${tracking}` : '',
      };
    case 'READY_FOR_PICKUP':
      return {
        title: 'Your order is ready for pickup',
        message: 'Stop by the RRHS CO-OP store to pick it up.',
        extra: dueAtPickup ? `Please pay ${money(total)} when you collect it.` : '',
      };
    case 'DELIVERED':
      return pickup
        ? { title: 'Your order was picked up', message: 'Thanks for picking up your order. Enjoy!' }
        : { title: 'Your order was delivered', message: `We dropped off your order${room ? ' at ' + room : ''}. Enjoy!` };
    case 'WILL_NOT_DELIVER':
      return { title: 'We couldn’t complete your order', message: 'Something came up and we weren’t able to deliver this order. Reply to this email and we’ll make it right.' };
    case 'RETURNED':
      return { title: 'Your order was returned', message: 'We’ve marked this order as returned. If a refund is due, you’ll get a separate email when it’s issued.' };
    case 'REFUNDED': {
      const refunded = (Number(order.refundedAmount) || 0) - (Number(before && before.r) || 0) / 100;
      const amount = refunded > 0 ? refunded : total;
      return {
        title: 'Your refund is on the way',
        message: `We refunded ${money(amount)}${order.paymentMethod ? ' to your ' + order.paymentMethod.toLowerCase() : ''}.`,
        extra: card ? 'Card refunds usually take 5–10 business days to show up.' : '',
      };
    }
    case 'CANCELLED':
      return { title: 'Your order was cancelled', message: 'This order has been cancelled. If you already paid, you’ll get a separate email when your refund is issued.' };
    default:
      return { title: 'Your order was updated', message: `Your order status is now: ${statusLabel(order.fulfillmentStatus)}.` };
  }
}

function buildStatusEmail(order, event, before) {
  const number = orderNumber(order);
  const name = firstName(order);
  const copy = statusEmailCopy_(order, event, before);
  const pickup = isPickup(order);
  // The badge names the update being announced, not whatever Ecwid shows now.
  const status = event === 'REFUNDED' ? 'Refunded' : event === 'CANCELLED' ? 'Cancelled' :
    pickup && /^(SHIPPED|OUT_FOR_DELIVERY)$/.test(event) ? 'Ready for pickup' :
    pickup && event === 'DELIVERED' ? 'Picked up' : statusLabel(event);
  const items = lineItems(order);
  const total = Number(order.total) || 0;
  const subject = `${copy.title} · #${number}`;
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const e = escapeHtml;
  const c = COLORS;

  const itemRows = items.map(it => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid ${c.line};font-size:15px;color:${c.ink};">${e(it.name)} <span style="color:${c.muted};">&times; ${it.quantity}</span></td>
          <td style="padding:8px 0;border-bottom:1px solid ${c.line};font-size:15px;color:${c.ink};text-align:right;white-space:nowrap;">${money(it.total)}</td>
        </tr>`).join('');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${e(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${c.paper};font-family:Georgia,'Times New Roman',serif;color:${c.ink};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${e(copy.message)}</div>
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
              <div style="font-size:28px;line-height:1.2;color:${c.maroon};font-weight:bold;">${e(copy.title)}</div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:10px 40px 24px;font-size:16px;line-height:1.55;color:${c.ink};">
              ${e(greeting)}<br>${e(copy.message)}${copy.extra ? `<br><br><strong>${e(copy.extra)}</strong>` : ''}
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
            <td style="padding:20px 32px 0;">
              <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${c.muted};padding-bottom:4px;border-bottom:2px solid ${c.ink};">Your items</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows}
                <tr>
                  <td style="padding:10px 0 0;font-size:16px;font-weight:bold;color:${c.ink};">Total</td>
                  <td style="padding:10px 0 0;font-size:16px;font-weight:bold;color:${c.maroon};text-align:right;">${money(total)}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 32px;font-size:14px;line-height:1.55;color:${c.muted};">
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
    copy.title,
    '',
    greeting,
    copy.message,
    copy.extra || null,
    '',
    `Order number: #${number}`,
    `Status: ${status}`,
    '',
    'Your items:',
    ...items.map(it => `- ${it.name} x${it.quantity}: ${money(it.total)}`),
    `Total: ${money(total)}`,
    '',
    `Questions? Reply to this email or write to ${STORE_EMAIL}.`,
    '',
    `${STORE_NAME} - ${STORE_URL}`,
  ].filter(line => line !== null).join('\n');

  return { subject, html, text };
}

/** Emails you one sample of every status email, built from the latest order. Marks nothing as sent. */
function sendTestStatusEmails() {
  const config = cfaEcwidConfig_(PropertiesService.getScriptProperties());
  const [sample] = coopReadOrders_(config, 'limit=1');
  if (!sample) throw new Error('No orders found to use as a sample.');
  const to = Session.getActiveUser().getEmail();
  const before = { ...orderStatusState_(sample), r: 0 };
  ['PROCESSING', 'SHIPPED', 'READY_FOR_PICKUP', 'DELIVERED', 'WILL_NOT_DELIVER', 'RETURNED', 'REFUNDED', 'CANCELLED']
    .forEach(event => sendStatusEmail_(sample, event, before, to, '[Preview] '));
  Logger.log('Sent 8 sample status emails for order ' + sample.id + ' to ' + to + '.');
}

/* District-account email verification for faculty Chick-fil-A preorders.
 * Deploy as a web app: execute as the district account, access Anyone.
 * Set CFA_VERIFICATION_SECRET in Script Properties to the same random secret as
 * RRHS_CFA_VERIFICATION_SECRET in Vercel. Only the Vercel server calls this app.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return cfaJson_({ ok: false, status: 429, error: 'Please wait a moment and try again.' });
  try {
    var input = JSON.parse(e.postData.contents || '{}');
    var props = PropertiesService.getScriptProperties();
    var secret = props.getProperty('CFA_VERIFICATION_SECRET');
    if (!secret || secret.length < 32 || !cfaEqual_(String(input.secret || ''), secret)) return cfaJson_({ ok: false, status: 401, error: 'Verification service is not connected.' });
    var email = String(input.email || '').trim().toLowerCase();
    if (email !== 'varunnagaraj2009@gmail.com' && !/^[a-z0-9][a-z0-9._+-]{0,63}@roundrockisd\.org$/.test(email)) return cfaJson_({ ok: false, status: 400, error: 'Use your @roundrockisd.org email.' });
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
    var delivery = [order.delivery, order.time].filter(Boolean).join(' · ');
    var items = order.items.map(function (item) { return item.quantity + ' × ' + item.name; });
    var payment = order.paymentStatus === 'PAID' ? 'Paid' : 'Awaiting payment';
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

// Run once from the Apps Script editor to install the daily dispatch.
function installCfaDispatchTrigger() {
  var secret = PropertiesService.getScriptProperties().getProperty('CFA_DISPATCH_SECRET');
  if (!secret || secret.length < 32) throw new Error('Set the CFA_DISPATCH_SECRET Script Property first.');
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'sendCfaDispatch') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('sendCfaDispatch').timeBased().everyMinutes(1).create();
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
    var secret = props.getProperty('CFA_DISPATCH_SECRET');
    if (!secret || secret.length < 32) throw new Error('Missing CFA_DISPATCH_SECRET.');
    var response = UrlFetchApp.fetch('https://rrhscoop-assets.vercel.app/api/v1/teachers/dispatch', {
      headers: { 'X-CFA-Dispatch-Secret': secret },
      muteHttpExceptions: true
    });
    if (response.getResponseCode() !== 200) throw new Error('Dispatch endpoint returned ' + response.getResponseCode());
    var data = JSON.parse(response.getContentText());
    if (data.date !== date || !Array.isArray(data.orders)) throw new Error('Dispatch response did not match today.');
    var message = cfaDispatchMessage_(data);
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

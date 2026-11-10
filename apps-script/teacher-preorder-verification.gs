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
    if (!/^[a-z0-9][a-z0-9._+-]{0,63}@roundrockisd\.org$/.test(email)) return cfaJson_({ ok: false, status: 400, error: 'Use your @roundrockisd.org email.' });
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
      MailApp.sendEmail({ to: email, subject: code + ' is your RRHS CO-OP verification code', body: 'Your faculty lunch verification code is ' + code + '.\n\nIt expires in 10 minutes. Only enter it on the RRHS CO-OP teacher preorder page. If you did not request it, ignore this email.\n\nRRHS CO-OP', name: 'RRHS CO-OP' });
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

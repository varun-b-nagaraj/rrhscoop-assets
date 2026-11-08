/**
 * RRHS CO-OP order receipts — Google Apps Script sender.
 *
 * Runs every minute under YOUR Google account, asks the RRHS server for paid
 * orders that need a receipt, and sends each one with Gmail (HTML body +
 * order confirmation PDF + tax invoice PDF). Because Gmail sends it as you,
 * in-domain addresses like s151579@student.roundrockisd.org accept it.
 *
 * Setup (once):
 *   1. Project Settings → Script Properties → add RECEIPTS_SECRET with the same
 *      value as RRHS_RECEIPTS_SECRET in Vercel.
 *   2. Run setup() from the editor and approve the permissions.
 *      It records "now" as the start point (no old orders get emailed) and
 *      installs the 1-minute trigger.
 *   Optional: run sendTestReceipt() first to email yourself a sample.
 */

const RECEIPTS_API = 'https://rrhscoop-assets.vercel.app/api/v1/receipts';
const SENDER_NAME = 'RRHS CO-OP';
const REPLY_TO = 'rrhs_coop_store@roundrockisd.org';
// To send *from* the store address instead of your own, add it in Gmail under
// Settings → Accounts → "Send mail as", then set FROM_ALIAS to it.
const FROM_ALIAS = '';
const MAX_SENT_IDS = 400;

/**
 * Default entry point. New Apps Script projects start with "myFunction"
 * selected in the Run menu, so keeping it here means pressing Run just works:
 * it turns receipts on (safe to run again; it never re-sends old orders).
 */
function myFunction() {
  setup();
}

function setup() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('RECEIPTS_SECRET')) {
    throw new Error('Add RECEIPTS_SECRET in Project Settings → Script Properties first.');
  }
  if (!props.getProperty('START_AT')) {
    props.setProperty('START_AT', String(Math.floor(Date.now() / 1000)));
  }
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'sendPendingReceipts')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendPendingReceipts').timeBased().everyMinutes(1).create();
  Logger.log('Receipts are on. Orders paid after now will be emailed automatically.');
}

function sendPendingReceipts() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return; // a previous run is still going
  try {
    const props = PropertiesService.getScriptProperties();
    const startAt = Number(props.getProperty('START_AT')) || Math.floor(Date.now() / 1000);
    const since = Math.max(startAt, Math.floor(Date.now() / 1000) - 24 * 60 * 60);
    const sent = JSON.parse(props.getProperty('SENT_IDS') || '[]');

    const data = apiJson_('/pending?since=' + since);
    (data.receipts || []).forEach((receipt) => {
      if (sent.indexOf(receipt.orderId) !== -1) return;
      try {
        sendReceipt_(receipt, receipt.to);
        sent.push(receipt.orderId);
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
  const receipts = apiJson_('/pending?since=' + weekAgo).receipts || [];
  if (!receipts.length) throw new Error('No paid orders in the last 7 days to use as a sample.');
  const sample = receipts[receipts.length - 1];
  sendReceipt_(sample, Session.getActiveUser().getEmail());
  Logger.log('Sent a sample receipt for order ' + sample.orderId + ' to you.');
}

function sendReceipt_(receipt, to) {
  const attachments = (receipt.attachments || []).map((a) =>
    apiFetch_(a.url).getBlob().setName(a.filename)
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

function apiJson_(path) {
  return JSON.parse(apiFetch_(RECEIPTS_API + path).getContentText());
}

function apiFetch_(url) {
  const secret = PropertiesService.getScriptProperties().getProperty('RECEIPTS_SECRET');
  const resp = UrlFetchApp.fetch(url, {
    headers: { 'X-Receipts-Secret': secret },
    muteHttpExceptions: true,
  });
  if (resp.getResponseCode() !== 200) {
    throw new Error(url + ' responded ' + resp.getResponseCode() + ': ' + resp.getContentText().slice(0, 200));
  }
  return resp;
}

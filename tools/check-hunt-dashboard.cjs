'use strict';
const assert = require('node:assert/strict');
const { chromium } = require(process.argv[2] || 'playwright');
const { createServer } = require('./easter-hunt-preview.cjs');
const server = createServer();
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch();
  try {
    // Different top-level origins exercise the same privacy boundaries as Vercel + Ecwid.
    const asset = 'https://rrhscoop-assets.vercel.app', shop = 'https://rrhscoop.roundrockisd.org';
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(() => { Date.now = () => Date.parse('2026-11-10T12:00:00-06:00'); try { sessionStorage.setItem('rrhs-hunt-intro-seen', 'true'); } catch (_) {} });
    const outbound = [], errors = [];
    context.on('request', request => outbound.push(request.url() + (request.postData() || '')));
    const route = async request => {
      const url = new URL(request.request().url());
      if (url.origin === shop) {
        return request.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${asset}/custom-visuals/theme-tokens.css"></head><body><header class="ins-header"><a class="ins-header__icon--search" href="#">Search</a></header><main><h1>CO-OP presentation</h1><h2 data-egg-location="inventory-intelligence">Inventory Intelligence</h2></main><script src="${asset}/easter-hunt/boot.js?v=6"></script></body></html>` });
      }
      const response = await fetch(base + url.pathname + url.search);
      return request.fulfill({ status: response.status, contentType: response.headers.get('content-type'), body: Buffer.from(await response.arrayBuffer()), headers: { 'Access-Control-Allow-Origin': '*' } });
    };
    await context.route(asset + '/**', route); await context.route(shop + '/**', route);
    const dashboard = await context.newPage(); dashboard.on('pageerror', error => errors.push(error.message));
    await dashboard.goto(asset + '/easter-hunt/dashboard');
    assert.equal(await dashboard.locator('#claims tr').count(), 0);
    const opened = context.waitForEvent('page'); await dashboard.locator('#open-store').click(); const storefront = await opened;
    storefront.on('pageerror', error => errors.push(error.message));
    await storefront.locator('.hunt-egg').waitFor({ state: 'visible' });
    await dashboard.getByText('Connected to your storefront.', { exact: false }).waitFor();
    await storefront.locator('.hunt-egg').click(); await storefront.locator('#hunt-student').fill('s151579');
    await storefront.locator('.hunt-dialog [type=submit]').click();
    await storefront.getByText('Preview reward reserved.', { exact: false }).waitFor();
    await dashboard.getByText('s151579', { exact: true }).waitFor();
    const reference = await dashboard.locator('#claims code').innerText(); assert.match(reference, /^PREVIEW-/);
    assert.doesNotMatch(await storefront.locator('.hunt-dialog').innerText(), /PREVIEW-[A-F0-9]/, 'Site must not reveal the preview reference as a coupon');
    await dashboard.getByRole('button', { name: 'View preview' }).click();
    await dashboard.frameLocator('#email-frame').getByText(reference, { exact: false }).waitFor();
    assert.match(await dashboard.locator('#email-recipient').innerText(), /s151579@student.roundrockisd.org/);
    assert.ok(outbound.every(value => !value.includes('s151579')), 'Entered student data must not be sent to a server');
    await dashboard.locator('#close-email').click();
    if (process.argv[3]) await dashboard.screenshot({ path: process.argv[3] + '/dashboard-desktop.png', fullPage: true });
    assert.deepEqual(errors, []);
    // Simulate closing/reopening the browser using its saved localStorage state.
    const persisted = await context.storageState();
    const reopened = await browser.newContext({ storageState: persisted, viewport: { width: 375, height: 812 } });
    await reopened.route(asset + '/**', route); const mobile = await reopened.newPage(); await mobile.goto(asset + '/easter-hunt/dashboard');
    await mobile.getByText('s151579', { exact: true }).waitFor(); assert.equal(await mobile.locator('#promo-toggle').isChecked(), true);
    assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (process.argv[3]) await mobile.screenshot({ path: process.argv[3] + '/dashboard-mobile.png', fullPage: true });
    const stranger = await browser.newContext(); await stranger.route(asset + '/**', route); const fresh = await stranger.newPage();
    await fresh.goto(asset + '/easter-hunt/dashboard'); assert.equal(await fresh.locator('#claims tr').count(), 0, 'Another browser must see no personal records');
    assert.doesNotMatch(await fresh.locator('body').innerText(), /s151579/);
    await storefront.reload();
    await storefront.waitForFunction(() => window.RRHS_HUNT_DEMO);
    await dashboard.getByText('Connected to your storefront.', { exact: false }).waitFor();
    await dashboard.locator('#reset').click(); await dashboard.locator('#confirm-reset').click();
    await dashboard.locator('#claims tr').waitFor({ state: 'detached' });
    await storefront.locator('.hunt-egg').waitFor({ state: 'visible' });
    assert.deepEqual(errors, []);
    await context.close(); await reopened.close(); await stranger.close();
    console.log('Passed hosted cross-origin claim logging, private browser persistence, email preview, mobile layout, no student-data uploads, and reset checks.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });

'use strict';
const assert = require('node:assert/strict');
const { chromium } = require(process.argv[2] || 'playwright');
const { createServer } = require('./easter-hunt-preview.cjs');
(async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(base + '/iframes/projects/index.html');
    await page.locator('.hunt-tour').waitFor({state:'visible'});
    await page.evaluate(() => RRHS_HUNT_INTRO.dismiss());
    // Same-document store navigation must not replay it.
    await page.evaluate(() => { history.pushState({}, '', '?product=one'); document.dispatchEvent(new CustomEvent('rrhs-hunt-toggle',{detail:{enabled:true}})); });
    await page.waitForTimeout(1600);
    assert.equal(await page.locator('.hunt-tour, .hunt-intro-dialog').count(), 0);
    // Full navigation to another store page keeps the tab's discovery marker.
    await page.goto(base + '/iframes/faq/index.html');
    await page.waitForFunction(() => window.RRHS_HUNT_INTRO);
    await page.waitForTimeout(1600);
    assert.equal(await page.locator('.hunt-tour, .hunt-intro-dialog').count(), 0);
    // A real reload starts it again, even with the marker already present.
    await page.reload();
    await page.locator('.hunt-tour').waitFor({state:'visible'});
    await page.evaluate(() => RRHS_HUNT_INTRO.dismiss());
    // Re-enabling in the same reloaded document must not schedule it twice.
    await page.evaluate(() => {
      document.dispatchEvent(new CustomEvent('rrhs-hunt-toggle',{detail:{enabled:false}}));
      document.dispatchEvent(new CustomEvent('rrhs-hunt-toggle',{detail:{enabled:true}}));
    });
    await page.waitForTimeout(1600);
    assert.equal(await page.locator('.hunt-tour, .hunt-intro-dialog').count(), 0);
    await page.evaluate(() => RRHS_HUNT_INTRO.open());
    await page.locator('.hunt-intro-dialog').waitFor({state:'visible'});
    console.log('Passed first visit, SPA navigation, full page navigation, reload, repeated activation and manual guide reopening.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode=1; });

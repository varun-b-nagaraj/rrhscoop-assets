'use strict';
const assert = require('node:assert/strict');
const { chromium } = require(process.argv[2] || 'playwright');
const { createServer } = require('./easter-hunt-preview.cjs');
(async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch();
  try {
    for (const viewport of [{ width:1440, height:960 }, { width:375, height:812 }, { width:844, height:390 }]) {
      for (const reduced of [false, true]) {
        const page = await browser.newPage({ viewport, reducedMotion: reduced ? 'reduce' : 'no-preference' });
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => sessionStorage.setItem('rrhs-hunt-intro-off','true'));
        await page.goto(`http://127.0.0.1:${server.address().port}/iframes/projects/index.html`);
        await page.waitForFunction(() => window.RRHS_HUNT_INTRO);
        await page.evaluate(() => window.RRHS_HUNT_INTRO.open());
        for (let step=0; step<4; step++) {
          await page.waitForTimeout(reduced ? 30 : 750);
          const layout = await page.evaluate(() => {
            const dialog = document.querySelector('.hunt-intro-dialog');
            const active = dialog.querySelector('.hunt-step.is-active');
            const box = dialog.getBoundingClientRect(), section = active.getBoundingClientRect();
            const nav = dialog.querySelector('.hunt-step-nav').getBoundingClientRect();
            return { width:box.width, height:box.height, overflow:dialog.scrollWidth-dialog.clientWidth,
              visible:[...dialog.querySelectorAll('.hunt-step')].filter(el=>getComputedStyle(el).display!=='none').length,
              gap:nav.top-section.bottom, scroll:dialog.scrollHeight-dialog.clientHeight };
          });
          assert.equal(layout.visible,1,'Inactive slides must not reserve space');
          assert.ok(layout.overflow<=1,'Guide must not overflow horizontally');
          assert.ok(layout.gap>=15 && layout.gap<=25,'Navigation should sit close to the slide');
          if (viewport.height>550) assert.ok(layout.scroll<=1,'Guide should fit desktop and portrait mobile');
          if (process.argv[3] && !reduced) await page.screenshot({path:`${process.argv[3]}/guide-${viewport.width}-${step}.png`});
          if (step<3) await page.locator('.hunt-step-next').click();
        }
        await page.locator('.hunt-step-back').click();
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.hunt-intro-dialog').count(),0);
        assert.deepEqual(errors,[]);
        await page.close();
      }
    }
    console.log('Passed all four guide slides on desktop, mobile and landscape, with reduced motion, content-sized layout, navigation and Escape.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode=1; });

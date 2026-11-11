'use strict';
const assert = require('node:assert/strict');
const { chromium } = require(process.argv[2] || 'playwright');
const { createServer } = require('./easter-hunt-preview.cjs');
(async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch();
  try {
    for (const viewport of [{ width:1440, height:960 }, { width:375, height:812 }, { width:320, height:568 }, { width:844, height:390 }]) {
      for (const reduced of [false, true]) {
        const page = await browser.newPage({ viewport, reducedMotion: reduced ? 'reduce' : 'no-preference' });
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => sessionStorage.setItem('rrhs-hunt-intro-off','true'));
        await page.goto(`http://127.0.0.1:${server.address().port}/iframes/projects/index.html`);
        await page.waitForFunction(() => window.RRHS_HUNT_INTRO);
        await page.evaluate(() => window.RRHS_HUNT_INTRO.open());
        let anchor;
        for (let step=0; step<4; step++) {
          await page.waitForTimeout(reduced ? 30 : 750);
          const layout = await page.evaluate(() => {
            const dialog = document.querySelector('.hunt-intro-dialog');
            const active = dialog.querySelector('.hunt-step.is-active');
            const box = dialog.getBoundingClientRect(), section = active.getBoundingClientRect();
            const nav = dialog.querySelector('.hunt-step-nav').getBoundingClientRect();
            return { artBottom:Math.max(...[active.querySelector('.hunt-hero'), ...active.querySelector('.hunt-hero').children].map(el=>el.getBoundingClientRect().bottom)), headingTop:active.querySelector('h2').getBoundingClientRect().top, width:box.width, height:box.height, overflow:dialog.scrollWidth-dialog.clientWidth,
              visible:[...dialog.querySelectorAll('.hunt-step')].filter(el=>getComputedStyle(el).visibility==='visible').length,
              next: (() => { const r=dialog.querySelector('.hunt-step-next').getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; })(),
              back: (() => { const r=dialog.querySelector('.hunt-step-back').getBoundingClientRect(); return {width:r.width,height:r.height}; })(),
              dots: (() => { const r=dialog.querySelector('.hunt-dots').getBoundingClientRect(); return {bottom:r.bottom}; })(),
              gap:nav.top-dialog.querySelector('.hunt-steps').getBoundingClientRect().bottom, scroll:dialog.scrollHeight-dialog.clientHeight };
          });
          assert.ok(Math.abs(layout.back.width-layout.next.width)<1 && Math.abs(layout.back.height-layout.next.height)<1,`Back and Next must have matching button sizes (${viewport.width}, step ${step}, ${JSON.stringify(layout.back)} ${JSON.stringify(layout.next)})`);
          assert.ok(layout.artBottom<=layout.headingTop,'Artwork must not overlap the heading');
          assert.equal(layout.visible,1,'Only the active slide should be visible');
          if (!anchor) anchor=layout.next;
          for (const key of ['x','y','width','height']) assert.ok(Math.abs(layout.next[key]-anchor[key])<1, `Button ${key} must stay fixed across slides (${viewport.width}x${viewport.height}, step ${step}, ${JSON.stringify(anchor)} -> ${JSON.stringify(layout.next)})`);
          assert.ok(layout.next.y>=0 && layout.next.y+layout.next.height<=viewport.height,'Primary button should remain visible even in landscape');
          assert.ok(layout.dots.bottom+8<=layout.next.y,'Dots must stay clear of the final button');
          assert.ok(layout.overflow<=1,'Guide must not overflow horizontally');
          assert.ok(layout.gap>=15 && layout.gap<=25,'Navigation should sit close to the slide');
          if (viewport.height>550) assert.ok(layout.scroll<=1,'Guide should fit desktop and portrait mobile');
          if (process.argv[3] && !reduced) await page.screenshot({path:`${process.argv[3]}/guide-${viewport.width}-${step}.png`});
          if (step<3) await page.locator('.hunt-step-next').click();
        }
        await page.locator('.hunt-step-back').click();
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.hunt-intro-dialog').count(),0);
        await page.evaluate(() => window.RRHS_HUNT_INTRO.open());
        for (let i=0;i<4;i++) await page.locator('.hunt-step-next').click();
        await page.locator('.hunt-intro-dialog').waitFor({state:'detached',timeout:1000});
        assert.deepEqual(errors,[]);
        await page.close();
      }
    }
    console.log('Passed all four guide slides on desktop, mobile and landscape, with reduced motion, stable button positions, separated dots, navigation and Escape.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode=1; });

'use strict';
const assert = require('node:assert/strict');
const { chromium } = require(process.argv[2] || 'playwright');
const { createServer } = require('./easter-hunt-preview.cjs');
const server = createServer();
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch();
  try {
    for (const viewport of [{ width: 1440, height: 960 }, { width: 375, height: 812 }, { width: 844, height: 390 }]) {
      const page = await browser.newPage({ viewport, reducedMotion: 'no-preference' });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => { sessionStorage.setItem('rrhs-hunt-intro-seen', 'true'); });
      await page.goto('http://127.0.0.1:' + server.address().port + '/iframes/projects/index.html');
      await page.waitForFunction(() => window.RRHS_HUNT_INTRO);
      await page.evaluate(() => window.RRHS_HUNT_INTRO.replay());
      const samples = [];
      for (let i = 0; i < 65; i++) {
        samples.push(await page.evaluate(() => {
          const lens = document.querySelector('.hunt-lens'), hole = document.querySelector('.hunt-spotlight-hole');
          const circle = lens.querySelector('circle').getBoundingClientRect();
          const m = new DOMMatrix(getComputedStyle(lens).transform);
          return { x: circle.x + circle.width / 2, y: circle.y + circle.height / 2,
            lightX: Number(hole.getAttribute('cx')), lightY: Number(hole.getAttribute('cy')), scale: Math.hypot(m.a, m.b) };
        }));
        await page.waitForTimeout(80);
      }
      assert.ok(Math.max(...samples.map(s => s.scale)) - Math.min(...samples.map(s => s.scale)) > .4, 'Glass should visibly zoom between search stops');
      for (const sample of samples) {
        assert.ok(sample.scale >= .94 && sample.scale <= 1.46, 'Searching glass should stay within the intended zoom range');
        assert.ok(Math.abs(sample.x - sample.lightX) < 1 && Math.abs(sample.y - sample.lightY) < 1, 'Light must stay centered inside the moving glass');
      }
      await page.locator('.hunt-tour-package').waitFor({ state: 'visible' });
      await page.waitForTimeout(500);
      const settled = await page.locator('.hunt-lens').evaluate(el => { const m = new DOMMatrix(getComputedStyle(el).transform); return Math.hypot(m.a, m.b); });
      assert.ok(Math.abs(settled - .95) < .01, 'Glass should settle into a compact frame around the dragon');
      assert.equal(await page.locator('.hunt-tour-package').evaluate(el => el === document.activeElement), false, 'Dragon must not receive automatic focus/highlight');
      await page.keyboard.press('Tab');
      await page.locator('.hunt-tour-package').focus();
      assert.equal(await page.locator('.hunt-tour-package').evaluate(el => getComputedStyle(el).outlineStyle), 'none', 'Keyboard focus must not draw a box around the dragon');
      assert.equal(await page.locator('.hunt-tour-package').evaluate(el => getComputedStyle(el, '::after').height), '3px', 'Keyboard users retain a small focus underline');
      if (process.argv[3] && viewport.width === 375) await page.screenshot({ path: process.argv[3] + '/hunt-found.png' });
      await page.locator('.hunt-tour-package').click();
      await page.waitForFunction(() => document.querySelector('.hunt-tour')?.dataset.phase === 'expanding');
      const centers = await page.evaluate(() => {
        const ring = document.querySelector('.hunt-lens circle').getBoundingClientRect();
        const sticker = document.querySelector('.hunt-tour-package').getBoundingClientRect();
        const hole = document.querySelector('.hunt-spotlight-hole');
        return [[ring.x + ring.width / 2, ring.y + ring.height / 2],
          [sticker.x + sticker.width / 2, sticker.y + sticker.height / 2],
          [Number(hole.getAttribute('cx')), Number(hole.getAttribute('cy'))]];
      });
      for (const [x,y] of centers) assert.ok(Math.abs(x - viewport.width / 2) < 1 && Math.abs(y - viewport.height / 2) < 1, 'Glass, dragon, and light must expand from the viewport center');
      if (process.argv[3] && viewport.width === 375) await page.screenshot({ path: process.argv[3] + '/hunt-centered-transition.png' });
      await page.locator('.hunt-intro-dialog').waitFor({ state: 'visible' });
      await page.waitForFunction(() => document.querySelector('.hunt-intro-dialog').getAnimations().every(a => a.playState === 'finished'));
      if (process.argv[3] && viewport.width === 375) await page.screenshot({ path: process.argv[3] + '/hunt-centered-modal.png' });
      assert.deepEqual(errors, []); await page.close();
    }
    console.log('Passed desktop, mobile and landscape checks: five-second search with restrained zooms, pauses and a compact final frame, aligned optical centers, centered glass/light/sticker expansion, and modal reveal.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });

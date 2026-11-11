'use strict';
// Optional browser QA; install Playwright outside the repo, then pass its module path.
const assert = require('node:assert/strict');
const { chromium } = require(process.argv[2] || 'playwright');
const { createServer } = require('./easter-hunt-preview.cjs');
const { createPreview } = require('../easter-hunt/service');
const preview = createPreview({ now: () => Date.parse('2026-11-10T12:00:00-06:00') });
const server = createServer({ preview });
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ headless: true });
  let checked = 0;
  try {
    for (const settings of [
      { viewport: { width: 1440, height: 1000 } },
      { viewport: { width: 375, height: 812 } },
      { viewport: { width: 430, height: 932 } },
      { viewport: { width: 768, height: 1024 } },
      { viewport: { width: 812, height: 375 } },
      { viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' },
      { viewport: { width: 375, height: 812 }, enlargedText: true },
    ]) {
      preview.admin({ action: 'reset' });
      const { enlargedText, ...browserSettings } = settings;
      const context = await browser.newContext(browserSettings);
      await context.addInitScript(() => { window.RRHSOVERIDE = true; sessionStorage.setItem('rrhs-hunt-intro-seen', 'true'); });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/iframes/projects/index.html');
      const egg = page.locator('.hunt-egg');
      await egg.waitFor({ state: 'visible' });
      assert.ok(await egg.locator('img.hunt-sticker').evaluate(async img => { await img.decode(); return img.naturalWidth > 0 && img.src.includes('dragon-package-sticker.png'); }));
      assert.equal(await egg.count(), 1);
      assert.equal(await egg.evaluate(el => !!el.parentElement.closest('button,a')), false, 'Package must not be nested in another control');
      const bounds = await egg.boundingBox();
      assert.ok(bounds.width >= 44 && bounds.height >= 44);
      await egg.click();
      const dialog = page.locator('.hunt-dialog');
      if (enlargedText) await page.addStyleTag({ content: '.hunt-dialog{font-size:32px}.hunt-dialog h2{font-size:60px}.hunt-form input{font-size:32px}.hunt-primary{font-size:30px}.hunt-dialog .hunt-terms{font-size:24px}' });
      await page.waitForFunction(() => document.querySelector('.hunt-dialog').getAnimations().every(a => a.playState === 'finished'));
      assert.equal(await dialog.isVisible(), true);
      assert.equal(await page.locator('#hunt-student').evaluate(el => el === document.activeElement), true);
      assert.ok(await dialog.evaluate(el => el.clientWidth >= el.scrollWidth), 'No horizontal dialog scrolling');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No page horizontal overflow');
      const box = await dialog.boundingBox();
      assert.ok(box.y >= 0 && box.y + box.height <= settings.viewport.height + 1, 'Dialog stays in viewport');
      await page.keyboard.press('Escape');
      assert.equal(await dialog.isVisible(), false);
      assert.equal(preview.stats().claims, 0, 'Dismissal must not consume package');
      assert.equal(await egg.evaluate(el => el === document.activeElement), true, 'Return focus to discovery');
      // Open by keyboard and verify the focus loop.
      await page.keyboard.press('Enter');
      await page.locator('.hunt-close').focus();
      await page.keyboard.press('Shift+Tab');
      assert.equal(await dialog.locator('[type=submit]').evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('.hunt-close').evaluate(el => el === document.activeElement), true);
      await page.locator('#hunt-student').fill('s151579');
      await dialog.locator('[type=submit]').click();
      await dialog.getByText('Preview reward reserved.', { exact: false }).waitFor();
      await page.waitForFunction(() => document.querySelector('.hunt-percentage')?.textContent !== '0');
      assert.equal(preview.stats().claims, 1);
      assert.equal(preview.stats().couponsIssued, 0);
      assert.equal(preview.stats().emailsSent, 0);
      assert.match(await dialog.innerText(), /No email was sent/);
      assert.match(await dialog.innerText(), /s151579@student.roundrockisd.org/);
      if (settings.reducedMotion === 'reduce') assert.equal(await page.locator('.hunt-confetti').evaluate(el => getComputedStyle(el).display), 'none');
      await dialog.getByRole('button', { name: 'Continue shopping' }).click();
      await egg.waitFor({ state: 'hidden' });
      assert.deepEqual(errors, []);
      await context.close(); checked++;
    }
    // Availability can change while the package is open.
    preview.admin({ action: 'reset' });
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    await page.addInitScript(() => { window.RRHSOVERIDE = true; sessionStorage.setItem('rrhs-hunt-intro-seen', 'true'); });
    await page.goto(base + '/iframes/projects/index.html');
    await page.locator('.hunt-egg').click();
    preview.admin({ action: 'disable', eggId: 'inventory-intelligence' });
    await page.evaluate(() => window.RRHS_EASTER_HUNT.refresh());
    await page.locator('#hunt-status').getByText('This package is unavailable now.', { exact: false }).waitFor();
    assert.equal(await page.locator('.hunt-dialog [type=submit]').isDisabled(), true);
    await page.keyboard.press('Escape');
    // Default off, live DevTools toggles, timed introduction, and the search badge.
    preview.admin({ action: 'reset' });
    const introContext = await browser.newContext({ viewport: { width: 1280, height: 850 } });
    const introPage = await introContext.newPage();
    const introErrors = [];
    introPage.on('pageerror', error => introErrors.push(error.message));
    await introPage.goto(base + '/iframes/projects/index.html');
    await introPage.waitForFunction(() => Object.getOwnPropertyDescriptor(window, 'RRHSOVERIDE')?.set);
    assert.equal(await introPage.locator('.hunt-egg, .hunt-counter, .hunt-tour').count(), 0);
    await introPage.evaluate(() => {
      const header = document.createElement('header'); header.className = 'ins-header';
      header.innerHTML = '<div class="ins-header__icons"><a class="ins-header__icon--search" href="#">Search</a></div>';
      document.body.prepend(header);
      window.RRHSOVERIDE = true;
    });
    await introPage.locator('.hunt-counter').waitFor();
    assert.equal(await introPage.locator('.hunt-counter').evaluate(el => el.nextElementSibling.classList.contains('ins-header__icon--search')), true);
    await introPage.locator('.hunt-counter-trigger').focus();
    await introPage.locator('.hunt-counter-tooltip').waitFor({ state: 'visible' });
    assert.match(await introPage.locator('.hunt-counter-tooltip').innerText(), /12 rewards remain/);
    await introPage.locator('.hunt-counter-trigger').press('Escape');
    await introPage.locator('.hunt-counter-tooltip').waitFor({ state: 'hidden' });
    await introPage.locator('.hunt-tour').waitFor({ state: 'visible', timeout: 6000 });
    await introPage.locator('.hunt-tour-package').waitFor({ state: 'visible' });
    await introPage.locator('.hunt-tour-package').click();
    await introPage.locator('.hunt-intro-dialog').waitFor({ state: 'visible' });
    assert.match(await introPage.locator('.hunt-intro-dialog').innerText(), /This is what you’re looking for/i);
    assert.ok(await introPage.locator('.hunt-intro-seal img').evaluate(async img => { await img.decode(); return img.naturalWidth > 0; }));
    assert.equal(await introPage.locator('.hunt-counter img').getAttribute('src'), await introPage.locator('.hunt-intro-seal img').getAttribute('src'));
    assert.equal(preview.stats().claims, 0, 'The introduction must not consume an egg');
    await introPage.getByRole('button', { name: 'Let’s find something' }).click();
    await introPage.reload();
    await introPage.waitForFunction(() => window.RRHS_HUNT_INTRO);
    assert.equal(await introPage.evaluate(() => window.RRHSOVERIDE), true, 'Override persists for the tab');
    await introPage.waitForTimeout(3200);
    assert.equal(await introPage.locator('.hunt-tour, .hunt-intro-dialog').count(), 0, 'Introduction plays once per tab');
    await introPage.evaluate(() => window.RRHS_HUNT_INTRO.replay());
    await introPage.getByRole('button', { name: 'Skip introduction' }).click();
    assert.equal(await introPage.locator('.hunt-tour').count(), 0);
    await introPage.evaluate(() => window.RRHSOVERIDE = false);
    assert.equal(await introPage.locator('.hunt-egg, .hunt-counter, .hunt-tour, .hunt-intro-dialog').count(), 0);
    assert.deepEqual(introErrors, []);
    await introContext.close();
    // Reduced motion gets the static introduction, with no scanning or large zoom.
    const reduced = await browser.newPage({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
    await reduced.goto(base + '/iframes/projects/index.html');
    await reduced.waitForFunction(() => Object.getOwnPropertyDescriptor(window, 'RRHSOVERIDE')?.set);
    await reduced.evaluate(() => window.RRHSOVERIDE = true);
    await reduced.waitForFunction(() => window.RRHS_HUNT_INTRO);
    await reduced.evaluate(() => window.RRHS_HUNT_INTRO.replay());
    await reduced.locator('.hunt-intro-dialog').waitFor({ state: 'visible' });
    assert.equal(await reduced.locator('.hunt-tour').count(), 0);
    assert.ok(await reduced.locator('.hunt-intro-dialog').evaluate(el => el.scrollWidth <= el.clientWidth));
    await reduced.keyboard.press('Escape');
    assert.equal(await reduced.evaluate(() => document.body.style.overflow), '');
    // Host override reaches embedded pages; discovery opens a top-level modal.
    const host = await browser.newPage();
    await host.goto(base + '/tools/easter-hunt/index.html');
    await host.addScriptTag({ url: base + '/easter-hunt/boot.js' });
    await host.evaluate(base => {
      sessionStorage.setItem('rrhs-hunt-intro-seen', 'true');
      const frame = document.createElement('iframe'); frame.src = base + '/iframes/projects/index.html'; frame.id = 'hunt-frame'; document.body.append(frame);
      window.RRHSOVERIDE = true;
    }, base);
    const embedded = host.frameLocator('#hunt-frame');
    await embedded.locator('.hunt-egg').waitFor({ state: 'visible' });
    await embedded.locator('.hunt-egg').click();
    await host.locator('.hunt-dialog').waitFor({ state: 'visible' });
    assert.equal(await embedded.locator('.hunt-dialog').count(), 0);
    await host.keyboard.press('Escape');
    await host.evaluate(() => window.RRHSOVERIDE = false);
    await embedded.locator('.hunt-egg').waitFor({ state: 'detached' });
    const email = await browser.newPage({ viewport: { width: 375, height: 812 } });
    await email.goto(base + '/easter-hunt/email-preview');
    assert.match(await email.locator('img').getAttribute('src'), /dragon-package-sticker\.png/);
    assert.ok(await email.locator('img').evaluate(async img => { await img.decode(); return img.naturalWidth > 0; }));
    assert.ok(await email.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Email fits mobile');
    assert.match(await email.locator('body').innerText(), /NO CODE/);
    console.log(`Passed ${checked} viewport/motion/text-size flows, timed intro, spotlight click/skip, DevTools toggles, header counter, iframe bridge, claims, and mobile email checks.`);
  } finally {
    await browser.close(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });

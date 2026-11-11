// Screenshots each hunt sticker in place on the live site, circled, for the admin dashboard.
// Usage: node tools/capture-hunt-locations.mjs <path to playwright-core> [chromium executable] [sticker ids…]
// Availability is faked so every sticker shows; nothing is claimed and no request reaches the Apps Script.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const [playwrightPath, executablePath, ...only] = process.argv.slice(2);
const { chromium } = require(playwrightPath);
const config = require('../easter-hunt/config.js');
const out = new URL('../api/v1/_hunt-locations/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await context.addInitScript(() => { try { sessionStorage.setItem('rrhs-hunt-intro-off', 'true'); } catch (_) {} });
await context.route('**/api/v1/easter-hunt*', route => route.request().method() === 'GET'
  ? route.fulfill({ contentType: 'application/json', body: JSON.stringify({ mode: 'live', status: 'active', remaining: config.locations.length,
    eggs: config.locations.map(spot => ({ id: spot.id, available: true })) }) })
  : route.abort());
const failed = [];
for (const spot of config.locations.filter(spot => !only.length || only.includes(spot.id))) {
  const page = await context.newPage();
  try {
    for (let attempt = 0; ; attempt++) {
      try { await page.goto('https://rrhscoop.roundrockisd.org' + spot.url, { waitUntil: 'commit', timeout: 60000 }); break; }
      catch (error) { if (attempt === 2) throw error; }
    }
    let egg;
    for (let tries = 0; tries < 60 && !egg; tries++) {
      for (const frame of page.frames()) egg ||= await frame.$(`.hunt-egg[data-egg-id="${spot.id}"]`).catch(() => null);
      if (!egg) await page.waitForTimeout(500);
    }
    if (!egg) throw new Error('sticker not found');
    await page.waitForTimeout(2500);
    // Close the storefront's cookie notice in this throwaway browser so it doesn't cover the sticker.
    await page.getByRole('button', { name: 'Decline' }).click({ timeout: 1500 }).catch(() => {});
    await egg.evaluate(el => {
      el.style.visibility = 'visible';
      el.style.outline = '5px solid #ffb800'; el.style.outlineOffset = '8px'; el.style.borderRadius = '50%';
      el.style.boxShadow = '0 0 0 16px rgba(255,184,0,.35)';
    });
    await egg.evaluate(el => el.scrollIntoView({ block: 'center' }));
    await page.evaluate(() => window.scrollBy(0, -Math.round(innerHeight / 3)));
    for (const frame of page.frames()) await frame.evaluate(() => window.scrollBy(0, 0)).catch(() => {});
    await page.waitForTimeout(800);
    const box = await egg.boundingBox();
    if (box && (box.y < 40 || box.y > 740)) await page.evaluate(y => window.scrollBy(0, y - 300), box.y);
    await page.waitForTimeout(500);
    await page.screenshot({ path: out + spot.id + '.jpg', type: 'jpeg', quality: 72 });
    console.log('ok', spot.id);
  } catch (error) { failed.push(spot.id); console.log('FAILED', spot.id, error.message); }
  await page.close();
}
await browser.close();
if (failed.length) process.exitCode = 1;

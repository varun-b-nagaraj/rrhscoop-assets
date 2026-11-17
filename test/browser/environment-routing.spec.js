const { test, expect } = require('@playwright/test');
const path = require('node:path');

test('routes existing and dynamically inserted RRHS frames once', async ({ page }) => {
  await page.route('https://rrhscoop-staging.vercel.app/**', route => route.abort());
  await page.setContent('<iframe id="first" src="https://rrhscoop-assets.vercel.app/iframes/faq/index.html?v=8#top"></iframe>');
  await page.evaluate(() => {
    window.rewrites = 0;
    window.RRHS_DEPLOYMENT = { assetOrigin: 'https://rrhscoop-staging.vercel.app', recordIframeRewrite() { window.rewrites++; }, recordFailure() {} };
  });
  await page.addScriptTag({ path: path.resolve(__dirname, '../../rrhs-iframe-router.js') });
  await expect(page.locator('#first')).toHaveAttribute('src', 'https://rrhscoop-staging.vercel.app/iframes/faq/index.html?v=8#top');
  await page.evaluate(() => {
    const frame = document.createElement('iframe'); frame.id = 'later';
    frame.src = 'https://rrhscoop-assets.vercel.app/iframes/projects/index.html?project=web';
    document.body.append(frame);
  });
  await expect(page.locator('#later')).toHaveAttribute('src', 'https://rrhscoop-staging.vercel.app/iframes/projects/index.html?project=web');
  await page.evaluate(() => window.__RRHS_IFRAME_ROUTER__.scan(document));
  expect(await page.evaluate(() => window.rewrites)).toBe(2);
});

test('never routes checkout or third-party frames', async ({ page }) => {
  await page.setContent('<iframe id="checkout" src="https://app.ecwid.com/checkout"></iframe><iframe id="auth" src="https://accounts.google.com/signin"></iframe>');
  await page.evaluate(() => { window.RRHS_DEPLOYMENT = { assetOrigin: 'https://rrhscoop-staging.vercel.app', recordIframeRewrite() {}, recordFailure() {} }; });
  await page.addScriptTag({ path: path.resolve(__dirname, '../../rrhs-iframe-router.js') });
  await expect(page.locator('#checkout')).toHaveAttribute('src', 'https://app.ecwid.com/checkout');
  await expect(page.locator('#auth')).toHaveAttribute('src', 'https://accounts.google.com/signin');
});

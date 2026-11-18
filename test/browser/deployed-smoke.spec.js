const { test, expect } = require('@playwright/test');

test('deployed browser assets, API origin and iframe routing match the expected environment', async ({ page, request }) => {
  test.skip(!process.env.SMOKE_URL, 'SMOKE_URL is only set by deployment workflows');
  const base = new URL(process.env.SMOKE_URL).origin;
  const response = await request.get(`${base}/api/v1/environment`);
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.environment).toBe(process.env.SMOKE_ENVIRONMENT);
  expect(body.commitSha).toBe(process.env.EXPECTED_SHA);
  expect(body.configuration).not.toHaveProperty('RRHS_ECWID_API_TOKEN');

  await page.route(`${base}/iframes/faq/index.html**`, route => route.abort());
  await page.setContent('<iframe id="rrhs-frame" src="https://rrhscoop-assets.vercel.app/iframes/faq/index.html?v=smoke#routing"></iframe>');
  await page.evaluate(environment => { window.RRHS_ENVIRONMENT = environment; }, process.env.SMOKE_ENVIRONMENT);
  await page.addScriptTag({ url: `${base}/rrhs-deployment.js` });
  await page.addScriptTag({ url: `${base}/rrhs-iframe-router.js` });

  const diagnostics = await page.evaluate(async () => {
    for (let attempt = 0; attempt < 50 && !window.RRHS_DEPLOYMENT.snapshot().commitSha; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return window.RRHS_DEPLOYMENT.snapshot();
  });
  expect(diagnostics.frontendEnvironment).toBe(process.env.SMOKE_ENVIRONMENT);
  expect(diagnostics.assetOrigin).toBe(base);
  expect(diagnostics.apiOrigin).toBe(base);
  expect(diagnostics.commitSha).toBe(process.env.EXPECTED_SHA);
  expect(diagnostics.fellBackToProduction).toBeFalsy();
  await expect(page.locator('#rrhs-frame')).toHaveAttribute('src', `${base}/iframes/faq/index.html?v=smoke#routing`);
});

const { test, expect } = require('@playwright/test');
const path = require('node:path');

const GATE = path.resolve(__dirname, '../../rrhs-staging-access.js');
const futureToken = () => {
  const payload = Buffer.from(JSON.stringify({ aud: 'rrhs-staging-api-v2', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  return `${payload}.signature`;
};

async function stubDeployment(page, { environment = 'staging', token = '', responses = [] } = {}) {
  await page.setContent('<main><h1>Store</h1></main>');
  await page.evaluate(({ environment, token, responses }) => {
    delete window.__RRHS_STAGING_ACCESS; window.sent = []; window.stored = token;
    window.RRHS_DEPLOYMENT = {
      frontendEnvironment: environment,
      sessionToken: () => window.stored,
      setSessionToken: value => { window.stored = value; },
      fetch: async (url, options) => {
        window.sent.push({ url, body: JSON.parse(options.body) });
        const next = responses.shift();
        return new Response(JSON.stringify(next.body), { status: next.status });
      },
    };
  }, { environment, token, responses });
  await page.addScriptTag({ path: GATE });
}

test('staging tab without a session must enter the right password', async ({ page }) => {
  await stubDeployment(page, { responses: [
    { status: 401, body: { error: 'That password is not correct.' } },
    { status: 200, body: { token: 'issued-token', expiresIn: 28800 } },
  ] });
  const dialog = page.getByRole('dialog', { name: 'Enter the staging password' });
  await expect(dialog).toBeVisible();
  const field = page.getByLabel('Password', { exact: true });
  await expect(field).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert')).toHaveText('Enter the staging password.');
  expect(await page.evaluate(() => window.sent.length)).toBe(0);

  await field.fill('wrong-one');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(field).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert')).toHaveText('That password is not correct.');
  await expect(field).toHaveAttribute('aria-invalid', 'true');

  await field.fill('right-one');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => window.stored)).toBe('issued-token');
  expect(await page.evaluate(() => window.sent.map(s => s.body))).toEqual([
    { action: 'sign-in', password: 'wrong-one' },
    { action: 'sign-in', password: 'right-one' },
  ]);
});

test('a current staging session skips the gate, an expired one does not', async ({ page }) => {
  await stubDeployment(page, { token: futureToken() });
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const expired = Buffer.from(JSON.stringify({ aud: 'rrhs-staging-api-v2', exp: 1 })).toString('base64url') + '.sig';
  await stubDeployment(page, { token: expired });
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => window.stored)).toBe('');
});

test('production tabs never show the gate', async ({ page }) => {
  await stubDeployment(page, { environment: 'production' });
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

const { test, expect } = require('@playwright/test');

test('deployed environment reports the expected commit without write operations', async ({ request }) => {
  test.skip(!process.env.SMOKE_URL, 'SMOKE_URL is only set by deployment workflows');
  const response = await request.get(`${process.env.SMOKE_URL}/api/v1/environment`);
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.environment).toBe(process.env.SMOKE_ENVIRONMENT);
  expect(body.commitSha).toBe(process.env.EXPECTED_SHA);
  expect(body.configuration).not.toHaveProperty('RRHS_ECWID_API_TOKEN');
});

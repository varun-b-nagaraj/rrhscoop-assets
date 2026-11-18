'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const deployment = require('../rrhs-deployment');
const iframeRouter = require('../rrhs-iframe-router');

const PROD = 'https://rrhscoop-assets.vercel.app';
const STAGING = 'https://rrhscoop-staging.vercel.app';

test('deployment identity follows the script actually loaded, not only the requested flag', () => {
  assert.deepEqual(deployment.describe({ scriptSrc: `${PROD}/rrhs-deployment.js`, requestedEnvironment: 'production' }), {
    requestedEnvironment: 'production', frontendEnvironment: 'production', assetOrigin: PROD,
    apiOrigin: PROD, stagingAssetsLoaded: false, fellBackToProduction: false,
  });
  assert.deepEqual(deployment.describe({ scriptSrc: `${STAGING}/rrhs-deployment.js`, requestedEnvironment: 'staging' }), {
    requestedEnvironment: 'staging', frontendEnvironment: 'staging', assetOrigin: STAGING,
    apiOrigin: STAGING, stagingAssetsLoaded: true, fellBackToProduction: false,
  });
  assert.equal(deployment.describe({ scriptSrc: `${PROD}/rrhs-deployment.js`, requestedEnvironment: 'staging' }).fellBackToProduction, true);
});

test('iframe routing preserves path, query and fragment in both directions', () => {
  const source = `${PROD}/iframes/projects/index.html?v=9&project=systems#details`;
  assert.equal(iframeRouter.routedUrl(source, STAGING, 'https://rrhscoop.roundrockisd.org'),
    `${STAGING}/iframes/projects/index.html?v=9&project=systems#details`);
  assert.equal(iframeRouter.routedUrl(source.replace(PROD, STAGING), PROD, 'https://rrhscoop.roundrockisd.org'), source);
});

test('iframe routing refuses Ecwid, authentication, payment and third-party frames', () => {
  for (const source of [
    'https://rrhscoop.roundrockisd.org/checkout',
    'https://app.ecwid.com/api/v3/checkout',
    'https://accounts.google.com/signin',
    `${PROD}/api/v1/easter-hunt`,
    `${PROD}/not-an-iframe/page.html`,
  ]) assert.equal(iframeRouter.routedUrl(source, STAGING, 'https://rrhscoop.roundrockisd.org'), null);
});

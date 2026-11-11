'use strict';
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
// Render the actual shared Apps Script template, with no mail or Ecwid bindings.
const source = readFileSync(require.resolve('../apps-script/teacher-preorder-verification.gs'), 'utf8');
const context = {};
runInNewContext(source, context, { timeout: 1000 });
module.exports = function previewEmail(percentage = 35) {
  const email = context.buildEasterEggRewardEmail({ percentage, name: 'Dragon', preview: true });
  // Show the local asset before the corresponding CDN deployment is published.
  return { ...email, html: email.html.replace('https://rrhscoop-assets.vercel.app/easter-hunt/dragon-package-sticker.png?v=1', '/easter-hunt/dragon-package-sticker.png?v=1') };
};

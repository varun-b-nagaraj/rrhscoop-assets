'use strict';

function environment(env = process.env) {
  if (env.VERCEL_ENV === 'production') return 'production';
  if (env.VERCEL_ENV === 'preview' && env.VERCEL_GIT_COMMIT_REF === 'main') return 'staging';
  if (env.VERCEL_ENV === 'preview') return 'preview';
  return 'development';
}

function configuration(env = process.env) {
  const present = name => Boolean(String(env[name] || '').trim());
  return {
    ecwid: present('RRHS_ECWID_STORE_ID') && present('RRHS_ECWID_API_TOKEN'),
    email: present('RRHS_CFA_VERIFICATION_URL'),
    hacVault: present('RRHS_HAC_VAULT_KEY'),
    hunt: present('RRHS_HUNT_DATABASE_URL') && present('RRHS_HUNT_PROMO_ID') &&
      present('RRHS_HUNT_SECRET') && present('RRHS_HUNT_RELAY_SECRET'),
    stagingAccess: present('RRHS_STAGING_PASSWORD') && present('RRHS_STAGING_SESSION_SECRET'),
  };
}

module.exports = { environment, configuration };

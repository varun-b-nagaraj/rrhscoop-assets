'use strict';
// Server-owned rewards for the twenty-sticker promo. The browser never sees these.
const rewards = Object.freeze({
  'shop-snacks':10,'shop-drinks':10,'shop-long-sleeves':10,'shop-t-shirts':10,'shop-accessories':10,'shop-school-supplies':10,'shop-merchandise':10,
  'home-why-coop':15,'teachers-top':15,'leadership':15,'faq':15,'shop-chick-fil-a':15,'about-us':15,
  'inventory-intelligence':20,'team-25-26':20,'teachers-bottom':20,'payment-methods':20,'shipping-returns':25,'terms':25,'privacy-policy':35,
});
const DEFAULT_ADMINS = ['varunnagaraj2009@gmail.com', 'rrhs_coop_store@roundrockisd.org', 's151579@student.roundrockisd.org'];
// The switch and dates come from easter-hunt/config.js (ADR 0012). Vercel supplies only secrets
// and identifiers, identical in Production and Preview:
//   RRHS_HUNT_PROMO_ID  names the promo. A new ID starts an empty hunt.
function settings(env=process.env) {
  const config=require('./config');
  const id=String(env.RRHS_HUNT_PROMO_ID||'').trim();
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error('RRHS_HUNT_PROMO_ID is required');
  const {startsAt,expiresAt}=config;
  if(!Number.isFinite(Date.parse(startsAt)) || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(startsAt)>=Date.parse(expiresAt)) throw new Error('Invalid hunt dates');
  const codePrefix=String(env.RRHS_HUNT_CODE_PREFIX||'RRHSHUNT-').trim().toUpperCase();
  if(!/^[A-Z0-9-]{4,40}$/.test(codePrefix)) throw new Error('Invalid RRHS_HUNT_CODE_PREFIX');
  return {id,startsAt,expiresAt,codePrefix,enabled:config.enabled===true};
}
function admins(env=process.env) {
  const list=String(env.RRHS_HUNT_ADMINS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  return list.length?list:DEFAULT_ADMINS;
}
module.exports={rewards,settings,admins};

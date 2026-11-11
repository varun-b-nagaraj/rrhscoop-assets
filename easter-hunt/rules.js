'use strict';
// Server-owned rewards for the twenty-sticker promo. The browser never sees these.
const rewards = Object.freeze({
  'shop-snacks':10,'shop-drinks':10,'shop-long-sleeves':10,'shop-t-shirts':10,'shop-accessories':10,'shop-school-supplies':10,'shop-merchandise':10,
  'home-why-coop':15,'teachers-top':15,'leadership':15,'faq':15,'shop-chick-fil-a':15,'about-us':15,
  'inventory-intelligence':20,'team-25-26':20,'teachers-bottom':20,'payment-methods':20,'shipping-returns':25,'terms':25,'privacy-policy':35,
});
const DEFAULT_ADMINS = ['varunnagaraj2009@gmail.com', 'rrhs_coop_store@roundrockisd.org', 's151579@student.roundrockisd.org'];
// Everything that controls the promo comes from Vercel environment variables:
//   RRHS_HUNT_ENABLED   'true' turns the hunt on for everyone; anything else turns it off.
//   RRHS_HUNT_PROMO_ID  names the promo. A new ID starts an empty hunt.
//   RRHS_HUNT_STARTS_AT / RRHS_HUNT_EXPIRES_AT  optional; default to easter-hunt/config.js.
function settings(env=process.env) {
  const config=require('./config');
  const id=String(env.RRHS_HUNT_PROMO_ID||'').trim();
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error('RRHS_HUNT_PROMO_ID is required');
  const startsAt=env.RRHS_HUNT_STARTS_AT || config.startsAt, expiresAt=env.RRHS_HUNT_EXPIRES_AT || config.expiresAt;
  if(!Number.isFinite(Date.parse(startsAt)) || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(startsAt)>=Date.parse(expiresAt)) throw new Error('Invalid hunt dates');
  return {id,startsAt,expiresAt,enabled:String(env.RRHS_HUNT_ENABLED||'').trim().toLowerCase()==='true'};
}
function admins(env=process.env) {
  const list=String(env.RRHS_HUNT_ADMINS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  return list.length?list:DEFAULT_ADMINS;
}
module.exports={rewards,settings,admins};

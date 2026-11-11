'use strict';
const crypto=require('node:crypto');
async function relay(payload) {
  const secret=process.env.RRHS_HUNT_RELAY_SECRET;
  if(!secret || secret.length<32) throw new Error('Hunt mail relay is not configured');
  const body=Buffer.from(JSON.stringify(payload)).toString('base64url'),timestamp=Date.now();
  const signature=crypto.createHmac('sha256',secret).update(timestamp+'.'+body).digest('base64url');
  return require('../teacher-preorders/service').mailAction('hunt-relay',{body,timestamp,signature});
}
async function ecwid(path,options={}) {
  const store=String(process.env.RRHS_ECWID_STORE_ID||'').trim(),token=String(process.env.RRHS_ECWID_API_TOKEN||'').trim();
  if(!/^\d+$/.test(store||'') || !token)throw new Error('Ecwid is not configured');
  const response=await fetch(`https://app.ecwid.com/api/v3/${store}${path}`,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},signal:AbortSignal.timeout(10000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error('Ecwid request failed ('+response.status+')');
  return data;
}
async function findCoupon(code) {
  const result=await ecwid('/discount_coupons?code='+encodeURIComponent(code)+'&limit=100');
  if(!Array.isArray(result.items))throw new Error('Invalid Ecwid coupon response');
  const matches=result.items.filter(c=>c.code===code);
  if(matches.length>1)throw new Error('Coupon needs manual reconciliation');
  return matches[0];
}
// Ecwid wants "yyyy-MM-dd HH:mm:ss +0000".
const ecwidDate=value=>new Date(value).toISOString().slice(0,19).replace('T',' ')+' +0000';
async function ensureCoupon(claim,code,expiresAt,who='') {
  // A retry after a timeout may find the coupon the first attempt already created.
  const existing=await findCoupon(code);
  if(existing)return String(existing.id);
  const body={name:('Dragon hunt '+claim.percentage+'% · '+who+' · '+claim.egg_id).slice(0,100),code,discountType:'PERCENT',discount:claim.percentage,status:'ACTIVE',usesLimit:'SINGLE',
    launchDate:ecwidDate(Date.now()),expirationDate:ecwidDate(expiresAt)};
  try {const result=await ecwid('/discount_coupons',{method:'POST',body:JSON.stringify(body)});if(!result.id)throw new Error('No coupon ID');return String(result.id);}
  catch(error){const recovered=await findCoupon(code).catch(()=>null);if(recovered)return String(recovered.id);throw error;}
}
async function deleteCoupon(id) {
  try {await ecwid('/discount_coupons/'+encodeURIComponent(id),{method:'DELETE'});return true;}
  catch(error){if(/\(404\)/.test(error.message))return false;throw error;}
}
module.exports={relay,ecwid,findCoupon,ensureCoupon,deleteCoupon};

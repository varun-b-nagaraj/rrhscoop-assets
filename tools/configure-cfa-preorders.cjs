/* Inspect settings with no arguments. Use --apply after deploying the cart guard. */
'use strict';
process.loadEnvFile('.env');
const { MENU } = require('../teacher-preorders/service');
const apply = process.argv.includes('--apply');
async function api(path, body) {
  const base=(process.env.RRHS_ECWID_API_BASE || 'https://app.ecwid.com/api/v3').replace(/\/+$/,'');
  const r=await fetch(`${base}/${process.env.RRHS_ECWID_STORE_ID}${path}`,{method:body?'PUT':'GET',headers:{Authorization:`Bearer ${process.env.RRHS_ECWID_API_TOKEN}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  if(!r.ok) throw new Error(`Ecwid ${path.split('?')[0]} returned ${r.status}`);
  return r.json();
}
(async()=>{
  if(apply) await api('/profile',{settings:{allowPreordersForOutOfStockProducts:true}});
  const profile=await api('/profile?responseFields=settings(allowPreordersForOutOfStockProducts)');
  console.log(JSON.stringify({preordersEnabled:profile.settings?.allowPreordersForOutOfStockProducts}));
  for(const product of MENU){
    const before=await api(`/products/${product.id}?responseFields=id,sku,outOfStockVisibilityBehaviour,discountsAllowed`);
    if(before.sku!==product.sku) throw new Error(`SKU mismatch for product ${product.id}`);
    if(apply) await api(`/products/${product.id}`,{outOfStockVisibilityBehaviour:'ALLOW_PREORDER',discountsAllowed:false});
    const current=apply?await api(`/products/${product.id}?responseFields=sku,outOfStockVisibilityBehaviour,discountsAllowed`):before;
    console.log(JSON.stringify(current));
  }
})().catch(err=>{console.error(err.message);process.exitCode=1;});

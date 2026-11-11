'use strict';
// Hunt database admin, run from a terminal (never from Apps Script):
//   node tools/hunt-db.cjs migrate                 create the hunt tables in Neon (safe to repeat)
//   node tools/hunt-db.cjs status                  show the live counts for RRHS_HUNT_PROMO_ID
//   node tools/hunt-db.cjs relay-check             confirm Apps Script accepts signed mail requests
//   node tools/hunt-db.cjs reset --confirm <ID>    delete this promo's Ecwid coupons, clear its claims and log
// Reads RRHS_HUNT_* from .env, or from the shell environment.
const fs=require('node:fs');
const path=require('node:path');
for(const file of ['.env','.env.local'])if(fs.existsSync(file))process.loadEnvFile(file);
const {database,transaction}=require('../easter-hunt/db');
const {settings}=require('../easter-hunt/rules');
const secure=require('../easter-hunt/secure');
const live=require('../easter-hunt/live');
const integrations=require('../easter-hunt/integrations');
async function migrate(db=database()) {
  await db.query(fs.readFileSync(path.join(__dirname,'../migrations/20261111_hunt_neon.sql'),'utf8'));
  await live.promotion(db);
}
async function reset(db=database(),services=integrations,{legacy=true}={}) {
  const config=settings();
  await live.promotion(db,config);
  // Close claims first. If a step below fails, the hunt stays closed until reset is run again.
  await db.query("UPDATE hunt.promotions SET lifecycle='resetting' WHERE id=$1",[config.id]);
  const busy=(await db.query('SELECT count(*)::int AS n FROM hunt.claims WHERE promo_id=$1 AND lease_until>now()',[config.id])).rows[0].n;
  if(busy)throw new Error('A reward is being emailed right now. The hunt is closed; run reset again in two minutes.');
  const claims=(await db.query('SELECT coupon_id,code_cipher FROM hunt.claims WHERE promo_id=$1',[config.id])).rows;
  let deleted=0;
  for(const row of claims) {
    const id=row.coupon_id || (await services.findCoupon(secure.open(row.code_cipher)))?.id;
    if(id && await services.deleteCoupon(id))deleted++;
  }
  // Coupons and saved state from the old Apps Script hunt, so nothing from it survives.
  let old={claims:0,deleted:0};
  if(legacy) {
    const saved=(await services.relay({kind:'legacy-export'})).legacy;
    for(const claim of saved?.claims||[]) { old.claims++; if(claim.couponId && await services.deleteCoupon(claim.couponId))old.deleted++; }
    await services.relay({kind:'legacy-clear'});
  }
  return transaction(async c=>{
    await c.query('SELECT id FROM hunt.promotions WHERE id=$1 FOR UPDATE',[config.id]);
    for(const table of ['events','limits','claims'])await c.query(`DELETE FROM hunt.${table} WHERE promo_id=$1`,[config.id]);
    const p=(await c.query("UPDATE hunt.promotions SET epoch=epoch+1,lifecycle='active' WHERE id=$1 RETURNING epoch",[config.id])).rows[0];
    await c.query("INSERT INTO hunt.events(promo_id,event,detail) VALUES($1,'Hunt reset',$2)",[config.id,`${claims.length} claims cleared, ${deleted} coupons deleted`+(legacy?`; old Apps Script data cleared (${old.claims} claims, ${old.deleted} coupons deleted)`:'')]);
    return {promo:config.id,cleared:claims.length,couponsDeleted:deleted,oldAppsScript:legacy?old:'skipped',epoch:p.epoch};
  },db);
}
async function main() {
  const [action,flag,id]=process.argv.slice(2),config=settings(),db=database();
  try {
    if(action==='migrate'){await migrate(db);console.log('Hunt tables ready for promo '+config.id+'.');}
    else if(action==='status'){const a=await live.availability(db);console.log(JSON.stringify({promo:config.id,status:a.status,remaining:a.remaining,found:a.eggs.filter(e=>e.found).map(e=>e.id)},null,2));}
    else if(action==='relay-check'){const r=await integrations.relay({kind:'health'});if(r.mode!=='mail-only')throw new Error('Unexpected relay answer');console.log('Apps Script mail relay OK.');}
    else if(action==='reset'){
      if(flag!=='--confirm'||id!==config.id)throw new Error('Pass --confirm '+config.id+' to reset this exact promo.');
      console.log(await reset(db,integrations,{legacy:!process.argv.includes('--skip-legacy')}));
    }else throw new Error('Use migrate, status, relay-check, or reset --confirm '+config.id+'.');
  }finally{await db.end();}
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={migrate,reset};

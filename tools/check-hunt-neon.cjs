'use strict';
// Run only against an isolated Neon branch. Providers below never call Ecwid or Gmail.
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
if(process.env.HUNT_TEST_ALLOW_WRITES!=='isolated-branch' || !process.env.HUNT_TEST_DATABASE_URL)throw Error('Set HUNT_TEST_DATABASE_URL and HUNT_TEST_ALLOW_WRITES=isolated-branch.');
process.env.RRHS_HUNT_DATABASE_URL=process.env.HUNT_TEST_DATABASE_URL;
process.env.RRHS_HUNT_SECRET='test-only-secret-'.repeat(4);
process.env.RRHS_HUNT_ENABLED='true';
process.env.RRHS_HUNT_STARTS_AT='2020-01-01T00:00:00Z';process.env.RRHS_HUNT_EXPIRES_AT='2030-01-01T00:00:00Z';
process.env.RRHS_HUNT_ADMINS='admin@roundrockisd.org';
const {database}=require('../easter-hunt/db'),db=database(),live=require('../easter-hunt/live'),secure=require('../easter-hunt/secure');
const {rewards}=require('../easter-hunt/rules'),manage=require('./hunt-db.cjs');
let checks=0,codeCalls=[],mailCalls=[];
const services={ensureCoupon:async(c,code)=>{codeCalls.push(code);return 'fake-'+c.id;},relay:async p=>{mailCalls.push(p);return {ok:true,emailStatus:'sent'};}};
async function fixture(imported=true){process.env.RRHS_HUNT_PROMO_ID='test-hunt-'+crypto.randomUUID();await manage.migrate(db);if(imported)await db.query('UPDATE hunt.promotions SET imported=true WHERE id=$1',[process.env.RRHS_HUNT_PROMO_ID]);codeCalls=[];mailCalls=[];}
const input=(studentId='s123456',eggId='shop-snacks',idempotencyKey=crypto.randomUUID())=>({studentId,eggId,idempotencyKey});
const check=()=>checks++;
(async()=>{
 try{
  await fixture(false);assert.equal((await live.availability(db)).status,'migration_pending');await assert.rejects(live.reserve(input(),db));check();
  await fixture();assert.equal((await live.availability(db)).remaining,20);assert.throws(()=>live.identity('bad'));assert.throws(()=>live.identity('fake@evil.test'));check();
  const race=await Promise.allSettled(Array.from({length:15},(_,i)=>live.reserve(input('s'+(100000+i)),db)));
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal((await live.availability(db)).remaining,19);check();
  await fixture();const samePerson=await Promise.allSettled(Object.keys(rewards).map(id=>live.reserve(input('s999999',id),db)));assert.equal(samePerson.filter(r=>r.status==='fulfilled').length,1);check();
  await fixture();const request=input(),a=await live.reserve(request,db),b=await live.reserve(request,db);assert.equal(a.id,b.id);assert.equal(a.code_cipher,b.code_cipher);assert.equal(a.identity_cipher.includes('s123456'),false);check();
  await Promise.all(Array.from({length:10},()=>live.fulfill(a.id,db,services)));assert.equal(codeCalls.length,1);assert.equal(mailCalls.length,1);assert.equal((await live.fulfill(a.id,db,services)).email_status,'sent');assert.equal(mailCalls.length,1);check();
  assert.equal(JSON.stringify(live.result(a)).includes('RRHSHUNT-'),false);check();
  await fixture();const failed=await live.reserve(input(),db);await live.fulfill(failed.id,db,{...services,ensureCoupon:async()=>{throw Error('Fake provider outage');}});assert.equal((await live.availability(db)).remaining,19);await db.query('UPDATE hunt.claims SET next_attempt_at=now() WHERE id=$1',[failed.id]);await live.fulfill(failed.id,db,services);assert.equal(codeCalls.length,1);check();
  await fixture();const mailFailed=await live.reserve(input(),db);await live.fulfill(mailFailed.id,db,{...services,relay:async()=>{throw Error('Fake mail outage');}});assert.equal(codeCalls.length,1);await db.query('UPDATE hunt.claims SET next_attempt_at=now() WHERE id=$1',[mailFailed.id]);await live.fulfill(mailFailed.id,db,services);assert.equal(codeCalls.length,1);assert.equal(mailCalls.length,1);check();
  await fixture();const all=await Promise.all(Object.keys(rewards).map((id,i)=>live.reserve(input('s'+(300000+i),id),db)));assert.equal(all.length,20);assert.equal((await live.availability(db)).status,'sold_out');await assert.rejects(live.reserve(input('s500000','shop-snacks'),db));assert.equal(all.filter(c=>c.percentage===35).length,1);check();
  await fixture();process.env.RRHS_HUNT_ENABLED='false';assert.equal((await live.availability(db)).status,'disabled');await assert.rejects(live.reserve(input(),db));process.env.RRHS_HUNT_ENABLED='true';process.env.RRHS_HUNT_EXPIRES_AT='2021-01-01T00:00:00Z';assert.equal((await live.availability(db)).status,'expired');await assert.rejects(live.reserve(input(),db));process.env.RRHS_HUNT_EXPIRES_AT='2030-01-01T00:00:00Z';check();
  await fixture();await assert.rejects(live.adminCheck('bad',db));await assert.rejects(live.issueChallenge('outsider@roundrockisd.org','admin','ip',db,services.relay));check();
  await live.issueChallenge('admin@roundrockisd.org','admin','ip',db,services.relay);const otp=mailCalls.at(-1).code;
  const session=await live.adminVerify('admin@roundrockisd.org',otp,db);assert.equal(await live.adminCheck(session.token,db),'admin@roundrockisd.org');await assert.rejects(live.adminVerify('admin@roundrockisd.org',otp,db));check();
  await assert.rejects(live.issueChallenge('admin@roundrockisd.org','admin','ip',db,services.relay),e=>e.status===429);check();
  const claim=await live.reserve(input(),db);await live.fulfill(claim.id,db,services);const scope=(await live.availability(db)).scope;
  await assert.rejects(manage.reset(db,{...services,ecwid:async()=>{throw Error('Fake revoke outage');}}));assert.equal((await live.availability(db)).status,'paused');assert.equal((await live.adminLog(session.token,db)).claims.length,1);check();
  const removed=[];await manage.reset(db,{...services,ecwid:async(path)=>{removed.push(path);},findCoupon:async()=>null});assert.equal(removed.length,1);assert.equal((await live.availability(db)).remaining,20);assert.notEqual((await live.availability(db)).scope,scope);await assert.rejects(live.adminCheck(session.token,db));assert.equal((await db.query('SELECT count(*)::int AS n FROM hunt.events WHERE promo_id=$1',[process.env.RRHS_HUNT_PROMO_ID])).rows[0].n,1);check();
  await fixture(false);await manage.importLegacy({promo:process.env.RRHS_HUNT_PROMO_ID,claims:[{key:crypto.randomUUID(),studentId:'s123456',eggId:'shop-snacks',percentage:10,code:'RRHSHUNT-ABCDEFGHIJ',couponId:123,emailStatus:'sent',at:new Date().toISOString()}]},db);assert.equal((await live.availability(db)).remaining,19);await assert.rejects(manage.importLegacy(null,db));await assert.rejects(live.reserve(input(),db));check();
  console.log(`Passed ${checks} Neon integration checks: concurrency, duplicates, provider failures, retries, epochs/reset, encrypted records, admin authorization, rate limits, expiry and legacy import. No real coupons or emails.`);
 }finally{await db.end();}
})().catch(error=>{console.error(error);process.exitCode=1});

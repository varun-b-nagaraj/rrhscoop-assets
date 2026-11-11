'use strict';
// Live hunt: Neon holds every claim, Vercel env decides whether the hunt is on and which promo it is.
// Apps Script only delivers email through the signed relay; it never approves claims or counts.
const crypto=require('node:crypto');
const {rewards,settings,admins}=require('./rules');
const secure=require('./secure');
const {database,transaction}=require('./db');
const integrations=require('./integrations');
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const taken='This package could not be claimed. You may already have a reward, or another Dragon got here first.';
const TOTAL=Object.keys(rewards).length;
function identity(value) {
  const who=String(value||'').trim().toLowerCase();
  if(/^s\d{4,10}$/.test(who))return {studentId:who,email:who+'@student.roundrockisd.org',name:'Dragon'};
  if(/^[a-z0-9][a-z0-9._+-]{0,63}@roundrockisd\.org$/.test(who))return {studentId:who,email:who,name:'Dragon'};
  fail(400,'Enter your S-number including the s, or your district staff email.');
}
function status(p,count,config=settings(),now=Date.now()) {
  if(!config.enabled)return 'disabled';
  if(p && p.lifecycle!=='active')return 'paused';
  if(now<Date.parse(config.startsAt))return 'scheduled';
  if(now>=Date.parse(config.expiresAt))return 'expired';
  return count>=TOTAL?'sold_out':'active';
}
// A promo ID that Neon has never seen starts empty: changing RRHS_HUNT_PROMO_ID in Vercel is a fresh hunt.
async function promotion(db,config=settings(),lock=false) {
  await db.query('INSERT INTO hunt.promotions(id) VALUES($1) ON CONFLICT DO NOTHING',[config.id]);
  return (await db.query('SELECT * FROM hunt.promotions WHERE id=$1'+(lock?' FOR UPDATE':''),[config.id])).rows[0];
}
async function limit(key,max,seconds=60,db=database()) {
  const id=secure.hash('limit:'+key),result=await db.query(`INSERT INTO hunt.limits(key,promo_id,count,expires_at) VALUES($1,$3,1,now()+$2*interval '1 second') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN hunt.limits.expires_at<now() THEN 1 ELSE hunt.limits.count+1 END,expires_at=CASE WHEN hunt.limits.expires_at<now() THEN now()+$2*interval '1 second' ELSE hunt.limits.expires_at END RETURNING count`,[id,seconds,settings().id]);
  if(result.rows[0].count>max)fail(429,'Please wait a moment before trying again.');
}
async function event(db,promo,claimId,name,detail='') {await db.query('INSERT INTO hunt.events(promo_id,claim_id,event,detail) VALUES($1,$2,$3,$4)',[promo,claimId,name,detail]);}
function result(claim) {const person=secure.open(claim.identity_cipher);return {mode:'live',percentage:claim.percentage,email:person.email,emailStatus:claim.email_status==='sent'?'sent':'pending',expiresAt:settings().expiresAt};}
async function availability(db=database()) {
  const config=settings(),p=await promotion(db,config);
  const claims=(await db.query('SELECT egg_id FROM hunt.claims WHERE promo_id=$1 AND epoch=$2',[config.id,p.epoch])).rows;
  const state=status(p,claims.length,config),used=new Set(claims.map(c=>c.egg_id));
  return {mode:config.enabled?'live':'disabled',status:state,scope:config.id+':'+p.epoch,expiresAt:config.expiresAt,remaining:TOTAL-used.size,
    eggs:Object.keys(rewards).map(id=>({id,found:used.has(id),available:state==='active'&&!used.has(id)}))};
}
function adminEmail(value) {
  const email=String(value||'').trim().toLowerCase();
  if(!admins().includes(email))fail(401,'This address cannot open the dashboard.');
  return email;
}
// Dashboard sign-in only. Students and staff claim with their S-number or email, no code.
async function adminCode(value,client,db=database(),send=integrations.relay) {
  const config=settings(),email=adminEmail(value),subject=secure.hash('admin:'+email);
  await promotion(db,config);
  await limit(config.id+':admin:ip:'+client,10,60,db);
  await limit(config.id+':admin:mail:'+subject,1,60,db);
  const id=crypto.randomUUID(),code=String(crypto.randomInt(1000000)).padStart(6,'0');
  await db.query('DELETE FROM hunt.challenges WHERE subject_key=$1',[subject]);
  await db.query(`INSERT INTO hunt.challenges(id,subject_key,code_hash,expires_at) VALUES($1,$2,$3,now()+interval '10 minutes')`,[id,subject,secure.hash(id+':'+code)]);
  await send({kind:'admin-code',id,recipient:email,code});
  return {ok:true};
}
async function adminVerify(value,code,db=database()) {
  const email=adminEmail(value),subject=secure.hash('admin:'+email);
  const ok=await transaction(async c=>{
    const row=(await c.query('SELECT * FROM hunt.challenges WHERE subject_key=$1 FOR UPDATE',[subject])).rows[0];
    if(!row || new Date(row.expires_at)<=new Date() || row.attempts>=5)return false;
    await c.query('UPDATE hunt.challenges SET attempts=attempts+1 WHERE id=$1',[row.id]);
    if(!secure.equal(secure.hash(row.id+':'+String(code||'').trim()),row.code_hash))return false;
    await c.query('DELETE FROM hunt.challenges WHERE id=$1',[row.id]);
    return true;
  },db);
  if(!ok)fail(401,'That code does not match or has expired. Request a new one.');
  const token=crypto.randomBytes(32).toString('base64url'),expiresAt=Date.now()+12*3600000;
  await db.query('DELETE FROM hunt.sessions WHERE expires_at<now()');
  await db.query('INSERT INTO hunt.sessions(token_hash,email_cipher,expires_at) VALUES($1,$2,$3)',[secure.hash(token),secure.seal(email),new Date(expiresAt)]);
  await event(db,settings().id,null,'Dashboard sign-in',email);
  return {token,expiresAt};
}
async function adminCheck(token,db=database()) {
  if(typeof token!=='string'||token.length<20||token.length>200)fail(401,'Sign in to the hunt dashboard.');
  const row=(await db.query('SELECT email_cipher FROM hunt.sessions WHERE token_hash=$1 AND expires_at>now()',[secure.hash(token)])).rows[0];
  if(!row)fail(401,'Sign in again to the hunt dashboard.');
  return secure.open(row.email_cipher);
}
async function reserve(input,db=database()) {
  const config=settings();
  if(!rewards[input.eggId] || !/^[a-f0-9-]{36}$/i.test(input.idempotencyKey||''))fail(400,'Please reopen the package and try again.');
  const person=identity(input.studentId),studentKey=secure.hash(person.studentId);
  const outcome=await transaction(async c=>{
    // Locking the promotion row serializes claims: no two people can take the same dragon or reward.
    const p=await promotion(c,config,true);
    const rows=(await c.query('SELECT * FROM hunt.claims WHERE promo_id=$1 AND epoch=$2',[config.id,p.epoch])).rows;
    const repeat=rows.find(row=>row.request_key===input.idempotencyKey);
    if(repeat)return repeat.student_key===studentKey && repeat.egg_id===input.eggId?repeat:{error:409,message:'Please reopen the package and try again.'};
    const state=status(p,rows.length,config);
    if(state!=='active'){await event(c,config.id,null,'Refused: hunt '+state,person.studentId+' · '+input.eggId);
      return {error:409,message:state==='expired'?'The hunt has ended. Thanks for exploring!':state==='sold_out'?'All '+TOTAL+' rewards have been found. Thanks for exploring!':'The packages are resting right now. Please try again later.'};}
    const mine=rows.some(row=>row.student_key===studentKey);
    if(mine || rows.some(row=>row.egg_id===input.eggId)){await event(c,config.id,null,mine?'Refused: already has a reward':'Refused: sticker already claimed',person.studentId+' · '+input.eggId);return {error:409,message:taken};}
    const id=crypto.randomUUID(),code='RRHSHUNT-'+crypto.randomBytes(8).toString('hex').toUpperCase();
    const row=(await c.query(`INSERT INTO hunt.claims(id,promo_id,epoch,student_key,egg_id,request_key,identity_cipher,percentage,code_cipher) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[id,config.id,p.epoch,studentKey,input.eggId,input.idempotencyKey,secure.seal(person),rewards[input.eggId],secure.seal(code)])).rows[0];
    await event(c,config.id,id,'Claimed',rewards[input.eggId]+'%');return row;
  },db);
  if(outcome.error)fail(outcome.error,outcome.message);
  return outcome;
}
// Creates the Ecwid coupon (once) and emails it. Safe to repeat: the code and coupon never change.
async function fulfill(id,db=database(),services=integrations) {
  const lease=crypto.randomUUID(),config=settings();
  const row=(await db.query(`UPDATE hunt.claims c SET lease=$2,lease_until=now()+interval '2 minutes',attempts=attempts+1 FROM hunt.promotions p WHERE c.id=$1 AND p.id=c.promo_id AND p.epoch=c.epoch AND p.lifecycle='active' AND c.state IN ('reserved','issued') AND c.attempts<10 AND (c.lease_until IS NULL OR c.lease_until<now()) RETURNING c.*`,[id,lease])).rows[0];
  if(!row)return (await db.query('SELECT * FROM hunt.claims WHERE id=$1',[id])).rows[0];
  const code=secure.open(row.code_cipher),person=secure.open(row.identity_cipher);
  try {
    if(!row.coupon_id){row.coupon_id=await services.ensureCoupon(row,code,config.expiresAt,person.studentId);await db.query(`UPDATE hunt.claims SET coupon_id=$3,state='issued' WHERE id=$1 AND lease=$2`,[id,lease,row.coupon_id]);await event(db,config.id,id,'Coupon created','Ecwid coupon '+row.coupon_id);}
    const mail=await services.relay({kind:'reward',id:row.id,recipient:person.email,name:person.name,percentage:row.percentage,code});
    if(mail.emailStatus!=='sent')throw new Error('Delivery not confirmed');
    await db.query(`UPDATE hunt.claims SET state='fulfilled',email_status='sent',lease=NULL,lease_until=NULL WHERE id=$1 AND lease=$2`,[id,lease]);
    await event(db,config.id,id,'Email sent',person.email);
  }catch(error){
    await db.query(`UPDATE hunt.claims SET lease=NULL,lease_until=NULL,next_attempt_at=now()+interval '1 minute',state=CASE WHEN attempts>=10 THEN 'attention' ELSE state END WHERE id=$1 AND lease=$2`,[id,lease]);
    await event(db,config.id,id,row.coupon_id?'Email failed · will retry':'Coupon failed · will retry',String(error.message||'').slice(0,200));
  }
  return (await db.query('SELECT * FROM hunt.claims WHERE id=$1',[id])).rows[0];
}
async function claim(input,client,db=database(),services=integrations) {
  await limit(settings().id+':claim:'+client,20,60,db);
  const row=await reserve(input,db);
  // The reservation is committed first, so a slow coupon or email never loses the reward; the minute job retries.
  return result(await fulfill(row.id,db,services));
}
async function retry(db=database(),services=integrations) {
  const config=settings(),rows=(await db.query(`SELECT c.id FROM hunt.claims c JOIN hunt.promotions p ON p.id=c.promo_id AND p.epoch=c.epoch WHERE c.promo_id=$1 AND p.lifecycle='active' AND c.state IN ('reserved','issued') AND c.attempts<10 AND c.next_attempt_at<=now() AND (c.lease_until IS NULL OR c.lease_until<now()) ORDER BY c.created_at LIMIT 5`,[config.id])).rows;
  for(const row of rows)await fulfill(row.id,db,services);
  return {processed:rows.length};
}
async function adminLog(token,db=database()) {
  const email=await adminCheck(token,db),config=settings(),a=await availability(db);
  const claims=(await db.query('SELECT * FROM hunt.claims WHERE promo_id=$1 AND epoch=(SELECT epoch FROM hunt.promotions WHERE id=$1) ORDER BY created_at',[config.id])).rows;
  const who=c=>c?secure.open(c.identity_cipher).studentId:'';
  const mapped=claims.map(c=>({at:c.created_at,studentId:who(c),eggId:c.egg_id,percentage:c.percentage,code:secure.open(c.code_cipher),
    emailStatus:c.email_status==='sent'?'sent':c.state==='attention'?'failed':'pending',attempts:c.attempts,claimId:c.id}));
  const byId=Object.fromEntries(claims.map(c=>[c.id,c]));
  const events=(await db.query('SELECT claim_id,event,detail,created_at FROM hunt.events WHERE promo_id=$1 ORDER BY id DESC LIMIT 300',[config.id])).rows
    .map(e=>({at:e.created_at,event:e.event,detail:e.detail,studentId:who(byId[e.claim_id]),eggId:byId[e.claim_id]?.egg_id||''}));
  return {...a,email,promo:config.id,claims:mapped,events,pool:Object.keys(rewards).filter(id=>!claims.some(c=>c.egg_id===id)).map(id=>rewards[id]),
    eggs:a.eggs.map(e=>({...e,percentage:rewards[e.id]}))};
}
module.exports={identity,status,promotion,availability,adminCode,adminVerify,adminCheck,adminLog,reserve,fulfill,claim,retry,result,limit};

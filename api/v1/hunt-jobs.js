'use strict';
// Retries rewards still waiting for their coupon or email. Apps Script's minute job calls this with a signed tick.
const crypto=require('node:crypto');
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
  let signed=false;
  try {
    let body=req.body;if(typeof body==='string')body=JSON.parse(body);
    if(!body){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1024)throw Error();}body=JSON.parse(raw);}
    const secret=process.env.RRHS_HUNT_RELAY_SECRET;
    if(secret && secret.length>=32 && Number.isSafeInteger(body.timestamp) && Math.abs(Date.now()-body.timestamp)<60000){
      const expected=crypto.createHmac('sha256',secret).update('job:'+body.timestamp).digest('base64url');
      signed=require('../../easter-hunt/secure').equal(expected,body.signature);
    }
  }catch(_){}
  const cron=process.env.CRON_SECRET && req.headers?.authorization==='Bearer '+process.env.CRON_SECRET;
  if(!signed && !cron){res.statusCode=401;return res.end('{}');}
  // Nothing to do until the hunt has a database and a promo ID.
  if(!process.env.RRHS_HUNT_DATABASE_URL || !process.env.RRHS_HUNT_PROMO_ID)return res.end(JSON.stringify({processed:0,skipped:'not configured'}));
  try {res.end(JSON.stringify(await require('../../easter-hunt/live').retry()));}
  catch(_){res.statusCode=503;res.end(JSON.stringify({error:'Hunt retries need another attempt.'}));}
};

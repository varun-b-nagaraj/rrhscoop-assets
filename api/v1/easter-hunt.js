'use strict';
const live=require('../../easter-hunt/live');
// RRHS_HUNT_ENABLED in Vercel is the only on/off switch. Neon holds the claims; Apps Script only sends email.
const enabled=()=>String(process.env.RRHS_HUNT_ENABLED||'').trim().toLowerCase()==='true';
module.exports=async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
 const origin=req.headers?.origin,local=process.env.NODE_ENV!=='production'&&/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin||'');
 res.setHeader('Vary','Origin');
 if(origin&&!local&&!['https://rrhscoop-assets.vercel.app','https://rrhscoop.roundrockisd.org'].includes(origin)){res.statusCode=403;return res.end(JSON.stringify({error:'Open the CO-OP website to continue.'}));}
 if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
 res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
 const send=(status,data)=>{res.statusCode=status;return res.end(JSON.stringify(data));};
 if(req.method==='OPTIONS'){res.statusCode=204;return res.end();}
 try {
  if(req.method==='GET'){
   const query=new URL(req.url||'/','https://rrhscoop-assets.vercel.app').searchParams;
   if(query.get('view')==='email-template'){const p=Number(query.get('percentage'));if(![10,15,20,25,35].includes(p))return send(400,{error:'Choose a valid preview percentage.'});return send(200,require('../../easter-hunt/email-preview')(p));}
   if(!enabled())return send(200,{mode:'disabled',status:'disabled',remaining:0,eggs:[]});
   // Every open tab polls every 5 seconds; Vercel's edge answers most of them, at most 2 seconds old.
   let result;try{result=await live.availability();}catch(_){return send(200,{mode:'live',status:'unavailable',remaining:null,eggs:[]});}
   res.setHeader('Cache-Control','public, max-age=0, s-maxage=2, stale-while-revalidate=2');return send(200,result);
  }
  if(req.method!=='POST')return send(405,{error:'Method not allowed.'});
  let body=req.body;
  try{if(body==null){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>2048)throw Error();}body=JSON.parse(raw||'{}');}else if(typeof body==='string'){if(Buffer.byteLength(body)>2048)throw Error();body=JSON.parse(body);}}catch(_){return send(400,{error:'Invalid request.'});}
  const client=String(req.headers?.['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
  if(body?.action==='dev-email')return send(200,await live.devEmail({studentId:String(body.studentId||''),eggId:String(body.eggId||''),code:String(body.code||'')},client));
  if(body?.action==='claim'){
   if(!enabled())return send(503,{error:'The hidden package hunt is not open yet.'});
   if(typeof body.studentId!=='string'||typeof body.eggId!=='string'||typeof body.idempotencyKey!=='string')return send(400,{error:'Please reopen the package and try again.'});
   return send(200,await live.claim({studentId:body.studentId,eggId:body.eggId,idempotencyKey:body.idempotencyKey},client));
  }
  if(!local&&origin&&origin!=='https://rrhscoop-assets.vercel.app')return send(403,{error:'Open the hunt dashboard to continue.'});
  if(body?.action==='admin-code')return send(200,await live.adminCode(body.email,client));
  if(body?.action==='admin-verify')return send(200,await live.adminVerify(body.email,body.code));
  if(body?.action==='admin-log')return send(200,await live.adminLog(body.token));
  if(body?.action==='admin-retry'){await live.adminCheck(body.token);await live.fulfill(body.claimId);return send(200,await live.adminLog(body.token));}
  if(body?.action==='admin-location'){
   await live.adminCheck(body.token);
   const spot=require('../../easter-hunt/config').locations.find(s=>s.id===body.id);
   if(!spot)return send(404,{error:'Unknown sticker.'});
   try {const image=require('node:fs').readFileSync(require('node:path').join(__dirname,'_hunt-locations',spot.id+'.jpg'));return send(200,{image:'data:image/jpeg;base64,'+image.toString('base64')});}catch(_){return send(404,{error:'No screenshot for this sticker yet.'});}
  }
  return send(400,{error:'Unknown action.'});
 }catch(error){return send([400,401,403,409,429].includes(error.status)?error.status:503,{error:error.status?error.message:'We couldn’t open this package just now. Please try again in a minute.'});}
};

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const s = require('../teacher-preorders/service');
const handler = require('../api/v1/teachers/preorder');
const products = require('../check-out-page/cfa-products');
const valid = () => ({ name:'Faculty Member', room:'1314', time:'', items:[{sku:'601_sku',quantity:2,price:6.25}], sauces:{ranch:3,cfa:1,ketchup:0,buffalo:2} });
function res() {return {statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v;},end(v){this.data=JSON.parse(v);}};}

test('calendar rolls Friday afternoon and Sunday before cutoff to Monday',()=> {
  for(const date of ['2026-11-06T22:00:00Z','2026-11-08T21:59:59Z']) assert.equal(s.nextDelivery(new Date(date)).date,'2026-11-09');
  assert.equal(s.nextDelivery(new Date('2026-11-08T22:00:00Z')).date,'2026-11-10');
});
test('4 p.m. Central closes next-day ordering and expires open checkout grants',()=> {
  const before = new Date('2026-11-10T21:59:59.500Z');
  const cutoff = new Date('2026-11-10T22:00:00Z');
  assert.equal(s.nextDelivery(before).date,'2026-11-11');
  assert.equal(s.nextDelivery(cutoff).date,'2026-11-12');
  assert.equal(s.checkoutSeconds(before),1);
  assert.equal(s.checkoutSeconds(cutoff),1800);
  assert.equal(s.nextDelivery(new Date('2027-04-06T21:00:00Z')).date,'2027-04-08');
});
test('calendar skips the full Thanksgiving break',()=>assert.equal(s.nextDelivery(new Date('2026-11-20T22:00:00Z')).date,'2026-11-30'));
test('calendar uses Central dates across UTC midnight and DST',()=> {
  assert.equal(s.nextDelivery(new Date('2026-11-10T01:00:00Z')).date,'2026-11-11');
  assert.equal(s.nextDelivery(new Date('2027-03-15T02:00:00Z')).date,'2027-03-22');
});
test('calendar fails closed past the last published school date',()=>assert.throws(()=>s.nextDelivery(new Date('2028-01-01')), /calendar/));
test('only the exact staff email domain is accepted',()=> {
  assert.equal(s.emailAddress(' Teacher.Name@RoundRockISD.org '),'teacher.name@roundrockisd.org');
  for(const email of ['student@students.roundrockisd.org','x@roundrockisd.org.evil.com','x@gmail.com','x@roundrockisd.org\nevil']) assert.throws(()=>s.emailAddress(email));
});
test('order quantities and sauces are validated independently of the browser',()=> {
  assert.equal(s.validateOrder(valid()).items[0].quantity,2);
  for(const quantity of [0,-1,21,1.5,'2']) {const body=valid();body.items[0].quantity=quantity;assert.throws(()=>s.validateOrder(body));}
  for(const count of [11,-1,0.5,'3']) {const body=valid();body.sauces.ranch=count;assert.throws(()=>s.validateOrder(body));}
  const unknown=valid();unknown.sauces.unknown=1;assert.throws(()=>s.validateOrder(unknown));
});
test('sauces are counted once across the order and legacy carts obey the same limit', () => {
  const order = valid();
  order.items.push({ sku: '698_sku', quantity: 1, price: 6.50 });
  order.sauces.ranch = 10;
  const validated = s.validateOrder(order);
  assert.equal(validated.sauces.ranch, 10);
  assert.ok(validated.items.every(item => item.sauces === undefined));
  delete order.sauces;
  order.items.forEach(item => { item.sauces = { ranch: 6 }; });
  assert.throws(() => s.validateOrder(order), /per order/);
});
test('unknown and duplicate products, missing delivery fields are rejected',()=> {
  const bad=valid();bad.items[0].sku='other';assert.throws(()=>s.validateOrder(bad));
  const duplicate=valid();duplicate.items.push(duplicate.items[0]);assert.throws(()=>s.validateOrder(duplicate));
  for(const field of ['name','room']){const b=valid();b[field]='';assert.throws(()=>s.validateOrder(b));}
});
test('signed verification rejects tampering, expiry, wrong purpose, and missing secrets',()=> {
  const previous=process.env.RRHS_CFA_VERIFICATION_SECRET;process.env.RRHS_CFA_VERIFICATION_SECRET='a'.repeat(64);
  try {
    const token=s.sign({email:'teacher@roundrockisd.org'},'faculty',100,100000);
    assert.equal(s.verify(token,'faculty',101000).email,'teacher@roundrockisd.org');
    assert.throws(()=>s.verify(token,'faculty',201000));assert.throws(()=>s.verify(token,'checkout',101000));
    const [payload,sig]=token.split('.');const changed=Buffer.from(JSON.stringify({email:'student@roundrockisd.org',type:'faculty',exp:1000})).toString('base64url');
    assert.throws(()=>s.verify(changed+'.'+sig,'faculty',101000));
    process.env.RRHS_CFA_VERIFICATION_SECRET='';assert.throws(()=>s.sign({email:'x@roundrockisd.org'},'faculty',100));
  }finally{if(previous===undefined)delete process.env.RRHS_CFA_VERIFICATION_SECRET;else process.env.RRHS_CFA_VERIFICATION_SECRET=previous;}
});
test('order comments carry the exact date, room, email, and order-level sauce counts',()=> {
  const text=s.orderComments(s.validateOrder(valid()),'teacher@roundrockisd.org',s.nextDelivery(new Date('2026-11-08T19:59:59Z')));
  for(const value of ['2026-11-09','1314','teacher@roundrockisd.org','Garden Herb Ranch: 3','Zesty Buffalo: 2','12:45']) assert.ok(text.includes(value));
});
test('normal-cart gate detects all supplied SKUs and IDs, including mixed carts',()=> {
  for(const item of s.MENU){assert.equal(products.cartHasPreorder({items:[{product:{sku:'normal'}},{product:{sku:item.sku}}]}),true);assert.equal(products.isPreorder({id:item.id}),true);}
  assert.equal(products.cartHasPreorder({items:[null,{productId:s.MENU[0].id,product:{name:'Sandwich'}}]}),true);
  assert.equal(products.cartHasPreorder({items:[{product:{sku:'normal',id:1}}]}),false);
});
test('checkout requires server verification before fetching any product',async()=> {
  const output=res();await handler({method:'POST',headers:{},body:{action:'checkout',...valid()}},output);assert.equal(output.statusCode,401);
});
test('invalid email and unsupported methods are rejected',async()=> {
  const output=res();await handler({method:'POST',headers:{},body:{action:'send-code',email:'student@gmail.com'}},output);assert.equal(output.statusCode,400);
  const method=res();await handler({method:'PUT',headers:{}},method);assert.equal(method.statusCode,405);
});

test('Apps Script enforces rate limits, attempts, expiry, and single-use codes',()=> {
  let now=1000000;const data=new Map();let mailed=0,code='';
  const crypto=require('node:crypto');
  const props={getProperty:k=>data.get(k)||null,setProperty:(k,v)=>data.set(k,v),getProperties:()=>Object.fromEntries(data),deleteProperty:k=>data.delete(k)};
  const context=vm.createContext({console,Date:{now:()=>now},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},PropertiesService:{getScriptProperties:()=>props},Utilities:{getUuid:()=>crypto.randomUUID(),computeHmacSha256Signature:(text,key)=>Array.from(crypto.createHmac('sha256',key).update(text).digest()),base64EncodeWebSafe:bytes=>Buffer.from(bytes).toString('base64url')},MailApp:{getRemainingDailyQuota:()=>100,sendEmail:email=>{mailed++;code=email.body.match(/code is (\d{6})/)[1];}},ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})}});
  vm.runInContext(fs.readFileSync(require.resolve('../apps-script/teacher-preorder-verification.gs'),'utf8'),context);
  const post=(value)=>context.doPost({postData:{contents:JSON.stringify({email:'teacher@roundrockisd.org',...value})}});
  assert.equal(post({action:'send-code',email:'student@gmail.com'}).ok,false);assert.equal(mailed,0);
  const first=post({action:'send-code'});assert.equal(first.ok,true);assert.equal(mailed,1);assert.ok(data.get('cfa_internal_otp_key'));
  assert.equal(post({action:'send-code'}).status,429);
  assert.equal(post({action:'verify-code',challenge:first.challenge,code}).ok,true);
  assert.equal(post({action:'verify-code',challenge:first.challenge,code}).ok,false);
  now+=61000;const next=post({action:'send-code'});const wrong=code==='000000'?'999999':'000000';
  for(let i=0;i<5;i++)assert.equal(post({action:'verify-code',challenge:next.challenge,code:wrong}).ok,false);
  assert.equal(post({action:'verify-code',challenge:next.challenge,code}).ok,false);
  now+=61000;const expired=post({action:'send-code'});now+=600001;
  assert.equal(post({action:'verify-code',challenge:expired.challenge,code}).ok,false);
});

test('only the designated Gmail addresses can verify outside the district domain', () => {
  assert.equal(s.emailAddress('VarunNagaraj2009@gmail.com'), 'varunnagaraj2009@gmail.com');
  assert.equal(s.emailAddress('IsabelleN90@gmail.com'), 'isabellen90@gmail.com');
  assert.throws(() => s.emailAddress('anyone@gmail.com'));
});

test('pickup requires a time and includes the selected school day in Ecwid comments', () => {
  const input = { name: 'Teacher', fulfillment: 'pickup', items: [{ sku: '601_sku', quantity: 1 }] };
  assert.throws(() => s.validateOrder(input), /Choose a pickup time/);
  assert.throws(() => s.validateOrder({ ...input, time: '25:00' }), /Choose a valid time/);
  const order = s.validateOrder({ ...input, time: '12:45' });
  assert.equal(order.room, '');
  const delivery = { date: '2026-11-11', label: 'Wednesday, November 11' };
  assert.match(s.orderComments(order, 'teacher@roundrockisd.org', delivery),
    /Pickup schedule: Wednesday, November 11 \(2026-11-11\) · 12:45 p\.m\. Central/);
});

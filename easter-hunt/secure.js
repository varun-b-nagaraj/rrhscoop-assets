'use strict';
const crypto=require('node:crypto');
function secret() {const value=process.env.RRHS_HUNT_SECRET;if(!value || value.length<32)throw new Error('RRHS_HUNT_SECRET is required');return value;}
function hash(value){return crypto.createHmac('sha256',secret()).update(value).digest('hex');}
function seal(value) {const iv=crypto.randomBytes(12),key=crypto.createHash('sha256').update(secret()).digest(),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);const bytes=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),bytes]).toString('base64url');}
function open(value) {const bytes=Buffer.from(value,'base64url'),decipher=crypto.createDecipheriv('aes-256-gcm',crypto.createHash('sha256').update(secret()).digest(),bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(12,28));return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString());}
function equal(a,b){const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length && crypto.timingSafeEqual(x,y);}
module.exports={hash,seal,open,equal};

'use strict';
// Neon Postgres connection for the hunt (RRHS_HUNT_DATABASE_URL, the pooled connection string).
const {Pool}=require('pg');
let pool;
function database() {
  if(pool)return pool;
  const connectionString=process.env.RRHS_HUNT_DATABASE_URL;
  if(!connectionString) throw new Error('RRHS_HUNT_DATABASE_URL is required');
  return pool=new Pool({connectionString,max:3,connectionTimeoutMillis:20000,idleTimeoutMillis:10000,allowExitOnIdle:true});
}
async function transaction(fn, db=database()) {
  const client=await db.connect();
  try {await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result;}
  catch(error){await client.query('ROLLBACK');throw error;} finally{client.release();}
}
// Tests swap in an in-memory Postgres.
function use(db){pool=db;}
module.exports={database,transaction,use};

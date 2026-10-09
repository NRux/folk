import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { modelLedger, generateBudgetedDraft } from '../server/model-ledger.js';
await assert.rejects(generateBudgetedDraft({jobId:'invalid',settings:{}},{}),/paused/);
const db = new PGlite();
const migration='supabase/migrations/20261008024348_model_spend_ledger.sql';
try {
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE ROLE authenticator; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;`);
 for(const path of ['supabase/migrations/20261007220625_folkly_editorial.sql','supabase/migrations/20261007223002_publisher_leases.sql',migration]) await db.exec(await readFile(path,'utf8'));
 const ids=[1,2,3].map(i=>`00000000-0000-0000-0000-00000000000${i}`);
 const reserve=async(id,amount=1)=> (await db.query('select public.folkly_reserve_model_budget($1::uuid,$2,$3::numeric) as value',[id,'fixture/model',amount])).rows[0].value;
 const worker=()=>db.exec(`SET ROLE folkly_publisher; SET request.jwt.claims='{"role":"folkly_publisher"}';`);
 await worker(); await db.exec("SET request.jwt.claims='{}';"); await assert.rejects(reserve(ids[0]),/authority/); await worker(); assert.equal(await reserve(ids[0]),null);
 await db.exec(`RESET ROLE; UPDATE public.folkly_settings SET value='true' WHERE key='production.autonomous_enabled'; UPDATE public.folkly_model_budget SET daily_usd=2,job_usd=1; INSERT INTO public.folkly_model_rates VALUES ('fixture/model',1,2,now()+interval '1 hour');`);
 await worker(); const first=await reserve(ids[0]); assert(first.id); assert.equal(await reserve(ids[0]),null); assert.equal(await reserve(ids[1],2),null);
 const evidence={model:'fixture/model',totalTokens:100};
 const record=async(outcome,data=evidence,token=first.id)=>(await db.query('select public.folkly_record_model_usage($1::uuid,$2::uuid,$3,$4::jsonb) as value',[ids[0],token,outcome,JSON.stringify(data)])).rows[0].value;
 assert.equal(await record('failed'),true); assert.equal(await record('failed'),true); await assert.rejects(record('draft'),/immutable/); await assert.rejects(record('failed',{},ids[2]),/not found/);
 assert((await reserve(ids[1])).id); assert.equal(await reserve(ids[2]),null); // failed calls still consume budget
 await assert.rejects(db.query('select * from public.folkly_model_reservations'),/permission denied/);
 for(const role of ['anon','authenticated','service_role']) {await db.exec(`RESET ROLE; SET ROLE ${role};`); await assert.rejects(reserve(ids[2]),/permission denied/);}
 await db.exec(`RESET ROLE; UPDATE public.folkly_model_budget SET daily_usd=5; UPDATE public.folkly_model_rates SET valid_until=now()-interval '1 second';`);await worker();assert.equal(await reserve(ids[2]),null);
 await db.exec(`RESET ROLE; UPDATE public.folkly_model_rates SET valid_until=now()+interval '1 hour',input_per_million=100;`);await worker();assert.equal(await reserve(ids[2]),null);
 const ledger=modelLedger(ids[0],{rpc:async()=>({error:{message:'outage'}})});await assert.rejects(ledger.reserveBudget({model:'fixture/model',maxDollars:1}),/unavailable/);
 console.log('Model ledger passed: fail-closed caps/rates, atomic reservations, replay denial, retained failed spend, immutable evidence, token fencing, role denial, and outages.');
}finally{await db.close();}

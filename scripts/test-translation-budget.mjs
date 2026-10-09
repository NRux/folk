import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {readTranslationBudget,saveTranslationBudget} from '../server/translation-budget.js';
import {createTranslationHandlers} from '../server/owner-translations.js';
const db=new PGlite(),env={FOLKLY_TRANSLATION_MODEL_ID:'gpt-6-luna',FOLKLY_TRANSLATION_MAX_JOB_DOLLARS:'0.02',OPENAI_API_KEY:'synthetic-only',BLOB_STORE_ID:'synthetic-private'};
const runAsServer=()=>db.exec("RESET ROLE; SET ROLE service_role; SET request.jwt.claims='{\"role\":\"service_role\"}';");
const types={folkly_read_translation_budget:[],folkly_save_translation_budget:['jsonb','numeric','timestamptz','boolean','text','numeric']};
const adapter={async rpc(name,args){try{const values=Object.values(args).map((v,i)=>types[name][i]==='jsonb'?JSON.stringify(v):v);return {data:(await db.query('SELECT public.'+name+'('+types[name].map((t,i)=>'$'+(i+1)+'::'+t).join(',')+') AS value',values)).rows[0].value};}catch(error){return {error};}}};
const expiry=()=>new Date(Date.now()+86400000).toISOString();
const payload=async extra=>({action:'budget',revision:(await readTranslationBudget(adapter,env)).revision,totalDollars:'1.00',validUntil:expiry(),enabled:false,...extra});
try{
 await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE folkly_publisher; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$; GRANT USAGE ON SCHEMA auth TO service_role;");
 await db.exec(await readFile('supabase/migrations/20261009025742_translation_pilot_ledger.sql','utf8'));
 const editorial=await readFile('supabase/migrations/20261007220625_folkly_editorial.sql','utf8');
 await db.exec(editorial.match(/CREATE TABLE public\.folkly_audit_events \([\s\S]*?\n\);/)[0]);
 await db.exec('ALTER TABLE public.folkly_audit_events ENABLE ROW LEVEL SECURITY; GRANT INSERT ON public.folkly_audit_events TO service_role; GRANT USAGE,SELECT ON SEQUENCE public.folkly_audit_events_id_seq TO service_role;');
 await db.exec(await readFile('supabase/migrations/20261009214800_translation_budget_controls.sql','utf8'));
 await db.exec("UPDATE public.folkly_translation_budget SET model='gpt-6-luna',input_per_million=0.10,output_per_million=0.50;");
 await runAsServer();
 const before=await readTranslationBudget(adapter,env);assert.equal(before.totalDollars,0);assert.equal(before.editable,true);assert.equal(before.enabled,false);assert(!JSON.stringify(before).includes('synthetic-only'));
 const old=await payload();let saved=await saveTranslationBudget(adapter,env,old);assert.equal(saved.status,200);assert.equal(saved.budget.totalDollars,1);assert.equal(saved.budget.enabled,false);assert.equal(saved.budget.perTranslationDollars,0.02);
 assert.equal((await saveTranslationBudget(adapter,env,{...old,totalDollars:'2.00'})).status,409,'Stale edits cannot overwrite');
 for(const bad of [{totalDollars:'50.01'},{totalDollars:'NaN'},{totalDollars:'1.001'},{totalDollars:'0x10'},{totalDollars:1},{validUntil:'tomorrow'},{validUntil:new Date(Date.now()-1).toISOString()},{validUntil:new Date(Date.now()+31*86400000).toISOString()},{enabled:'true'},{revision:'a'.repeat(64)+'garbage'},{model:'caller/model'},{input_per_million:0}]){
  assert.equal((await saveTranslationBudget(adapter,env,await payload(bad))).status,400,JSON.stringify(bad));
 }
 saved=await saveTranslationBudget(adapter,env,await payload({enabled:true}));assert.equal(saved.status,200);assert.equal(saved.budget.enabled,true);
 await db.exec("RESET ROLE; INSERT INTO public.folkly_translation_jobs(job_id,slug,locale,source_hash,glossary_hash,prompt_version,model,reserved_usd,input_per_million,output_per_million,state) VALUES('00000000-0000-0000-0000-000000000001','public-story','fr',repeat('a',64),repeat('b',64),'fixture','gpt-6-luna',0.40,0.1,0.5,'failed');");await runAsServer();
 assert.equal((await saveTranslationBudget(adapter,env,await payload({totalDollars:'0.39'}))).status,400,'Failed reservations remain committed');
 const read=await readTranslationBudget(adapter,env);assert.equal(read.reservedDollars,0.4);assert.equal(read.remainingDollars,0.6);
 const race=await adapter.rpc('folkly_read_translation_budget',{});
 const params={expected_budget:race.data.budget,maximum:2,approval_until:expiry(),pilot_enabled:false,configured_model:'gpt-6-luna',configured_job:0.02};
 assert.equal((await adapter.rpc('folkly_save_translation_budget',params)).data.status,'saved');
 assert.equal((await adapter.rpc('folkly_save_translation_budget',{...params,maximum:3})).data.status,'conflict','SQL fence catches edits after server read');
 assert.equal((await saveTranslationBudget(adapter,{...env,FOLKLY_TRANSLATION_MODEL_ID:'other-model'},await payload())).status,503);
 const failedRead={rpc:async()=>({error:{message:'synthetic-secret-only'}})};assert.equal((await readTranslationBudget(failedRead,env)).available,false);
 const uncertain={rpc:async(name,args)=>name==='folkly_read_translation_budget'&&uncertain.saved?{error:{}}:name==='folkly_save_translation_budget'?(uncertain.saved=true,adapter.rpc(name,args)):adapter.rpc(name,args)};
 assert.equal((await saveTranslationBudget(uncertain,env,await payload())).status,503,'Unverified saves retain state for refresh, not automatic retry');
 let writes=0,authorized=true;
 const handler=createTranslationHandlers({authorize:async()=>authorized?{db:{rpc:async(...args)=>{writes++;return adapter.rpc(...args);}}}:null,env});
 const request=(body,origin='https://www.folkly.com')=>new Request('https://www.folkly.com/api/owner-translations',{method:'POST',headers:{origin},body:JSON.stringify(body)});
 assert.equal((await handler.POST(request(await payload(),'https://bad.invalid'))).status,403);assert.equal(writes,0);
 authorized=false;assert.equal((await handler.POST(request(await payload()))).status,401);assert.equal(writes,0);authorized=true;
 const response=await handler.POST(request(await payload()));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
 await db.exec('RESET ROLE;');const events=(await db.query('SELECT * FROM public.folkly_audit_events')).rows;assert(events.length>=4);assert(events.every(e=>e.actor==='owner-panel'&&e.action==='translation-budget-save'));assert(events.every(e=>!e.reason.includes('synthetic-only')));
 for(const role of ['anon','authenticated','folkly_publisher']){
  await db.exec('RESET ROLE; SET ROLE '+role+';');
  await assert.rejects(db.query('SELECT public.folkly_read_translation_budget()'),/permission denied/);
  await assert.rejects(db.query('SELECT public.folkly_save_translation_budget($1::jsonb,1,now()+interval \'1 hour\',false,\'gpt-6-luna\',0.02)',[JSON.stringify(race.data.budget)]),/permission denied/);
 }
 await runAsServer();await db.exec("SET request.jwt.claims='{}';");await assert.rejects(db.query('SELECT public.folkly_read_translation_budget()'),/authority/);
 console.log('Translation budget passed: bounded USD/expiry, server-only audited writes, SQL stale-edit fencing, retained failed reservations, independent readback, owner/CSRF/no-store denial and zero provider calls.');
}finally{await db.close();}

import { readFile } from 'node:fs/promises';
// Print reviewable SQL only. Execute only against an approved isolated fixture.
const schema='folkly_budget_acceptance_20261008';
const action=process.argv[2];
if(action==='cleanup') console.log(`DROP SCHEMA IF EXISTS ${schema} CASCADE;`);
else if(action==='setup') {
 const migration=(await readFile('supabase/migrations/20261008024348_model_spend_ledger.sql','utf8')).replace(/^BEGIN;\n/,'').replace(/COMMIT;\s*$/,'').replaceAll('public.',`${schema}.`);
 console.log(`BEGIN; CREATE SCHEMA ${schema}; GRANT USAGE ON SCHEMA ${schema} TO folkly_publisher; CREATE TABLE ${schema}.folkly_settings(key text,value text); INSERT INTO ${schema}.folkly_settings VALUES ('production.autonomous_enabled','true'); ${migration} UPDATE ${schema}.folkly_model_budget SET daily_usd=1,job_usd=1; INSERT INTO ${schema}.folkly_model_rates VALUES ('fixture/model',1,2,now()+interval '1 hour'); COMMIT;`);
}else if(action==='claim') {
 const job=process.argv[3]; if(!/^[0-9a-f-]{36}$/.test(job||'')) throw Error('Synthetic job UUID required');
 console.log(`BEGIN; SET LOCAL ROLE folkly_publisher; SET LOCAL request.jwt.claims='{"role":"folkly_publisher"}'; SELECT ${schema}.folkly_reserve_model_budget('${job}','fixture/model',1); COMMIT;`);
}else throw Error('Use setup, claim UUID, or cleanup');

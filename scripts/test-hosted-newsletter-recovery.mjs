import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {runStorageRecovery,createNewsletterRecoveryHandler,RECOVERY_CHECKS,RECOVERY_FORMAT,RECOVERY_PROJECT,recoveryContract,recoveryClient} from '../server/newsletter-recovery.js';
const id='123e4567-e89b-42d3-a456-426614174000',lease='123e4567-e89b-42d3-a456-426614174001',contract=await recoveryContract(),token='a'.repeat(64),hash=createHash('sha256').update(token).digest('hex');
function fixture(){
 const records=new Map(),calls=[];
 return {records,calls,sdk:{
  get:async(path,opts)=>{calls.push(['get',path]);assert.ok(path.startsWith(`acceptance/newsletter/${id}/`));assert.equal(opts.access,'private');assert.equal(opts.useCache,false);assert.ok(opts.abortSignal);return records.has(path)?{statusCode:200,stream:new Response(records.get(path)).body,blob:{size:Buffer.byteLength(records.get(path))}}:null;},
  put:async(path,value,opts)=>{calls.push(['put',path]);assert.ok(path.startsWith(`acceptance/newsletter/${id}/`));assert.equal(opts.access,'private');assert.equal(opts.addRandomSuffix,false);assert.equal(opts.allowOverwrite,false);assert.ok(opts.abortSignal);if(records.has(path))throw Error('already exists');records.set(path,value);},
  list:async opts=>{calls.push(['list',opts.prefix]);assert.ok(opts.prefix.startsWith(`acceptance/newsletter/${id}/`));assert.ok(opts.abortSignal);return {blobs:[...records].filter(([path])=>path.startsWith(opts.prefix)).map(([pathname,text])=>({pathname,size:Buffer.byteLength(text)})),hasMore:false};},
 }};
}
const storage=fixture(),result=await runStorageRecovery({grantId:id,sdk:storage.sdk});
assert.equal(result.objects,10);assert.deepEqual(Object.keys(result.checks),RECOVERY_CHECKS);assert.ok(Object.values(result.checks).every(x=>x===true));assert.match(result.inventorySha,/^[a-f0-9]{64}$/);
assert.equal(storage.records.size,10);assert.ok(!JSON.stringify(result).includes('newsletter.invalid'));assert.ok(!JSON.stringify(result).includes('acceptance/'));
await assert.rejects(runStorageRecovery({grantId:'../../subscribers',sdk:storage.sdk}));
const contaminated=fixture();contaminated.sdk.list=async opts=>({blobs:[{pathname:'subscribers/'+'a'.repeat(64)+'.json'}],hasMore:false});
await assert.rejects(runStorageRecovery({grantId:id,sdk:contaminated.sdk}));
const lost=fixture();const get=lost.sdk.get;lost.sdk.get=async(...args)=>args[0].includes('/restored/')?null:get(...args);
await assert.rejects(runStorageRecovery({grantId:id,sdk:lost.sdk}));
let contacted=false;
assert.throws(()=>recoveryClient({SUPABASE_URL:'https://wrong.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_PRIVATE'},AbortSignal.timeout(500)),/Wrong recovery/);
const grants={inspect:async()=>({id,contract_sha:contract}),claim:async()=>id,complete:async(_id,_lease,receipt)=>{grants.receipt=receipt;return true;},readback:async()=>({status:'verified',lease_id:null,receipt:grants.receipt})};
const env={SUPABASE_URL:`https://${RECOVERY_PROJECT}.supabase.co`,BLOB_READ_WRITE_TOKEN:'private-do-not-return',RESEND_API_KEY:'do-not-use',NEWSLETTER_SECRET:'do-not-return'};
const logs=[];
const handler=overrides=>createNewsletterRecoveryHandler({environment:()=>env,contract:async()=>contract,clientFactory:()=>({}),grantsFactory:()=>grants,sdk:fixture().sdk,log:(...args)=>logs.push(args),...overrides});
const req=({method='POST',auth=true,query='',origin,body={operation:RECOVERY_FORMAT},type='application/json'}={})=>new Request('https://www.folkly.com/api/newsletter-recovery'+query,{method,headers:{...(auth?{authorization:'Bearer '+token}:{}),...(origin?{origin}:{}),'content-type':type},...(method==='POST'?{body:JSON.stringify(body)}:{})});
for(const [request,status] of [[req({auth:false}),401],[req({method:'GET'}),405],[req({query:'?path=subscribers/'}),400],[req({origin:'https://evil.local'}),403],[req({type:'text/plain'}),415]]){
 const response=await handler({clientFactory:()=>{contacted=true;throw Error('should not contact');}})(request);assert.equal(response.status,status);assert.match(response.headers.get('cache-control'),/no-store/);
}
assert.equal(contacted,false);
assert.equal((await handler({grantsFactory:()=>({...grants,inspect:async()=>null})})(req())).status,401);
assert.equal((await handler({environment:()=>({...env,NEWSLETTER_ENABLED:'true'})})(req())).status,503);
assert.equal((await handler({contract:async()=>'b'.repeat(64)})(req())).status,503);
let ran=false;assert.equal((await handler({run:async()=>{ran=true;throw Error('bad');}})(req({body:{operation:RECOVERY_FORMAT,path:'subscribers/'}}))).status,400);assert.equal(ran,false);
assert.equal((await handler()(req({body:{operation:RECOVERY_FORMAT,padding:'x'.repeat(200)}}))).status,400);
const response=await handler()(req());assert.equal(response.status,200);const receipt=(await response.json()).receipt;
assert.equal(receipt.emailsSent,0);assert.equal(receipt.deliveryPaused,true);assert.equal(receipt.switchesPaused,true);assert.equal(receipt.objects,10);
assert.equal((await handler({grantsFactory:()=>({...grants,readback:async()=>({status:'running',receipt,lease_id:lease})})})(req())).status,503);
assert.ok(!JSON.stringify(logs).includes('private-do-not-return'));
assert.ok(!JSON.stringify(logs).includes(token));
const db=new PGlite();
await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; GRANT USAGE ON SCHEMA public TO service_role; CREATE TABLE folkly_settings(key TEXT PRIMARY KEY,value TEXT); GRANT SELECT,UPDATE ON folkly_settings TO service_role; INSERT INTO folkly_settings VALUES('production.autonomous_enabled','false'),('publication.autonomous_enabled','false'),('schedule.enabled','false');");
await db.exec(await readFile('supabase/migrations/20261010021000_newsletter_recovery_grants.sql','utf8'));
async function role(name,sql,args=[]){await db.exec('BEGIN; SET LOCAL ROLE '+name+';');try{const r=await db.query(sql,args);await db.exec('COMMIT;');return r;}catch(error){await db.exec('ROLLBACK;');throw error;}}
for(const name of ['anon','authenticated']){
 await assert.rejects(role(name,'SELECT * FROM folkly_newsletter_recovery_grants'),/permission/);
 await assert.rejects(role(name,'SELECT folkly_claim_newsletter_recovery($1,$2,$3)',[hash,contract,lease]),/permission/);
}
const insert='INSERT INTO folkly_newsletter_recovery_grants(id,token_sha256,contract_sha,expires_at) VALUES($1,$2,$3,now()+interval \'8 minutes\')';
await assert.rejects(role('service_role',insert,[id,hash,contract]),/permission/);
await db.query(insert,[id,hash,contract]);
await assert.rejects(db.query("INSERT INTO folkly_newsletter_recovery_grants(token_sha256,contract_sha,expires_at) VALUES($1,$2,now()+interval '20 minutes')",['c'.repeat(64),contract]),/check constraint/);
await db.exec("UPDATE folkly_newsletter_recovery_grants SET authorized_at=now()-interval '9 minutes',expires_at=now()-interval '1 minute';");
const claim='SELECT folkly_claim_newsletter_recovery($1,$2,$3) AS id';
await assert.rejects(role('service_role',claim,[hash,contract,lease]),/authorization/);
await db.exec("UPDATE folkly_newsletter_recovery_grants SET authorized_at=now(),expires_at=now()+interval '8 minutes';");
await assert.rejects(role('service_role',claim,[hash,'b'.repeat(64),lease]),/authorization/);
await db.exec("UPDATE folkly_settings SET value='true' WHERE key='schedule.enabled';");
await assert.rejects(role('service_role',claim,[hash,contract,lease]),/paused/);
await db.exec("UPDATE folkly_settings SET value='false';");
assert.equal((await role('service_role',claim,[hash,contract,lease])).rows[0].id,id);
await assert.rejects(role('service_role',claim,[hash,contract,lease]),/authorization/);
const complete='SELECT folkly_complete_newsletter_recovery($1,$2,$3) AS ok';
for(const corrupt of [{...receipt,emailsSent:1},{...receipt,inventorySha:null},{...receipt,secret:'never save'},{...receipt,checks:{...receipt.checks,immutableClaim:false}}])await assert.rejects(role('service_role',complete,[id,lease,JSON.stringify(corrupt)]),/Invalid recovery/);
await assert.rejects(role('service_role',complete,[id,'123e4567-e89b-42d3-a456-426614174002',JSON.stringify(receipt)]),/claim unavailable/);
assert.equal((await role('service_role',complete,[id,lease,JSON.stringify(receipt)])).rows[0].ok,true);
assert.equal((await db.query('SELECT status,lease_id FROM folkly_newsletter_recovery_grants')).rows[0].status,'verified');
await assert.rejects(role('service_role',complete,[id,lease,JSON.stringify(receipt)]),/claim unavailable/);
await db.close();
const configuration=JSON.parse(await readFile('vercel.json','utf8'));assert.equal(configuration.functions['api/newsletter-recovery.js'].maxDuration,180);
assert.deepEqual(configuration.crons,[{path:'/api/newsletter',schedule:'0 16 * * 5'}]);
const directory=await mkdtemp(join(tmpdir(),'folkly-storage-recovery-'));
try{
 const existing=join(directory,'proof.json');await writeFile(existing,'existing evidence');
 const cli=(output,input='')=>spawnSync(process.execPath,['scripts/run-newsletter-recovery.mjs',output],{input,encoding:'utf8',timeout:10000});
 for(const [output,message] of [['package.json',/Receipt must be outside/],[existing,/Receipt already exists/]]){
  const result=cli(output);assert.equal(result.status,1);assert.equal(result.stdout,'');assert.match(result.stderr,message);assert.ok(!result.stderr.includes(directory));
 }
 assert.equal(await readFile(existing,'utf8'),'existing evidence');
 const invalid=cli(join(directory,'new.json'),'invalid-private-token\n');assert.equal(invalid.status,1);assert.match(invalid.stderr,/token input invalid/);assert.ok(!invalid.stderr.includes('invalid-private-token'));
}finally{await rm(directory,{recursive:true,force:true});}
console.log('Hosted newsletter recovery fixtures pass: isolated private prefix, 11 storage checks, single-use contract/expiry/lease and paused-state fences, client-role/issuance denial, bounded input, secret redaction and independent receipt readback. No email/provider call.');

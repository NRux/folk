import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createEditorialImportHandler,createImportStore,contractHash,importClient,PROJECT_ID} from '../server/editorial-import.js';
import {createClient} from '@supabase/supabase-js';
import {TABLES,digest,validatedImportRecords,blobImportRecords} from './supabase-snapshot.mjs';
import {createContentStore,createSnapshotStore} from '../server/content-store.js';
const schema=await readFile('supabase/migrations/20261007220625_folkly_editorial.sql','utf8');
const migration=await readFile('supabase/migrations/20261009232929_hosted_editorial_import.sql','utf8');
const db=new PGlite();
await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; GRANT USAGE ON SCHEMA public TO service_role; CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);');
await db.exec(schema);
await db.exec(await readFile('supabase/migrations/20261008225831_private_content_objects.sql','utf8'));
await db.exec(await readFile('supabase/migrations/20261008230107_content_objects_append_only.sql','utf8'));
await db.exec(migration);
const text=JSON.stringify({body_html:"<p>Private historical text $$; DROP TABLE folkly_articles; --</p>"}),hash=digest(text);
await db.query('INSERT INTO folkly_articles(id,slug,title,content_hash,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$5)',['article','public-story','Fixture private title',hash,'2026-10-09']);
await db.query('INSERT INTO folkly_article_versions(id,article_id,version,content_json,created_by,created_at) VALUES ($1,$2,1,$3,$4,$5)',['version','article',text,'fixture','2026-10-09']);
const records={};for(const name of TABLES)records[name]=(await db.query('SELECT * FROM folkly_'+name)).rows;
await db.exec('DELETE FROM folkly_article_versions; DELETE FROM folkly_articles;');
const payload={format:'folkly-d1-snapshot-v1',release_state:'unpublished',records},snapshot={...payload,sha256:digest(payload)};
const counts=Object.fromEntries(TABLES.map(t=>[t,records[t].length])),receipt={sha256:snapshot.sha256,counts};
const contract={schema,manifest:{articles:[{slug:'public-story',versionId:'version',contentHash:hash}]},catalog:[{slug:'public-story',status:'published'}]};
const options={...contract,expectedSha:snapshot.sha256,expectedCounts:counts};
const token='b'.repeat(64),tokenHash=digest(token),lease='123e4567-e89b-42d3-a456-426614174000';
async function issue(){return (await db.query('INSERT INTO folkly_import_grants(token_sha256,source_sha,contract_sha,expected_counts,expires_at) VALUES($1,$2,$3,$4,now()+interval \'20 minutes\') RETURNING id',[tokenHash,snapshot.sha256,contractHash(contract),JSON.stringify(counts)])).rows[0].id;}
let grantId=await issue();
const blobs=new Map();const fakeBlob={async put(path,value,opts){assert.equal(opts.access,'private');assert.equal(opts.allowOverwrite,false);if(blobs.has(path))throw Error('Exists');blobs.set(path,value);},async get(path){const value=blobs.get(path);return value===undefined?null:{statusCode:200,stream:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(value));c.close();}})};}};
const contentStore=createContentStore(fakeBlob),snapshotStore=createSnapshotStore(fakeBlob);
const objects=[{article_version_id:'version',...await contentStore.upload(text)}];
const prepared=blobImportRecords(validatedImportRecords(snapshot,options).records,objects);
async function asRole(role,sql,args=[]){await db.exec('BEGIN; SET LOCAL ROLE '+role+';');try{const r=await db.query(sql,args);await db.exec('COMMIT;');return r;}catch(e){await db.exec('ROLLBACK;');throw e;}}
for(const role of ['anon','authenticated']){
 await assert.rejects(asRole(role,'SELECT * FROM folkly_import_grants'),/permission/);
 await assert.rejects(asRole(role,'SELECT folkly_claim_editorial_import($1,$2,$3,$4)',[tokenHash,snapshot.sha256,contractHash(contract),lease]),/permission/);
}
await assert.rejects(asRole('service_role','INSERT INTO folkly_import_grants(token_sha256,source_sha,contract_sha,expected_counts,expires_at) VALUES($1,$2,$3,$4,now()+interval \'1 minute\')',[digest('another'),snapshot.sha256,contractHash(contract),JSON.stringify(counts)]),/permission/);
await assert.rejects(asRole('service_role','UPDATE folkly_content_objects SET byte_size=1'),/permission/);
await assert.rejects(asRole('service_role','SELECT folkly_claim_editorial_import($1,$2,$3,$4)',[digest('wrong'),snapshot.sha256,contractHash(contract),lease]),/authorization/);
await asRole('service_role','SELECT folkly_claim_editorial_import($1,$2,$3,$4)',[tokenHash,snapshot.sha256,contractHash(contract),lease]);
await assert.rejects(asRole('service_role','SELECT folkly_claim_editorial_import($1,$2,$3,$4)',[tokenHash,snapshot.sha256,contractHash(contract),lease]),/authorization/);
await assert.rejects(asRole('service_role','SELECT folkly_commit_editorial_import($1,$2,$3,$4)',[grantId,'223e4567-e89b-42d3-a456-426614174000',prepared.records,prepared.objects]),/lease/);
const corrupt=structuredClone(prepared.records);corrupt.articles[0].unknown='SQL injection';
await assert.rejects(asRole('service_role','SELECT folkly_commit_editorial_import($1,$2,$3,$4)',[grantId,lease,corrupt,prepared.objects]),/columns/);
assert.equal((await db.query('SELECT count(*) AS n FROM folkly_articles')).rows[0].n,0);
await assert.rejects(asRole('service_role','SELECT folkly_commit_editorial_import($1,$2,$3,$4)',[grantId,lease,prepared.records,prepared.objects.map(o=>({...o,pathname:'editorial/versions/not-the-hash.json'}))]),/reference/);
assert.equal((await db.query('SELECT count(*) AS n FROM folkly_article_versions')).rows[0].n,0,'Late reference failure must roll back metadata');
await db.exec("UPDATE folkly_settings SET value='true' WHERE key='schedule.enabled'");
await assert.rejects(asRole('service_role','SELECT folkly_commit_editorial_import($1,$2,$3,$4)',[grantId,lease,prepared.records,prepared.objects]),/paused/);
await db.exec("UPDATE folkly_settings SET value='false' WHERE key='schedule.enabled'");
await asRole('service_role','SELECT folkly_commit_editorial_import($1,$2,$3,$4)',[grantId,lease,prepared.records,prepared.objects]);
assert.equal((await db.query('SELECT content_json FROM folkly_article_versions')).rows[0].content_json,'');
assert.equal((await db.query('SELECT status FROM folkly_articles')).rows[0].status,'published');
await assert.rejects(asRole('service_role','SELECT folkly_commit_editorial_import($1,$2,$3,$4)',[grantId,lease,prepared.records,prepared.objects]),/lease/);
const safeReceipt={format:'folkly-import-readback-v1',sourceSha:snapshot.sha256,counts,publishedCount:1,privateCount:0,mode:'blob',verifiedVersions:1,backupVerified:true,sweeps:2,switchesPaused:true,projectId:PROJECT_ID,verifiedAt:new Date().toISOString()};
await assert.rejects(asRole('service_role','SELECT folkly_complete_editorial_import($1,$2,$3)',[grantId,lease,{...safeReceipt,secret:'must never persist'}]),/receipt/);
await asRole('service_role','SELECT folkly_complete_editorial_import($1,$2,$3)',[grantId,lease,safeReceipt]);
assert.equal((await db.query('SELECT status FROM folkly_import_grants')).rows[0].status,'verified');
// A separately authorized retry can reuse exact rows/objects, never overwrite.
await db.exec("UPDATE folkly_import_grants SET token_sha256='"+digest('old')+"'");grantId=await issue();
await asRole('service_role','SELECT folkly_claim_editorial_import($1,$2,$3,$4)',[tokenHash,snapshot.sha256,contractHash(contract),lease]);
await asRole('service_role','SELECT folkly_commit_editorial_import($1,$2,$3,$4)',[grantId,lease,prepared.records,prepared.objects.map(o=>({...o,verified_at:new Date().toISOString()}))]);
assert.equal((await db.query('SELECT count(*) AS n FROM folkly_content_objects')).rows[0].n,1);
await db.exec("UPDATE folkly_import_grants SET status='revoked'");
// Endpoint fixtures verify authorization precedes body parsing or any upload.
let calls=[],logs=[];
const grant={id:'fixture',source_sha:snapshot.sha256,contract_sha:contractHash(contract),expected_counts:counts};
const store={inspect:async()=>{calls.push('inspect');return grant;},claim:async()=>{calls.push('claim');return grant.id;},commit:async(id,lease,rows,refs)=>{calls.push('commit');assert.equal(rows.article_versions[0].content_json,'');assert.equal(refs.length,1);return true;},complete:async()=>{calls.push('complete');return true;}};
const deps={environment:()=>({BLOB_READ_WRITE_TOKEN:'private fixture'}),contract:async()=>contract,clientFactory:()=>({}),storeFactory:()=>store,contentFactory:()=>contentStore,snapshotFactory:()=>snapshotStore,verify:async()=>{calls.push('verify');return safeReceipt;},log:(label,details)=>logs.push({label,details})};
const req=(body={snapshot,receipt},extra={})=>new Request('https://www.folkly.com/api/editorial-import',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json',...extra},body:JSON.stringify(body)});
let handler=createEditorialImportHandler(deps);
assert.equal((await handler(new Request('https://www.folkly.com/api/editorial-import'))).status,401);assert.equal(calls.length,0);
assert.equal((await handler(req(undefined,{origin:'https://attacker.example'}))).status,403);assert.equal(calls.length,0);
handler=createEditorialImportHandler({...deps,storeFactory:()=>({...store,inspect:async()=>null})});
assert.equal((await handler(req('not valid export'))).status,401);assert.equal(blobs.size,1);
handler=createEditorialImportHandler(deps);calls=[];
assert.equal((await handler(req({snapshot:{...snapshot,sha256:digest('wrong')},receipt}))).status,400);assert.deepEqual(calls,['inspect']);
calls=[];let response=await handler(req());assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
assert.deepEqual(calls,['inspect','claim','commit','verify','complete']);assert.equal(blobs.size,2);
calls=[];handler=createEditorialImportHandler({...deps,contentFactory:()=>({upload:async()=>{throw Error('token=private title');}})});
response=await handler(req());assert.equal(response.status,503);assert.equal((await response.json()).stage,'blob');assert.deepEqual(calls,['inspect','claim']);assert.ok(!JSON.stringify(logs).includes('private title'));
handler=createEditorialImportHandler({...deps,verify:async()=>{throw Error('Secret mismatch');}});calls=[];response=await handler(req());assert.equal(response.status,503);assert.ok(calls.includes('commit'));assert.ok(!calls.includes('complete'));
assert.throws(()=>importClient({SUPABASE_URL:'https://other.supabase.co'},AbortSignal.timeout(1000)),/Wrong import project/);
// Installed SDK sends only the token hash to the private DB, never the bearer.
let wire=[];
const sdk=createClient('https://'+PROJECT_ID+'.supabase.co','sb_secret_fixture',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(url,init)=>{
 const parsed=new URL(url);wire.push({path:parsed.pathname,method:init.method,body:init.body});
 if(init.method==='GET'){
  assert.equal(parsed.pathname,'/rest/v1/folkly_import_grants');assert.equal(parsed.searchParams.get('token_sha256'),'eq.'+tokenHash);assert.equal(parsed.searchParams.get('status'),'eq.issued');assert.ok(parsed.searchParams.get('expires_at').startsWith('gt.'));
  return Response.json(grant);
 }
 const args=JSON.parse(init.body);assert.ok(!init.body.includes(token));
 if(parsed.pathname.endsWith('folkly_claim_editorial_import')){assert.equal(args.p_token_hash,tokenHash);return Response.json('fixture');}
 return Response.json(true);
}}});
const sdkStore=createImportStore(sdk);assert.deepEqual(await sdkStore.inspect(tokenHash),grant);
assert.equal(await sdkStore.claim(tokenHash,snapshot.sha256,contractHash(contract),lease),'fixture');
assert.equal(await sdkStore.commit('fixture',lease,prepared.records,prepared.objects),true);
assert.equal(await sdkStore.complete('fixture',lease,safeReceipt),true);assert.equal(wire.length,4);
await db.close();
console.log('Hosted import fixtures passed: private roles, fenced single-use grants, transactional rollback, paused switches, immutable Blob retry, receipt allowlist, authorization-before-upload and redacted failures.');

import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {compileSnapshot,TABLES,digest} from './supabase-snapshot.mjs';
import {createImportReader,verifyImportedSnapshot} from './import-readback.mjs';
import {createContentStore,createSnapshotStore} from '../server/content-store.js';
import {createClient} from '@supabase/supabase-js';
const schema=await readFile('supabase/migrations/20261007220625_folkly_editorial.sql','utf8');
async function database(){const db=new PGlite();await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);');await db.exec(schema);return db;}
const guarded=spawnSync(process.execPath,['scripts/prepare-supabase-import.mjs','missing.json','missing-receipt.json','private-leak.sql'],{encoding:'utf8'});assert.notEqual(guarded.status,0);assert(guarded.stderr.includes('Private SQL must be outside'));
const source=await database(),body=JSON.stringify({body_html:"<p>Original's text $$; DROP TABLE folkly_articles; --</p>"}),hash=digest(body);
for(const [id,slug] of [['released','known-story'],['held','held-story']]){await source.query('INSERT INTO folkly_articles(id,slug,title,status,pipeline_state,content_hash,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$7)',[id,slug,'Private title','draft',id==='held'?'needs-review':'ready',hash,'2026-10-08']);await source.query('INSERT INTO folkly_article_versions(id,article_id,version,content_json,created_by,created_at) VALUES ($1,$2,1,$3,$4,$5)',[id+'-v1',id,body,'fixture','2026-10-08']);}
const records={};for(const table of TABLES)records[table]=(await source.query('SELECT * FROM folkly_'+table)).rows;
const payload={format:'folkly-d1-snapshot-v1',release_state:'unpublished',records},snapshot={...payload,sha256:digest(payload)};
const options={expectedSha:snapshot.sha256,expectedCounts:Object.fromEntries(TABLES.map(t=>[t,records[t].length])),schema,manifest:{articles:[{slug:'known-story',versionId:'released-v1',contentHash:hash}]},catalog:[{slug:'known-story',status:'published'}]};
const result=compileSnapshot(snapshot,options);assert.deepEqual(result.published,['known-story']);assert.deepEqual(result.private,['held-story']);
const db=await database();await db.exec(result.sql);await db.exec(result.sql);const rows=(await db.query('SELECT slug,status,pipeline_state FROM folkly_articles ORDER BY slug')).rows;assert.equal(rows[0].status,'draft');assert.equal(rows[0].pipeline_state,'needs-review');assert.equal(rows[1].status,'published');assert.equal((await db.query('SELECT content_json FROM folkly_article_versions LIMIT 1')).rows[0].content_json,body);
assert((await db.query("SELECT value FROM folkly_settings")).rows.every(r=>r.value==='false'));
await db.exec("UPDATE folkly_articles SET title='Concurrent revision' WHERE id='released'");await assert.rejects(db.exec(result.sql),/revision conflict/);await db.exec('ROLLBACK');assert.equal((await db.query("SELECT title FROM folkly_articles WHERE id='released'")).rows[0].title,'Concurrent revision');
for(const role of ['anon','authenticated']){await db.exec('SET ROLE '+role);await assert.rejects(db.query('SELECT content_json FROM folkly_article_versions'),/permission denied/);await db.exec('RESET ROLE');}
const bad=structuredClone(snapshot);bad.records.article_versions[0].content_json='truncated';assert.throws(()=>compileSnapshot(bad,options),/checksum/);
const rehash=x=>{const {sha256,...p}=x;return {...p,sha256:digest(p)};};let malformed=rehash(bad);assert.throws(()=>compileSnapshot(malformed,{...options,expectedSha:malformed.sha256}),/JSON/);
assert.throws(()=>compileSnapshot(snapshot,{...options,expectedCounts:{...options.expectedCounts,articles:99}}),/count/);
const columns=structuredClone(snapshot);columns.records.articles[0].unknown='x';malformed=rehash(columns);assert.throws(()=>compileSnapshot(malformed,{...options,expectedSha:malformed.sha256}),/columns/);
assert.throws(()=>compileSnapshot(snapshot,{...options,manifest:{articles:[{...options.manifest.articles[0],contentHash:'0'.repeat(64)}]}}),/release/);
const paused=await database();await paused.exec("UPDATE folkly_settings SET value='true' WHERE key='schedule.enabled'");await assert.rejects(paused.exec(result.sql),/paused/);await paused.exec('ROLLBACK');assert.equal((await paused.query('SELECT count(*)::int AS n FROM folkly_articles')).rows[0].n,0);
const partial=await database();const brokenSQL=result.sql.replace('DROP FUNCTION pg_temp.folkly_assert(boolean,text);',"SELECT pg_temp.folkly_assert(false,'Simulated interruption');");await assert.rejects(partial.exec(brokenSQL),/Simulated interruption/);await partial.exec('ROLLBACK');assert.equal((await partial.query('SELECT count(*)::int AS n FROM folkly_articles')).rows[0].n,0);
const hybrid=await database();await hybrid.exec(await readFile('supabase/migrations/20261008225831_private_content_objects.sql','utf8'));
await hybrid.exec(await readFile('supabase/migrations/20261008230107_content_objects_append_only.sql','utf8'));
const contentObjects=records.article_versions.map(v=>({article_version_id:v.id,pathname:'editorial/versions/'+digest(v.content_json)+'.json',sha256:digest(v.content_json),byte_size:Buffer.byteLength(v.content_json),verified_at:'2026-10-08T23:00:00Z'}));
const linked=compileSnapshot(snapshot,{...options,contentObjects});await hybrid.exec(linked.sql);await hybrid.exec(linked.sql);
assert((await hybrid.query('SELECT content_json FROM folkly_article_versions')).rows.every(r=>r.content_json===''));assert.equal((await hybrid.query('SELECT count(*)::int AS n FROM folkly_content_objects')).rows[0].n,2);
await hybrid.exec('SET ROLE authenticated');await assert.rejects(hybrid.query('SELECT * FROM folkly_content_objects'),/permission denied/);await hybrid.exec('RESET ROLE');
assert.throws(()=>compileSnapshot(snapshot,{...options,contentObjects:contentObjects.slice(1)}),/Incomplete/);
assert.throws(()=>compileSnapshot(snapshot,{...options,contentObjects:contentObjects.map(r=>({...r,pathname:'../../private'}))}),/Unverified/);
await hybrid.exec('SET ROLE service_role');await assert.rejects(hybrid.query("UPDATE folkly_content_objects SET byte_size=1"),/permission denied/);await hybrid.exec('RESET ROLE');

// Independent readback of the real imported schema, not the import's own return.
let selectCalls=0;
const reader=instance=>async ({table,columns,offset,limit})=>{
 assert([...TABLES,'settings','content_objects'].includes(table));
 assert(columns.every(c=>/^[a-z_][a-z_0-9]*$/.test(c)));selectCalls++;
 const where=table==='settings'?" WHERE key IN ('production.autonomous_enabled','publication.autonomous_enabled','schedule.enabled')":'';
 const order=table==='page_blocks'?'slug':table==='settings'?'key':table==='content_objects'?'article_version_id':'id';
 return {rows:(await instance.query(`SELECT ${columns.join(',')} FROM folkly_${table}${where} ORDER BY ${order} LIMIT $1 OFFSET $2`,[limit,offset])).rows,count:(await instance.query(`SELECT count(*)::int AS n FROM folkly_${table}${where}`)).rows[0].n};
};
const objects=new Map(records.article_versions.map(v=>['editorial/versions/'+digest(v.content_json)+'.json',v.content_json]));
const backupPath='editorial/backups/'+digest(JSON.stringify(snapshot))+'.json';objects.set(backupPath,JSON.stringify(snapshot));
let puts=0,gets=0;
const blob={put(){puts++;throw Error('Verifier must not upload');},async get(path,opts){gets++;assert.equal(opts.access,'private');assert.equal(opts.useCache,false);return objects.has(path)?{statusCode:200,stream:new Response(objects.get(path)).body}:null;}};
const config={readPage:reader(hybrid),contentStore:createContentStore(blob),snapshotStore:createSnapshotStore(blob),pageSize:1};
const receipt=await verifyImportedSnapshot(snapshot,options,config);
assert.equal(receipt.privateCount,1);assert.equal(receipt.publishedCount,1);assert.equal(receipt.verifiedVersions,2);assert.equal(receipt.sweeps,2);assert(receipt.backupVerified);assert(receipt.switchesPaused);assert.equal(puts,0);assert.equal(gets,3);
for(const privateText of ['Private title','held-story','released-v1','Original','editorial/','content_json','SUPABASE'])assert(!JSON.stringify(receipt).includes(privateText));
assert.deepEqual(await verifyImportedSnapshot(snapshot,options,config),receipt);
const recovered=await database();await recovered.exec(await readFile('supabase/migrations/20261008225831_private_content_objects.sql','utf8'));await recovered.exec(result.sql);
assert.equal((await verifyImportedSnapshot(snapshot,options,{readPage:reader(recovered),mode:'sql',pageSize:1})).backupVerified,false);
const callsBefore=selectCalls;
await assert.rejects(verifyImportedSnapshot(snapshot,{...options,expectedSha:'0'.repeat(64)},config),/checksum/);assert.equal(selectCalls,callsBefore);
await assert.rejects(verifyImportedSnapshot(snapshot,options,{...config,pageSize:0}),/configuration/);
await assert.rejects(verifyImportedSnapshot(snapshot,options,{readPage:reader(hybrid)}),/Blob/);
await assert.rejects(verifyImportedSnapshot(snapshot,options,{...config,mode:'sql'}),/record mismatch/);
await assert.rejects(verifyImportedSnapshot(snapshot,options,{readPage:reader(partial),mode:'sql'}),/count mismatch/);
await recovered.exec("UPDATE folkly_articles SET title='Concurrent title' WHERE id='released'");
await assert.rejects(verifyImportedSnapshot(snapshot,options,{readPage:reader(recovered),mode:'sql'}),/record mismatch/);
await recovered.exec("UPDATE folkly_articles SET title='Private title' WHERE id='released'");
const firstPath=contentObjects[0].pathname;
objects.delete(firstPath);await assert.rejects(verifyImportedSnapshot(snapshot,options,config),/version readback failed/);objects.set(firstPath,body);
objects.set(firstPath,body.replace('Original','Tampered'));await assert.rejects(verifyImportedSnapshot(snapshot,options,config),/version readback failed/);objects.set(firstPath,body);
objects.delete(backupPath);await assert.rejects(verifyImportedSnapshot(snapshot,options,config),/backup readback failed/);objects.set(backupPath,JSON.stringify(snapshot));
await hybrid.exec('UPDATE folkly_content_objects SET byte_size=byte_size+1');await assert.rejects(verifyImportedSnapshot(snapshot,options,config),/reference mismatch/);await hybrid.exec('UPDATE folkly_content_objects SET byte_size=byte_size-1');
let articlePass=0;
const driftReader=async args=>{if(args.table==='articles'&&args.offset===0&&++articlePass===2)await hybrid.exec("UPDATE folkly_articles SET title='Late edit' WHERE id='released'");return config.readPage(args);};
await assert.rejects(verifyImportedSnapshot(snapshot,options,{...config,readPage:driftReader}),/record mismatch/);await hybrid.exec("UPDATE folkly_articles SET title='Private title' WHERE id='released'");
let referencePass=0;
await assert.rejects(verifyImportedSnapshot(snapshot,options,{...config,readPage:async args=>{const p=await config.readPage(args);if(args.table==='content_objects'&&args.offset===0&&++referencePass===2)p.rows[0].verified_at='2026-10-09T00:00:00Z';return p;}}),/references changed/);
let settingsPass=0;
await assert.rejects(verifyImportedSnapshot(snapshot,options,{...config,readPage:async args=>{if(args.table==='settings'&&args.offset===0&&++settingsPass===3)await hybrid.exec("UPDATE folkly_settings SET value='true' WHERE key='schedule.enabled'");return config.readPage(args);}}),/remain paused/);await hybrid.exec("UPDATE folkly_settings SET value='false' WHERE key='schedule.enabled'");
for(const mutate of [p=>({...p,rows:[]}),p=>({...p,count:null}),p=>({...p,count:10001}),p=>({...p,rows:p.rows.map(r=>({...r,secret:'private'}))})])await assert.rejects(verifyImportedSnapshot(snapshot,options,{...config,readPage:async args=>mutate(await config.readPage(args))}),/page|columns/);
let firstRow;
await assert.rejects(verifyImportedSnapshot(snapshot,options,{...config,readPage:async args=>{const p=await config.readPage(args);if(args.table==='articles'){if(args.offset===0)firstRow=p.rows[0];else p.rows[0]=firstRow;}return p;}}),/Duplicate/);
await assert.rejects(verifyImportedSnapshot(snapshot,options,{...config,readPage:async()=>{throw Error('key=never-expose');}}),error=>!error.message.includes('never-expose')&&/unavailable/.test(error.message));
const fakeClient={from(table){assert.equal(table,'folkly_articles');return {select(cols,opts){assert.equal(cols,'id,title');assert.deepEqual(opts,{count:'exact'});return this;},order(key,opts){assert.equal(key,'id');assert.deepEqual(opts,{ascending:true});return this;},async range(start,end){assert.equal(start,100);assert.equal(end,199);return {data:[],count:0,error:null};}};}};
assert.deepEqual(await createImportReader(fakeClient)({table:'articles',columns:['id','title'],offset:100,limit:100}),{rows:[],count:0});
await assert.rejects(createImportReader(fakeClient)({table:'owners',columns:['id'],offset:0,limit:1}),/Unknown/);
// Actual installed SDK: GET projection, stable order, bounded range, exact count.
let sdkReads=0;
const sdk=createClient('https://vxmyggasjgsiohqzzwzh.supabase.co','sb_secret_fixture',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async (url,init)=>{
 sdkReads++;assert.equal(init.method,'GET');const parsed=new URL(url);assert.equal(parsed.pathname,'/rest/v1/folkly_articles');assert.equal(parsed.searchParams.get('select'),'id,title');assert.equal(parsed.searchParams.get('order'),'id.asc');assert.equal(parsed.searchParams.get('offset'),'100');assert.equal(parsed.searchParams.get('limit'),'100');assert.equal(new Headers(init.headers).get('prefer'),'count=exact');
 return new Response(JSON.stringify([{id:'synthetic',title:'Synthetic title'}]),{status:200,headers:{'content-type':'application/json','content-range':'100-100/101'}});
}}});
assert.deepEqual(await createImportReader(sdk)({table:'articles',columns:['id','title'],offset:100,limit:100}),{rows:[{id:'synthetic',title:'Synthetic title'}],count:101});assert.equal(sdkReads,1);
// CLI rejects unsafe artifacts and wrong destination before any outbound read.
const privateDir=await mkdtemp(join(tmpdir(),'folkly-import-readback-'));
try{
 const input=join(privateDir,'snapshot.json'),sourceReceipt=join(privateDir,'source.json'),output=join(privateDir,'verified.json');
 await writeFile(input,JSON.stringify(snapshot));await writeFile(sourceReceipt,JSON.stringify({sha256:snapshot.sha256,counts:options.expectedCounts}));
 for(const args of [[input,sourceReceipt,'verification-private-leak.json'],[input,sourceReceipt,output]]){
  const cli=spawnSync(process.execPath,['scripts/verify-supabase-import.mjs',...args],{encoding:'utf8',env:{...process.env,SUPABASE_URL:'https://wrong-project.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_never-expose'}});
  assert.notEqual(cli.status,0);assert.equal(cli.stdout,'');assert(!cli.stderr.includes('never-expose'));assert(!cli.stderr.includes(privateDir));await assert.rejects(readFile(output),/ENOENT/);
 }
}finally{await rm(privateDir,{recursive:true,force:true});}
assert.equal(puts,0);await hybrid.close();await recovered.close();
for(const instance of [source,db,paused,partial])await instance.close();
console.log('Supabase import/readback passed: independent checksum/counts, full rows, manifest classification, private holds, rollback/retry, two-sweep drift detection, paginated completeness, immutable Blob versions/backup, redacted receipts, private CLI paths, role denial and paused switches. Isolated PGlite/Blob fixtures only; no live import.');

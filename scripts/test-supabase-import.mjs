import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {compileSnapshot,TABLES,digest} from './supabase-snapshot.mjs';
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
for(const instance of [source,db,paused,partial])await instance.close();
console.log('Supabase import passed: independent checksum/counts, full columns, version hashes, manifest classification, private holds, SQL escaping, transactional rollback, idempotent replay, revision conflict, role denial and paused switches. Isolated PGlite only; no live import.');

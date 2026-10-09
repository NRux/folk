import assert from 'node:assert/strict';
import {exportResponse, sha256, TABLES} from '../lib/export-snapshot.mjs';
const now = Date.now(), token = 'a'.repeat(64);
const settings = ['production.autonomous_enabled','publication.autonomous_enabled','schedule.enabled'].map(key => ({key,value:'false'}));
const long = JSON.stringify({text:'Long private editorial content. '.repeat(400)});
let reads = 0;
const db = {prepare:sql=>({sql}), batch:async statements=>{
  reads++;
  return statements.map(({sql}) => ({success:true,results:sql.includes('FROM settings') ? settings :
    sql.includes('COUNT') ? [{n:1}] : [{id:1,...(sql.includes('FROM article_versions ') ? {content_json:long}: {})}]}));
}};
const config = {DB:db,FOLKLY_EXPORT_TOKEN_SHA256:await sha256(token),FOLKLY_EXPORT_EXPIRES_AT:new Date(now+900_000).toISOString()};
const request = (extra={},url='https://site.example/api/admin/export') => new Request(url,{headers:{authorization:`Bearer ${token}`,...extra}});
for (const [req,env,status] of [
  [new Request('https://site.example/api/admin/export'),config,401],
  [request({authorization:`Bearer ${'b'.repeat(64)}`}),config,401],
  [request(),{},404], [request(),{...config,FOLKLY_EXPORT_EXPIRES_AT:new Date(now-1).toISOString()},404],
  [request(),{...config,FOLKLY_EXPORT_EXPIRES_AT:new Date(now+3_600_001).toISOString()},404],
  [request({},'https://site.example/api/admin/export?table=settings'),config,401],
  [request({range:'bytes=0-10'}),config,401],
  [new Request('https://site.example/api/admin/export',{method:'POST',headers:{authorization:`Bearer ${token}`}}),config,405],
]) assert.equal((await exportResponse(req,env,now)).status,status);
assert.equal(reads,0,'Rejected access must not touch DB');
const response = await exportResponse(request(),config,now);
assert.equal(response.status,200);
assert.match(response.headers.get('cache-control'),/no-store/);
assert.equal(response.headers.get('access-control-allow-origin'),null);
const {snapshot,receipt} = await response.json();
assert.equal(snapshot.records.article_versions[0].content_json,long);
assert.deepEqual(Object.keys(snapshot.records),TABLES);
assert.ok(!('settings' in snapshot.records));
const {sha256:digest,...payload} = snapshot;
assert.equal(await sha256(JSON.stringify(payload)),digest);
assert.equal(receipt.sha256,digest);
assert.equal(receipt.counts.article_versions,1);
settings[0].value='true';
assert.equal((await exportResponse(request(),config,now)).status,409);
settings[0].value='false';
const partial = {...config,DB:{...db,batch:async s=>(await db.batch(s)).map((r,i)=>i===1?{...r,results:[{n:2}]}:r)}};
assert.equal((await exportResponse(request(),partial,now)).status,413);
const failure = {...config,DB:{...db,batch:async()=>{throw Error('private DB details');}}};
assert.equal(await (await exportResponse(request(),failure,now)).text(),'Export unavailable');
console.log('Export checks passed: authorization, expiry, fixed reads, complete long JSON, source receipt, paused switches, partial/failure rejection.');

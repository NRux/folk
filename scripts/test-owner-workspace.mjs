import assert from 'node:assert/strict';
import {createWorkspaceHandlers,readDraft,workspaceConfiguration} from '../server/owner-workspace.js';
import {createWorkspaceStore} from '../server/workspace-store.js';
const id='11111111-1111-4111-8111-111111111111';let allowed=true,enabled=true,calls=0,reserved=0;const records=new Map();
const store={list:async kind=>[...records.values()].filter(x=>x.kind===kind),read:async(kind,id)=>records.get(kind+id),save:async(kind,id,row,etag)=>{const prior=records.get(kind+id);if(prior&&prior.etag!==etag)throw Object.assign(Error(),{code:'CONFLICT'});const next={...row,etag:'rev2',kind};records.set(kind+id,next);return next;},reserve:async()=>{reserved++;}};
const h=createWorkspaceHandlers({authorize:async()=>allowed?{db:{}}:null,configured:()=>enabled,store,drafts:async()=>({content:'private draft'}),chat:async()=>{calls++;return {text:'Editor reply',usage:{inputTokens:12,outputTokens:5}};}});
const request=(body,origin='https://www.folkly.com')=>new Request('https://www.folkly.com/api/owner-workspace',{method:'POST',headers:{origin},body:JSON.stringify(body)});
allowed=false;assert.equal((await h.GET(new Request('https://www.folkly.com/api/owner-workspace'))).status,401);assert.equal((await h.POST(request({action:'chat',id,message:'hello'}))).status,401);assert.equal(records.size,0);
allowed=true;assert.equal((await h.POST(request({},'https://evil.example'))).status,403);
const idea={id,title:'Indigo',place:'Japan',angle:'Labor',sources:'https://example.com',notes:'<script>private</script>',priority:'High',status:'Idea'};
assert.equal((await h.POST(request({action:'idea',idea}))).status,200);
assert.equal((await h.POST(request({action:'idea',idea}))).status,409);
assert.equal((await h.POST(request({action:'idea',idea:{...idea,title:'Revised'},etag:'rev2'}))).status,200);
assert.equal((await h.POST(request({action:'idea',idea:{...idea,id:'../secret'}}))).status,400);
enabled=false;assert.equal((await h.POST(request({action:'chat',id,message:'Plan an article'}))).status,503);assert.equal(calls,0);enabled=true;
assert.equal((await h.POST(request({action:'chat',id,message:'Plan an article'}))).status,200);assert.equal(calls,1);assert.equal(reserved,1);
assert.equal((await h.POST(request({action:'chat',id,message:'Plan an article'}))).status,409);assert.equal(calls,1);
assert.equal((await h.GET(new Request('https://www.folkly.com/api/owner-workspace?draft=../../private'))).status,400);
let selects=[];const db={from:table=>{const query={select(fields){selects.push([table,fields]);return this;},eq(){return this;},maybeSingle:async()=>({data:table==='folkly_content_objects'?null:{id,title:'Draft',status:'draft'}}),order(field){assert.equal(field,'version');return this;},limit:async()=>({data:[{version:1,content_json:'{"sections":[]}',created_at:'2026-10-08'}]})};return query;}};
assert.equal((await readDraft(db,id)).version,1);assert(selects[1][1].includes('content_json'));
const blobs=new Map();const blob={get:async path=>blobs.has(path)?{statusCode:200,blob:{etag:'etag'},stream:new Response(blobs.get(path)).body}:null,put:async(path,value,options)=>{assert.equal(options.access,'private');if(blobs.has(path)&&!options.allowOverwrite)throw Error('exists');blobs.set(path,value);return {etag:'etag'};},list:async()=>({blobs:[],hasMore:false})};
const privateStore=createWorkspaceStore(blob);for(let i=0;i<20;i++)await privateStore.reserve(new Date('2026-10-08'),id);await assert.rejects(privateStore.reserve(new Date('2026-10-08'),id),/exhausted/);
console.log('Owner workspace passed: owner denial, CSRF, bounded records, UUID/revision conflicts, disabled chat, durable duplicate attempts, private budget slots, draft allowlist and version query. No model calls or hosted writes.');
let pages=0;const paginated=createWorkspaceStore({...blob,list:async options=>{pages++;return options.cursor?{blobs:[],hasMore:false}:{blobs:[],hasMore:true,cursor:'next'};}});assert.deepEqual(await paginated.list('ideas'),[]);assert.equal(pages,2);
allowed=false;const count=records.size;assert.equal((await h.POST(request({action:'idea',idea,etag:'rev2'}))).status,401);assert.equal(records.size,count);
assert.deepEqual(workspaceConfiguration({}).missing,['FOLKLY_EDITOR_CHAT_ENABLED=true','OPENAI_API_KEY','private Blob connection']);
assert.equal(workspaceConfiguration({FOLKLY_EDITOR_CHAT_ENABLED:'true',OPENAI_API_KEY:'never-return-this',BLOB_STORE_ID:'test'}).available,true);
assert(!JSON.stringify(workspaceConfiguration({OPENAI_API_KEY:'never-return-this'})).includes('never-return-this'));
for(const fail of ['ideas','chat']){
 const partial=createWorkspaceHandlers({authorize:async()=>({db:{}}),configured:()=>true,store:{list:async kind=>{if(kind===fail)throw Error('private storage credential');return kind==='ideas'?[idea]:[];}}});
 const result=await(await partial.GET(new Request('https://www.folkly.com/api/owner-workspace'))).json();
 assert.equal(result.ideasAvailable,fail!=='ideas');assert.equal(result.chatHistoryAvailable,fail!=='chat');assert.equal(result.chatAvailable,fail!=='chat');assert(!JSON.stringify(result).includes('private storage credential'));
}
const verified=await privateStore.save('ideas',id,idea);assert.equal(verified.etag,'etag');assert.equal((await privateStore.read('ideas',id)).notes,idea.notes);
const unreadable=createWorkspaceStore({...blob,get:async()=>null});await assert.rejects(unreadable.save('ideas','22222222-2222-4222-8222-222222222222',idea),e=>e.code==='SAVE_UNVERIFIED');
const mismatched=createWorkspaceStore({...blob,get:async()=>({statusCode:200,blob:{etag:'etag'},stream:new Response(JSON.stringify({...idea,title:'Unexpected content'})).body})});await assert.rejects(mismatched.save('ideas','44444444-4444-4444-8444-444444444444',idea),e=>e.code==='SAVE_UNVERIFIED');
const outage=createWorkspaceStore({...blob,put:async()=>{throw Object.assign(Error('private-token'),{name:'BlobUnknownError'});}});await assert.rejects(outage.save('ideas',id,idea),e=>e.code!=='CONFLICT');
const unknown=createWorkspaceHandlers({authorize:async()=>({db:{}}),configured:()=>true,store:unreadable});const unverified=await unknown.POST(request({action:'idea',idea:{...idea,id:'33333333-3333-4333-8333-333333333333'}}));assert.equal(unverified.status,503);assert.equal((await unverified.json()).code,'SAVE_UNVERIFIED');
console.log('Workspace persistence passed: private idea save requires uncached ETag/content readback, ambiguous storage faults are not called conflicts, independent panels survive read outages and configuration reports contain no secret values.');
for(const [fault,expected] of [[Object.assign(Error('provider secret'),{statusCode:401}),/rejected its credentials/],[Object.assign(Error('provider secret'),{statusCode:429}),/funded-quota/],[null,/no editor text/]]){
 const attempts=new Map(),safeStore={list:async()=>[],reserve:async()=>{},read:async()=>({etag:'1'}),save:async(kind,key,row)=>{attempts.set(key,row);return row;}};
 const failed=createWorkspaceHandlers({authorize:async()=>({db:{}}),configured:()=>true,store:safeStore,chat:async()=>{if(fault)throw fault;return {text:' '};}});
 const response=await failed.POST(request({action:'chat',id,message:'hello'}));assert.equal(response.status,503);const payload=await response.json();assert.match(payload.message,expected);assert(!JSON.stringify(payload).includes('provider secret'));assert.equal(attempts.get(id).state,'pending');
}

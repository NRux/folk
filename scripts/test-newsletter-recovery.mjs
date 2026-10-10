import assert from 'node:assert/strict';
import {createNewsletterStore} from '../server/newsletter-store.js';
import {createNewsletterHandler,subscriberId,unsubscribeToken} from '../server/newsletter.js';
import {createUnsubscribeHandler} from '../api/unsubscribe.js';

const id=subscriberId('reader@example.com'),other=subscriberId('other@example.com');
const key=`newsletter/delivery/2026-10-09/${id}.json`;
const receipt=`newsletter/receipts/2026-10-09/${id}.json`;
const suppression=`newsletter/suppressed/${id}.json`;
const claimed={state:'claimed',createdAt:'2026-10-09T16:00:00.000Z'};
const accepted={state:'accepted',providerId:'receipt-1',acceptedAt:'2026-10-09T16:00:01.000Z'};
const record=email=>({email,consent:true,consentVersion:'2026-10-07',subscribedAt:'2026-10-08T12:00:00.000Z',source:'folkly-web'});
function fixture({write='normal',pages}={}) {
 const blobs=new Map(),writes=[];
 const sdk={
  get:async(path,args)=>{assert.equal(args.access,'private');assert.equal(args.useCache,false);return blobs.has(path)?{statusCode:200,stream:new Response(blobs.get(path)).body}:null;},
  put:async(path,value,args)=>{
   writes.push(path);assert.equal(args.access,'private');assert.equal(args.addRandomSuffix,false);
   assert.equal(args.allowOverwrite,false,'Newsletter evidence must be append-only');
   if(blobs.has(path))throw Error('exists');
   if(write==='missing')return;
   blobs.set(path,write==='wrong'?'{}':value);
   if(write==='ambiguous')throw Error('transport lost after persistence');
  },
  list:async args=>pages?pages(args):({blobs:[],hasMore:false}),
 };
 return {blobs,writes,sdk,store:createNewsletterStore(sdk)};
}

// A successful transport is not proof that a durable guard exists.
for(const write of ['missing','wrong']) {
 const f=fixture({write});await assert.rejects(f.store.claim(key,claimed));
 const unsub=createUnsubscribeHandler({secret:()=> 's'.repeat(40),suppress:id=>f.store.suppress(id)});
 const result=await unsub(new Request(`https://www.folkly.com/api/unsubscribe?token=${unsubscribeToken(id,'s'.repeat(40))}`,{method:'POST'}));
 assert.equal(result.status,503,'Never acknowledge unverified suppression');
 assert.equal(result.headers.get('Cache-Control'),'no-store');
}
{
 const f=fixture({write:'ambiguous'});assert.equal(await f.store.claim(key,claimed),false);
 assert.equal(await f.store.claim(key,claimed),false);assert.equal(f.writes.length,1);
 await f.store.suppress(id);const original=f.blobs.get(suppression);
 await f.store.suppress(id);assert.equal(f.blobs.get(suppression),original);
 assert.equal(f.writes.filter(path=>path===suppression).length,1);
}
{
 const f=fixture();assert.equal(await f.store.claim(key,claimed),true);
 await f.store.finish(key,accepted);assert.deepEqual(JSON.parse(f.blobs.get(key)),claimed);
 assert.deepEqual(JSON.parse(f.blobs.get(receipt)),accepted);
 await f.store.finish(key,accepted);assert.equal(f.writes.length,2);
 await assert.rejects(f.store.finish(key,{state:'suppressed'}));
 assert.deepEqual(JSON.parse(f.blobs.get(receipt)),accepted);
 assert.equal(await f.store.claim(key,claimed),false);
 for(const legacy of [accepted,{state:'suppressed'}]) {
  const old=fixture();old.blobs.set(key,JSON.stringify(legacy));
  assert.equal(await old.store.claim(key,claimed),false,'Keep old terminal delivery guards');
  await assert.rejects(old.store.finish(key,claimed));
 }
}
{
 const f=fixture({write:'ambiguous'});f.blobs.set(key,JSON.stringify(claimed));
 await f.store.finish(key,accepted);assert.deepEqual(JSON.parse(f.blobs.get(receipt)),accepted);
 assert.equal(f.blobs.get(key),JSON.stringify(claimed),'Lost receipt response cannot alter the claim');
}
{
 const f=fixture();await Promise.all([f.store.suppress(id),f.store.suppress(id)]);
 assert.equal(await f.store.suppressed(id),true);const saved=f.blobs.get(suppression);
 await f.store.suppress(id);assert.equal(f.blobs.get(suppression),saved);
}
{
 const f=fixture();await assert.rejects(f.store.finish(key,accepted));assert.equal(f.writes.length,0);
 await assert.rejects(f.store.claim('newsletter/delivery/2026-02-30/'+id+'.json',claimed));
 await assert.rejects(f.store.claim('subscribers/'+id+'.json',claimed));
 await assert.rejects(f.store.suppress('../private'));assert.equal(f.writes.length,0);
 f.blobs.set(suppression,'{}');await assert.rejects(f.store.suppressed(id));
 await assert.rejects(f.store.suppress(id));assert.equal(f.blobs.get(suppression),'{}');
}
{
 const f=fixture();f.blobs.set(receipt,JSON.stringify(accepted));
 assert.equal(await f.store.claim(key,claimed),false,'A receipt without a restored claim still prevents resend');
 assert.equal(f.writes.length,0);
 f.blobs.set(receipt,'{}');await assert.rejects(f.store.claim(key,claimed));
 assert.equal(f.writes.length,0,'Corrupt restore evidence must remain held');
}

const path=`subscribers/${id}.json`,next=`subscribers/${other}.json`;
const malformedPages=[
 ()=>({blobs:[{pathname:path}],hasMore:true}),
 ()=>({blobs:[{pathname:path}],hasMore:'false'}),
 ()=>({blobs:[{pathname:'subscribers/unrecognized.json'}],hasMore:false}),
 ()=>({blobs:[{pathname:path},{pathname:path}],hasMore:false}),
 ()=>({blobs:[{pathname:path,size:4097}],hasMore:false}),
 args=>({blobs:[{pathname:args.cursor?next:path}],hasMore:true,cursor:'same'}),
 args=>args.cursor?({blobs:[{pathname:next}],hasMore:false}):({blobs:[{pathname:path}],hasMore:true,cursor:'next'}),
];
for(let i=0;i<malformedPages.length;i++) {
 const f=fixture({pages:malformedPages[i]});f.blobs.set(path,JSON.stringify(record('reader@example.com')));
 if(i!==6)f.blobs.set(next,JSON.stringify(record('other@example.com')));
 await assert.rejects(f.store.subscribers(200),'Incomplete enumeration must not yield a partial list');
}
{
 const f=fixture({pages:args=>({blobs:[{pathname:args.cursor?next:path}],hasMore:!args.cursor,...(!args.cursor?{cursor:'next'}:{})})});
 f.blobs.set(path,JSON.stringify(record('reader@example.com')));f.blobs.set(next,JSON.stringify(record('other@example.com')));
 assert.equal((await f.store.subscribers(200)).length,2);
 await assert.rejects(f.store.subscribers(1));
 for(const limit of [0,201,NaN,1.5])await assert.rejects(f.store.subscribers(limit));
}
{
 let pages=0;const f=fixture({pages:()=>({blobs:[{pathname:`subscribers/${(++pages).toString(16).padStart(64,'0')}.json`}],hasMore:true,cursor:`page-${pages}`})});
 await assert.rejects(f.store.subscribers(200));assert.equal(pages,20,'Enumeration has a finite page bound');
}

// Stop oversized bodies while streaming, instead of allocating the entire file.
{
 let cancelled=false,pulls=0;
 const f=fixture();f.sdk.get=async()=>({statusCode:200,stream:new ReadableStream({pull(c){pulls++;c.enqueue(new Uint8Array(4097));},cancel(){cancelled=true;}})});
 await assert.rejects(createNewsletterStore(f.sdk).suppressed(id));assert(cancelled);assert(pulls<=2);
}
{
 const f=fixture();f.blobs.set(suppression,new Uint8Array([0xff]));
 await assert.rejects(f.store.suppressed(id),'Malformed UTF-8 must not be replaced silently');
}

const cfg={enabled:true,cronSecret:'fixture',apiKey:'fixture',from:'Folkly <updates@folkly.com>',postalAddress:'Fixture address',secret:'s'.repeat(40),storage:true};
const request=()=>new Request('https://www.folkly.com/api/newsletter',{headers:{authorization:'Bearer fixture'}});
const stories=[{slug:'public-story',title:'Fixture story',status:'published',publishedAt:'2026-10-08'}];
{
 const handler=createUnsubscribeHandler({secret:()=>cfg.secret,suppress:()=>assert.fail('Invalid request must not write')});
 const token=unsubscribeToken(id,cfg.secret),url=`https://www.folkly.com/api/unsubscribe?token=${token}`;
 assert.equal((await handler(new Request(`${url}&token=${token}`,{method:'POST'}))).status,400);
 const results=[await handler(new Request(url,{method:'PUT'})),await handler(new Request('https://www.folkly.com/api/unsubscribe')),await createUnsubscribeHandler({secret:()=>'',suppress:()=>{}})(new Request(url))];
 assert.deepEqual(results.map(r=>r.status),[405,400,503]);
 for(const r of results){assert.equal(r.headers.get('Cache-Control'),'no-store');assert.equal(r.headers.get('Referrer-Policy'),'no-referrer');}
 const paused=createNewsletterHandler({config:()=>({...cfg,enabled:false}),catalog:()=>assert.fail('Paused catalog read'),store:fixture().store,send:()=>assert.fail('Paused send')});
 const pauseReply=await paused(request());assert.deepEqual(await pauseReply.json(),{paused:true});
 assert.equal(pauseReply.headers.get('Cache-Control'),'no-store');
 const anonymous=await paused(new Request('https://www.folkly.com/api/newsletter'));
 assert.equal(anonymous.status,401);assert.equal(anonymous.headers.get('Cache-Control'),'no-store');
}
{
 const f=fixture({pages:()=>({blobs:[{pathname:path}],hasMore:false})});f.blobs.set(path,JSON.stringify(record('reader@example.com')));
 let sends=0;const handler=createNewsletterHandler({config:()=>cfg,catalog:async()=>stories,store:f.store,now:()=>new Date(claimed.createdAt),send:async()=>{sends++;return {id:'receipt-1'};},pause:async()=>{}});
 const results=await Promise.all([handler(request()),handler(request())]);
 assert.equal(sends,1);assert.equal(results.filter(r=>r.status===200).length,2);
 assert.deepEqual(JSON.parse(f.blobs.get(key)),claimed);assert(f.blobs.has(receipt));
 await handler(request());assert.equal(sends,1,'SDK-backed fixture guards concurrency and retries');
}
{
 const f=fixture({pages:()=>({blobs:[{pathname:path}],hasMore:true})});f.blobs.set(path,JSON.stringify(record('reader@example.com')));
 let sends=0;const handler=createNewsletterHandler({config:()=>cfg,catalog:async()=>stories,store:f.store,now:()=>new Date(claimed.createdAt),send:async()=>{sends++;return {id:'receipt-1'};},pause:async()=>{}});
 const result=await handler(request());assert.equal(result.status,503);assert.equal(sends,0);
 assert.equal(result.headers.get('Cache-Control'),'no-store');
}
{
 const f=fixture({pages:args=>args.cursor?{blobs:[{pathname:next}],hasMore:false}:{blobs:[{pathname:path}],hasMore:true,cursor:'next'}});
 f.blobs.set(path,JSON.stringify(record('reader@example.com')));f.blobs.set(next,JSON.stringify({...record('other@example.com'),consent:false}));
 let sends=0;const handler=createNewsletterHandler({config:()=>cfg,catalog:async()=>stories,store:f.store,now:()=>new Date(claimed.createdAt),send:async()=>{sends++;},pause:async()=>{}});
 assert.equal((await handler(request())).status,503);assert.equal(sends,0,'Validate later-page consent before the first provider call');
}
{
 const f=fixture({pages:()=>({blobs:[{pathname:path}],hasMore:false})});f.blobs.set(path,JSON.stringify(record('reader@example.com')));
 const originalPut=f.sdk.put;f.sdk.put=async(p,...args)=>p.startsWith('newsletter/receipts/')?undefined:originalPut(p,...args);
 let sends=0;const handler=createNewsletterHandler({config:()=>cfg,catalog:async()=>stories,store:createNewsletterStore(f.sdk),now:()=>new Date(claimed.createdAt),send:async()=>{sends++;return {id:'receipt-1'};},pause:async()=>{}});
 const first=await (await handler(request())).json();assert.equal(first.accepted,0);assert.equal(first.held,1);
 const replay=await (await handler(request())).json();assert.equal(replay.held,1);assert.equal(sends,1);
 assert.deepEqual(JSON.parse(f.blobs.get(key)),claimed);
}
console.log('Newsletter recovery passed: verified append-only claims/receipts/suppression, legacy guards, ambiguous writes, immutable unsubscribe history, complete bounded enumeration, cancelled oversize/invalid UTF-8, no false acknowledgment and no resend after receipt loss. Fixtures only; no mail or production writes.');

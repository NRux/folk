import assert from 'node:assert/strict';
import {createNewsletterHandler,subscriberId,unsubscribeToken,verifyUnsubscribe,digestWindow,digestStories,digestEmail} from '../server/newsletter.js';
import {createUnsubscribeHandler} from '../api/unsubscribe.js';
const secret='a'.repeat(40),id=subscriberId('reader@example.com'),token=unsubscribeToken(id,secret);
assert.equal(verifyUnsubscribe(token,secret),id);
assert.equal(verifyUnsubscribe(token,'b'.repeat(40)),null);
assert.equal(verifyUnsubscribe(token+'x',secret),null);
assert.equal(verifyUnsubscribe(token,'short'),null);
const date=new Date('2026-10-09T16:00:00Z');
assert.equal(digestWindow(date).key,'2026-10-09');
assert.equal(digestWindow(new Date('2026-10-09T15:59:59Z')).key,'2026-10-02');
assert.equal(digestWindow(new Date('2026-10-12T16:00:00Z')).key,'2026-10-09');
const stories=[{slug:'public-story',title:'Culture <script>bad</script>',description:'A & B',status:'published',publishedAt:'2026-10-08'},{slug:'draft',status:'draft',publishedAt:'2026-10-08'},{slug:'old-story',status:'published',publishedAt:'2026-09-01'}];
assert.equal(digestStories(stories,date).length,1);
const friday={...stories[0],publishedAt:'2026-10-09'};
assert.equal(digestStories([friday],date).length,0);
assert.equal(digestStories([friday],new Date('2026-10-16T16:00:00Z')).length,1);
assert(!digestEmail(digestStories(stories,date),'https://www.folkly.com/api/unsubscribe','Address').html.includes('<script>'));
const claims=new Map(),suppressed=new Set(),sent=[];
const store={subscribers:async()=>[{id,record:{email:'reader@example.com',consent:true}},{id:subscriberId('acceptance-test@example.com'),record:{email:'acceptance-test@example.com',consent:true}}],suppressed:async id=>suppressed.has(id),claim:async (key,value)=>{if(claims.has(key))return false;claims.set(key,value);return true;},finish:async(key,value)=>claims.set(key,value)};
let cfg={enabled:true,cronSecret:'cron',apiKey:'key',from:'Folkly <updates@folkly.com>',secret,postalAddress:'Mailing address',storage:true};
const request=()=>new Request('https://www.folkly.com/api/newsletter',{headers:{authorization:'Bearer cron'}});
const handler=createNewsletterHandler({config:()=>cfg,catalog:async()=>stories,store,now:()=>date,pause:async()=>{},send:async(...args)=>{sent.push(args);return {id:'receipt'};}});
assert.equal((await handler(new Request('https://www.folkly.com/api/newsletter'))).status,401);
cfg.enabled=false;assert((await (await handler(request())).json()).paused);assert.equal(sent.length,0);cfg.enabled=true;
cfg.apiKey='';assert.equal((await handler(request())).status,503);cfg.apiKey='key';
const both=await Promise.all([handler(request()),handler(request())]);assert.equal(sent.length,1);
assert.equal(sent[0][0].to.length,1);assert(sent[0][0].headers['List-Unsubscribe-Post']);assert(sent[0][1].includes(id));
await handler(request());assert.equal(sent.length,1);
assert.equal([...claims.values()][0].state,'accepted');
claims.clear();suppressed.add(id);await handler(request());assert.equal(sent.length,1);assert.equal(claims.size,0);suppressed.clear();
const failing=createNewsletterHandler({config:()=>cfg,catalog:async()=>stories,store,now:()=>date,pause:async()=>{},send:async()=>{throw Error('private failure');}});
const fail=await failing(request());assert.equal((await fail.json()).held,1);await handler(request());assert.equal(sent.length,1,'Ambiguous send must not be replayed');
let writes=0;
const unsub=createUnsubscribeHandler({secret:()=>secret,suppress:async recipient=>{assert.equal(recipient,id);writes++;suppressed.add(recipient);}});
const url=`https://www.folkly.com/api/unsubscribe?token=${token}`;
assert.equal((await unsub(new Request(url))).status,200);assert.equal(writes,0,'GET/scanner cannot unsubscribe');
assert.equal((await unsub(new Request(url,{method:'POST'}))).status,200);assert.equal(writes,1);
assert.equal((await unsub(new Request(url+'bad',{method:'POST'}))).status,400);
const outage=createUnsubscribeHandler({secret:()=>secret,suppress:async()=>{throw Error('secret');}});
const response=await outage(new Request(url,{method:'POST'}));assert.equal(response.status,503);assert(!(await response.text()).includes('secret'));
console.log('Newsletter passed: authorization, disabled/config guards, weekly window, public-only digest, escaped HTML, single-recipient privacy, concurrent/retry claims, ambiguous-send hold, suppression, signed unsubscribe, scanner-safe GET and storage outage. No email sent.');

const {createNewsletterStore}=await import('../server/newsletter-store.js');
const blobs=new Map();let pages=0;
const privateStore=createNewsletterStore({
 get:async(path,options)=>{assert.equal(options.access,'private');assert.equal(options.useCache,false);return blobs.has(path)?{statusCode:200,stream:new Response(blobs.get(path)).body}:null;},
 put:async(path,value,options)=>{assert.equal(options.access,'private');assert.equal(options.addRandomSuffix,false);if(options.allowOverwrite===false&&blobs.has(path))throw Error('exists');blobs.set(path,value);},
 list:async(options)=>{assert.equal(options.prefix,'subscribers/');pages++;return {blobs:[{pathname:`subscribers/${id}.json`},{pathname:'subscribers/unsafe.json'}],hasMore:pages===1,cursor:pages===1?'next':undefined};}
});
blobs.set(`subscribers/${id}.json`,JSON.stringify({email:'reader@example.com',consent:true}));
assert.equal((await privateStore.subscribers(200))[0].id,id);
assert.equal(pages,2);
assert(await privateStore.claim('newsletter/delivery/test.json',{state:'claimed'}));
assert(!await privateStore.claim('newsletter/delivery/test.json',{state:'claimed'}));
await privateStore.suppress(id);assert(await privateStore.suppressed(id));
console.log('Private newsletter adapter passed: paginated prefix, validated path IDs, cache bypass, private/create-only writes and suppression readback. Fixture only.');

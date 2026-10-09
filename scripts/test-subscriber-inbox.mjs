import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {readSubscriberInbox} from '../server/subscriber-inbox.js';

const record={email:'reader@example.com',consent:true,consentVersion:'2026-10-07',subscribedAt:'2026-10-08T12:00:00.000Z',source:'folkly-web'};
const id=createHash('sha256').update(record.email).digest('hex'),env={BLOB_STORE_ID:'fixture'};
let lists=0;
const storage={
  list:async args=>{lists++;assert.equal(args.prefix,'subscribers/');assert.equal(args.limit,20);return {blobs:[{pathname:`subscribers/${id}.json`,size:200}],hasMore:true,cursor:'page2'};},
  get:async(path,args)=>{assert.deepEqual(args,{access:'private',useCache:false});if(path===`subscribers/${id}.json`)return {statusCode:200,stream:new Response(JSON.stringify(record)).body};return null;},
};
const first=await readSubscriberInbox({env,storage});
assert.deepEqual(first.rows,[{email:record.email,status:'Subscribed',subscribedAt:record.subscribedAt,consentVersion:record.consentVersion,source:record.source}]);
assert.equal(first.nextCursor,'page2');assert.equal(first.hasMore,true);assert(!JSON.stringify(first).includes(id));
const suppressed=await readSubscriberInbox({env,storage:{...storage,get:async(path,args)=>path.startsWith('newsletter/suppressed/')?{statusCode:200,stream:new Response('{}').body}:storage.get(path,args)}});
assert.equal(suppressed.rows[0].status,'Unsubscribed');
assert.equal((await readSubscriberInbox({env:{},storage:{list:()=>assert.fail('unconfigured access')}})).available,false);
assert.equal((await readSubscriberInbox({env,storage,cursor:'bad\nvalue'})).available,false);assert.equal(lists,2);
for(const bad of [
  {pathname:'contacts/private.json',size:1},
  {pathname:'subscribers/not-a-hash.json',size:1},
  {pathname:`subscribers/${id}.json`,size:5000},
])assert.equal((await readSubscriberInbox({env,storage:{...storage,list:async()=>({blobs:[bad],hasMore:false})}})).available,false);
const malformed={...record,email:'bad'};
assert.equal((await readSubscriberInbox({env,storage:{...storage,list:async()=>({blobs:[{pathname:`subscribers/${id}.json`,size:100}],hasMore:false}),get:async path=>path.startsWith('subscribers/')?{statusCode:200,stream:new Response(JSON.stringify(malformed)).body}:null}})).available,false);
assert.equal((await readSubscriberInbox({env,storage:{...storage,list:async()=>({blobs:[],hasMore:true,cursor:'same'})},cursor:'same'})).available,false);
const ownerHtml=await readFile('dist/owner.html','utf8');
const ids=[...ownerHtml.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
assert.equal(new Set(ids).size,ids.length,'Deployed owner controls must have unique IDs');
assert.equal(ids.filter(id=>id==='owner-subscribers').length,1,'Exactly one subscriber panel');
assert(ownerHtml.includes('id="owner-subscribers"'));assert(ownerHtml.includes('id="owner-subscriber-list"'));assert(ownerHtml.includes('id="owner-subscriber-next"'));assert(!ownerHtml.includes('BLOB_READ_WRITE_TOKEN'));
console.log('Subscriber inbox passed: authenticated-reader adapter uses bounded private pages, validates records, reports suppression, hides storage IDs and fails closed.');

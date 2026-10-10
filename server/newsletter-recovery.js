import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {createClient} from '@supabase/supabase-js';
import {get,put,list} from '@vercel/blob';
import {createEditorialClient} from './supabase.js';
import {createNewsletterStore} from './newsletter-store.js';
import {readNewsletterRecord} from './newsletter-records.js';

export const RECOVERY_PROJECT='vxmyggasjgsiohqzzwzh';
export const RECOVERY_FORMAT='folkly-newsletter-storage-recovery-v1';
export const RECOVERY_CHECKS=['concurrentClaim','immutableClaim','terminalReadback','lostWriteReply','interruptionHeld','receiptOnlyRestore','fullRestoreHeld','suppressionStable','corruptSuppressionDenied','subscriberReadback','inventoryReadback'];
const hash=value=>createHash('sha256').update(value).digest('hex');
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
const validLogical=path=>typeof path==='string'&&/^(?:subscribers\/[a-f0-9]{64}|newsletter\/(?:delivery|receipts)\/2026-10-09\/[a-f0-9]{64}|newsletter\/suppressed\/[a-f0-9]{64})\.json$/.test(path);
const headers={'cache-control':'private, no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow'};
const reply=(body,status=200)=>Response.json(body,{status,headers});
const ensure=(value)=>{if(!value)throw Error('Recovery check failed');};

// Bind the administrative grant to the actual deployed checker and store bytes.
export async function recoveryContract(){
 const files=['newsletter-recovery.js','newsletter-store.js','newsletter-records.js'];
 return hash(JSON.stringify(await Promise.all(files.map(async name=>[name,await readFile(new URL('../server/'+name,import.meta.url),'utf8')]))));
}
export function recoveryClient(env,signal){
 if(new URL(env.SUPABASE_URL||'https://invalid.local').href!==`https://${RECOVERY_PROJECT}.supabase.co/`)throw Error('Wrong recovery project');
 return createEditorialClient(env,(url,key,options)=>createClient(url,key,{...options,global:{fetch:(url,options={})=>fetch(url,{...options,signal:AbortSignal.any([signal,AbortSignal.timeout(15000),...(options.signal?[options.signal]:[])])})}}));
}
export function recoveryGrants(client){
 const rpc=async(name,args)=>{const result=await client.rpc(name,args);if(result.error)throw Error('Recovery operation unavailable');return result.data;};
 return {
  async inspect(tokenHash){const result=await client.from('folkly_newsletter_recovery_grants').select('id,contract_sha,status,expires_at').eq('token_sha256',tokenHash).eq('status','issued').gt('expires_at',new Date().toISOString()).maybeSingle();if(result.error)throw Error('Recovery authorization unavailable');return result.data;},
  claim:(tokenHash,contractSha,lease)=>rpc('folkly_claim_newsletter_recovery',{p_token_hash:tokenHash,p_contract_sha:contractSha,p_lease_id:lease}),
  complete:(id,lease,receipt)=>rpc('folkly_complete_newsletter_recovery',{p_grant_id:id,p_lease_id:lease,p_receipt:receipt}),
  async readback(id){const result=await client.from('folkly_newsletter_recovery_grants').select('status,receipt,lease_id').eq('id',id).single();if(result.error)throw Error('Recovery receipt unavailable');return result.data;},
 };
}

export async function runStorageRecovery({grantId,sdk,signal=AbortSignal.timeout(120000)}){
 ensure(uuid(grantId));
 const prefix=`acceptance/newsletter/${grantId}/`,paths=new Set(),checks={};
 // All logical production paths are mapped to one private fixture namespace.
 // No input can select a real subscriber, provider, directory or operation.
 const mapped=(scenario,path)=>{ensure(/^[a-z-]{1,40}$/.test(scenario)&&validLogical(path));return prefix+scenario+'/'+path;};
 const bound=opts=>({...opts,abortSignal:AbortSignal.any([signal,...(opts.abortSignal?[opts.abortSignal]:[])])});
 const scoped=scenario=>({
  get:(path,opts)=>sdk.get(mapped(scenario,path),bound(opts)),
  put:async(path,value,opts)=>{const target=mapped(scenario,path);ensure(opts.access==='private'&&opts.allowOverwrite===false&&opts.addRandomSuffix===false&&Buffer.byteLength(value)<=4096);paths.add(target);ensure(paths.size<=30);return sdk.put(target,value,bound(opts));},
  list:async opts=>{ensure(opts.prefix==='subscribers/');const scope=prefix+scenario+'/';const page=await sdk.list(bound({...opts,prefix:scope+opts.prefix}));ensure(Array.isArray(page?.blobs));return {...page,blobs:page.blobs.map(blob=>{ensure(blob.pathname.startsWith(scope));return {...blob,pathname:blob.pathname.slice(scope.length)};})};},
 });
 const id=hash('synthetic-reader@newsletter.invalid'),path=`newsletter/delivery/2026-10-09/${id}.json`,receipt=`newsletter/receipts/2026-10-09/${id}.json`;
 const claimed={state:'claimed',createdAt:'2026-10-09T16:00:00.000Z'},accepted={state:'accepted',providerId:'synthetic-no-email',acceptedAt:'2026-10-09T16:00:01.000Z'};
 const read=(adapter,path)=>readNewsletterRecord(adapter.get,path);
 const write=(adapter,path,record)=>adapter.put(path,JSON.stringify(record),{access:'private',addRandomSuffix:false,allowOverwrite:false,contentType:'application/json'});
 const concurrent=scoped('concurrent'),store=createNewsletterStore(concurrent);
 const results=await Promise.all(Array.from({length:5},()=>store.claim(path,claimed)));
 ensure(results.filter(Boolean).length===1);checks.concurrentClaim=true;
 ensure(isDeepStrictEqual(await read(concurrent,path),claimed));
 await store.finish(path,accepted);await store.finish(path,accepted);
 ensure(isDeepStrictEqual(await read(concurrent,path),claimed));checks.immutableClaim=true;
 ensure(isDeepStrictEqual(await read(concurrent,receipt),accepted));checks.terminalReadback=true;
 ensure(await createNewsletterStore(concurrent).claim(path,claimed)===false);

 const lost=scoped('lost-reply'),lostStore=createNewsletterStore(lost);ensure(await lostStore.claim(path,claimed));
 const loseReply=createNewsletterStore({...lost,put:async(...args)=>{await lost.put(...args);throw Error('Injected reply loss after write');}});
 await loseReply.finish(path,accepted);ensure(isDeepStrictEqual(await read(lost,receipt),accepted));checks.lostWriteReply=true;

 const interrupted=scoped('interrupted');
 const interruptedStore=createNewsletterStore({...interrupted,put:async(...args)=>{await interrupted.put(...args);throw Error('Injected claim reply loss');}});
 ensure(await interruptedStore.claim(path,claimed)===false);
 ensure(await createNewsletterStore(interrupted).claim(path,claimed)===false);checks.interruptionHeld=true;

 // Restore copies into a new namespace; never remove live or fixture evidence.
 const restored=scoped('restored');await write(restored,receipt,await read(concurrent,receipt));
 ensure(await createNewsletterStore(restored).claim(path,claimed)===false);checks.receiptOnlyRestore=true;
 await write(restored,path,await read(concurrent,path));
 ensure(await createNewsletterStore(restored).claim(path,claimed)===false);
 ensure(isDeepStrictEqual(await read(restored,path),claimed)&&isDeepStrictEqual(await read(restored,receipt),accepted));checks.fullRestoreHeld=true;

 const suppression=scoped('suppression'),suppressionStore=createNewsletterStore(suppression);
 await Promise.all(Array.from({length:3},()=>suppressionStore.suppress(id)));
 const first=await read(suppression,`newsletter/suppressed/${id}.json`);
 await createNewsletterStore(suppression).suppress(id);
 ensure(await suppressionStore.suppressed(id)&&isDeepStrictEqual(first,await read(suppression,`newsletter/suppressed/${id}.json`)));checks.suppressionStable=true;
 const corrupt=scoped('corrupt');await write(corrupt,`newsletter/suppressed/${id}.json`,{invalid:true});
 let rejected=false;try{await createNewsletterStore(corrupt).suppressed(id);}catch{rejected=true;}
 ensure(rejected&&isDeepStrictEqual(await read(corrupt,`newsletter/suppressed/${id}.json`),{invalid:true}));checks.corruptSuppressionDenied=true;

 const subscriber=scoped('subscribers'),record={email:'synthetic-reader@newsletter.invalid',consent:true,consentVersion:'synthetic-only',source:'storage-recovery-fixture',subscribedAt:'2026-10-09T12:00:00.000Z'};
 await write(subscriber,`subscribers/${id}.json`,record);
 ensure(isDeepStrictEqual(await createNewsletterStore(subscriber).subscribers(200),[{id,record}]));checks.subscriberReadback=true;

 // Independent SDK enumeration and uncached body reads, not adapter success alone.
 let cursor;const seen=new Set(),inventory=[];
 for(let pageNo=0;;pageNo++){
  ensure(pageNo<5);const page=await sdk.list({prefix,limit:100,...(cursor?{cursor}:{}),abortSignal:signal});
  ensure(Array.isArray(page?.blobs)&&page.blobs.length<=100&&typeof page.hasMore==='boolean');
  for(const blob of page.blobs){ensure(paths.has(blob.pathname)&&!seen.has(blob.pathname));seen.add(blob.pathname);const value=await readNewsletterRecord((path,opts)=>sdk.get(path,bound(opts)),blob.pathname);ensure(value);inventory.push([blob.pathname.slice(prefix.length),hash(JSON.stringify(value))]);}
  if(!page.hasMore)break;ensure(page.blobs.length&&typeof page.cursor==='string'&&page.cursor.length<=2048&&page.cursor!==cursor);cursor=page.cursor;
 }
 ensure(seen.size===paths.size&&[...paths].every(path=>seen.has(path)));checks.inventoryReadback=true;
 ensure(RECOVERY_CHECKS.every(name=>checks[name]===true));
 return {checks,objects:paths.size,inventorySha:hash(JSON.stringify(inventory.sort((a,b)=>a[0].localeCompare(b[0]))))};
}

async function requestBody(request,signal){
 const reader=request.body?.getReader();if(!reader)throw Error('Missing body');let length=0;const chunks=[];
 const abort=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',abort,{once:true});
 try{for(;;){signal.throwIfAborted();const {done,value}=await reader.read();signal.throwIfAborted();if(done)break;length+=value.length;if(length>128)throw Error('Body too large');chunks.push(value);}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}
 finally{signal.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export function createNewsletterRecoveryHandler({environment=()=>process.env,contract=recoveryContract,clientFactory=recoveryClient,grantsFactory=recoveryGrants,sdk={get,put,list},run=runStorageRecovery,log=console.error}={}){
 return async request=>{
  const token=/^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('authorization')||'')?.[1];
  if(!token)return reply({error:'Recovery authorization required'},401);
  if(request.method!=='POST')return reply({error:'Method not allowed'},405);
  if(new URL(request.url).search||request.headers.has('range'))return reply({error:'Invalid recovery request'},400);
  if(request.headers.has('origin')&&request.headers.get('origin')!=='https://www.folkly.com')return reply({error:'Invalid origin'},403);
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))return reply({error:'JSON required'},415);
  const requestId=randomUUID(),signal=AbortSignal.timeout(150000);let stage='configuration';
  try{
   const env=environment();if(env.NEWSLETTER_ENABLED==='true'||!env.BLOB_READ_WRITE_TOKEN)throw Error('Delivery must stay paused');
   const client=clientFactory(env,signal),grants=grantsFactory(client);
   stage='authorization';const tokenHash=hash(token),grant=await grants.inspect(tokenHash);
   if(!grant)return reply({error:'Recovery authorization required'},401);
   const contractSha=await contract();if(contractSha!==grant.contract_sha||!uuid(grant.id))throw Error('Recovery contract changed');
   stage='validation';const body=await requestBody(request,signal);
   if(!isDeepStrictEqual(body,{operation:RECOVERY_FORMAT}))return reply({error:'Invalid recovery request'},400);
   stage='claim';const lease=randomUUID();if(await grants.claim(tokenHash,contractSha,lease)!==grant.id)throw Error('Recovery claim unavailable');
   stage='storage';const result=await run({grantId:grant.id,sdk,signal});
   const receipt={format:RECOVERY_FORMAT,projectId:RECOVERY_PROJECT,contractSha,grantId:grant.id,verifiedAt:new Date().toISOString(),...result,emailsSent:0,switchesPaused:true,deliveryPaused:true};
   stage='receipt';if(await grants.complete(grant.id,lease,receipt)!==true)throw Error('Recovery receipt not confirmed');
   const saved=await grants.readback(grant.id);if(saved.status!=='verified'||saved.lease_id!==null||!isDeepStrictEqual(saved.receipt,receipt))throw Error('Recovery receipt readback failed');
   return reply({ok:true,receipt});
  }catch{const code='NEWSLETTER_RECOVERY_'+stage.toUpperCase()+'_FAILED';log('Newsletter recovery failure',{requestId,stage,code});return reply({error:'Recovery check could not complete. Isolated evidence is retained; no automatic retry or email.',requestId,stage,code},stage==='validation'?400:503);}
 };
}

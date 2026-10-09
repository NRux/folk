import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {createClient} from '@supabase/supabase-js';
import {get,put} from '@vercel/blob';
import {createEditorialClient} from './supabase.js';
import {createContentStore,createSnapshotStore} from './content-store.js';
import {validatedImportRecords,blobImportRecords,digest} from '../scripts/supabase-snapshot.mjs';
import {createImportReader,verifyImportedSnapshot} from '../scripts/import-readback.mjs';

export const PROJECT_ID='vxmyggasjgsiohqzzwzh';
const MAX_BYTES=2_000_000;
const HEADERS={'cache-control':'private, no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-robots-tag':'noindex, nofollow'};
const reply=(body,status=200)=>Response.json(body,{status,headers:HEADERS});
export async function readImportContract(){
 const [schema,manifest,catalog]=await Promise.all([
  readFile(new URL('../supabase/migrations/20261007220625_folkly_editorial.sql',import.meta.url),'utf8'),
  readFile(new URL('../web/vercel/manual-releases.json',import.meta.url),'utf8'),
  readFile(new URL('../web/vercel/articles.json',import.meta.url),'utf8')]);
 return {schema,manifest:JSON.parse(manifest),catalog:JSON.parse(catalog)};
}
export const contractHash=contract=>digest(contract);
export function importClient(env,signal){
 const url=new URL(env.SUPABASE_URL||'https://invalid.local');
 if(url.href!==`https://${PROJECT_ID}.supabase.co/`)throw Error('Wrong import project');
 return createEditorialClient(env,(url,key,options)=>createClient(url,key,{...options,global:{
  fetch:(url,options={})=>fetch(url,{...options,signal:AbortSignal.any([signal,AbortSignal.timeout(15000),...(options.signal?[options.signal]:[])])})}}));
}
export function createImportStore(client){
 const rpc=async(name,args)=>{const r=await client.rpc(name,args);if(r.error)throw Error('Private import operation failed');return r.data;};
 return {
  async inspect(tokenHash){const r=await client.from('folkly_import_grants').select('id,source_sha,contract_sha,expected_counts,status,expires_at')
   .eq('token_sha256',tokenHash).eq('status','issued').gt('expires_at',new Date().toISOString()).maybeSingle();
   if(r.error)throw Error('Private import authorization unavailable');return r.data;},
  claim:(tokenHash,sourceSha,contractSha,lease)=>rpc('folkly_claim_editorial_import',{p_token_hash:tokenHash,p_source_sha:sourceSha,p_contract_sha:contractSha,p_lease_id:lease}),
  commit:(grant,lease,records,objects)=>rpc('folkly_commit_editorial_import',{p_grant_id:grant,p_lease_id:lease,p_records:records,p_objects:objects}),
  complete:(grant,lease,receipt)=>rpc('folkly_complete_editorial_import',{p_grant_id:grant,p_lease_id:lease,p_receipt:receipt}),
 };
}
async function boundedJson(request){
 const size=request.headers.get('content-length');
 if(size&&(!/^\d+$/.test(size)||Number(size)>MAX_BYTES))throw Error('Input too large');
 const reader=request.body?.getReader();if(!reader)throw Error('Missing input');
 let total=0;const chunks=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_BYTES)throw Error('Input too large');chunks.push(Buffer.from(value));}}
 catch(error){await reader.cancel().catch(()=>{});throw error;}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
}
export function createEditorialImportHandler({environment=()=>process.env,contract=readImportContract,
 clientFactory=importClient,storeFactory=createImportStore,contentFactory=createContentStore,
 snapshotFactory=createSnapshotStore,verify=verifyImportedSnapshot,log=console.error}={}){
 return async request=>{
  const token=/^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('authorization')||'')?.[1];
  if(!token)return reply({error:'Import authorization required'},401);
  if(request.method!=='POST')return reply({error:'Method not allowed'},405);
  if(new URL(request.url).search||request.headers.has('range'))return reply({error:'Invalid import request'},400);
  const origin=request.headers.get('origin');if(origin&&origin!=='https://www.folkly.com')return reply({error:'Invalid origin'},403);
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))return reply({error:'JSON required'},415);
  const requestId=randomUUID(),signal=AbortSignal.timeout(180000);
  let stage='configuration';
  try{
   const env=environment();if(!env.BLOB_READ_WRITE_TOKEN)throw Error('Private Blob configuration missing');
   const client=clientFactory(env,signal),store=storeFactory(client);
   stage='authorization';const tokenHash=createHash('sha256').update(token).digest('hex');
   const grant=await store.inspect(tokenHash);if(!grant)return reply({error:'Import authorization required'},401);
   const trusted=await contract();if(contractHash(trusted)!==grant.contract_sha)throw Error('Import contract changed');
   stage='validation';const input=await boundedJson(request);
   if(!input||Object.keys(input).sort().join()!=='receipt,snapshot'||input.receipt?.sha256!==grant.source_sha||!isDeepStrictEqual(input.receipt?.counts,grant.expected_counts))throw Error('Source receipt mismatch');
   const options={...trusted,expectedSha:grant.source_sha,expectedCounts:grant.expected_counts};
   const {records,sourceSha}=validatedImportRecords(input.snapshot,options);
   // Abort signals bound SDK calls; pending create-only objects never imply a DB commit.
   const blob={get:(path,options)=>get(path,{...options,abortSignal:signal}),put:(path,text,options)=>put(path,text,{...options,abortSignal:signal})};
   const contentStore=contentFactory(blob),snapshotStore=snapshotFactory(blob),lease=randomUUID();
   stage='claim';const id=await store.claim(tokenHash,sourceSha,grant.contract_sha,lease);
   if(id!==grant.id)throw Error('Import claim unavailable');
   stage='blob';await snapshotStore.upload(JSON.stringify(input.snapshot));
   const objects=[];for(const version of records.article_versions){signal.throwIfAborted();objects.push({article_version_id:version.id,...await contentStore.upload(version.content_json)});}
   const prepared=blobImportRecords(records,objects);
   stage='commit';signal.throwIfAborted();if(await store.commit(id,lease,prepared.records,prepared.objects)!==true)throw Error('Import commit not confirmed');
   stage='readback';const result=await verify(input.snapshot,options,{readPage:createImportReader(client),contentStore,snapshotStore});
   const receipt={...result,projectId:PROJECT_ID,verifiedAt:new Date().toISOString()};
   stage='receipt';if(await store.complete(id,lease,receipt)!==true)throw Error('Import receipt not confirmed');
   return reply({ok:true,receipt});
  }catch{
   const code='IMPORT_'+stage.toUpperCase()+'_FAILED';log('Editorial import failure',{requestId,stage,code});
   return reply({error:'Editorial import could not complete. Private objects and committed data are retained for reviewed recovery.',code,stage,requestId},stage==='validation'?400:503);
  }
 };
}

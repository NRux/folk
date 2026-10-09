import {readFile,writeFile,realpath,stat} from 'node:fs/promises';
import {resolve,relative,sep,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {createEditorialClient} from '../server/supabase.js';
import {createContentStore,createSnapshotStore} from '../server/content-store.js';
import {createImportReader,verifyImportedSnapshot} from './import-readback.mjs';

async function main(){
 const args=process.argv.slice(2),[input,receipt,output,mode]=args;
 if(args.length<3||args.length>4||!input||!receipt||!output||(mode&&mode!=='--sql'))throw Error('Usage: node scripts/verify-supabase-import.mjs <private-snapshot.json> <independent-source-receipt.json> <new-private-verification.json> [--sql]');
 const root=await realpath(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
 const privatePath=async(path,isOutput=false)=>{
  const canonical=isOutput?resolve(await realpath(dirname(resolve(path))),resolve(path).split(sep).at(-1)):await realpath(path);
  const rel=relative(root,canonical);
  if((rel!== '..'&&!rel.startsWith('..'+sep)&&!rel.startsWith(sep))||/(^|[\\/])(public|static|dist)([\\/]|$)/i.test(canonical))throw Error('Private inputs and verification receipt must be outside the repository and public directories');
  return canonical;
 };
 const target=await privatePath(output,true),snapshotPath=await privatePath(input),receiptPath=await privatePath(receipt);
 try{await stat(target);throw Error('Verification receipt already exists');}catch(error){if(error.code!=='ENOENT')throw error;}
 const json=async(path,max)=>{if((await stat(path)).size>max)throw Error('Private input too large');const bytes=await readFile(path);if(bytes.length>max)throw Error('Private input too large');return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));};
 const snapshot=await json(snapshotPath,10000000),proof=await json(receiptPath,100000);
 // Pin the existing destination; never inspect a different application by mistake.
 let destination;try{destination=new URL(process.env.SUPABASE_URL);}catch{}
 if(destination?.origin!=='https://vxmyggasjgsiohqzzwzh.supabase.co'||destination.pathname!=='/'||destination.search||destination.hash||destination.username||destination.password)throw Error('Configure server credentials for the existing Folkly Supabase project');
 const timedFetch=(url,options={})=>fetch(url,{...options,signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});
 const client=createEditorialClient(process.env,(url,key,options)=>createClient(url,key,{...options,global:{fetch:timedFetch}}));
 const options={expectedSha:proof.sha256,expectedCounts:proof.counts,schema:await readFile(resolve(root,'supabase/migrations/20261007220625_folkly_editorial.sql'),'utf8'),manifest:JSON.parse(await readFile(resolve(root,'web/vercel/manual-releases.json'),'utf8')),catalog:JSON.parse(await readFile(resolve(root,'web/vercel/articles.json'),'utf8'))};
 const result=await verifyImportedSnapshot(snapshot,options,{readPage:createImportReader(client),mode:mode==='--sql'?'sql':'blob',contentStore:createContentStore(),snapshotStore:createSnapshotStore()});
 const summary={...result,projectId:'vxmyggasjgsiohqzzwzh',verifiedAt:new Date().toISOString()};
 await writeFile(target,JSON.stringify(summary,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify(summary));
}
// Never print SDK errors, private file paths, request bodies or credentials.
main().catch(()=>{console.error('Import verification failed; no PASS receipt was written. Check the independent export, destination configuration and private readback. No import or repair was attempted.');process.exitCode=1;});

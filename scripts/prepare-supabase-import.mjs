import {readFile,writeFile,realpath,stat} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
import {createContentStore,createSnapshotStore} from '../server/content-store.js';
import {compileSnapshot} from './supabase-snapshot.mjs';
const [input,receipt,output,mode]=process.argv.slice(2);
if(!input||!receipt||!output)throw Error('Usage: node scripts/prepare-supabase-import.mjs <private-snapshot.json> <independent-receipt.json> <private-output.sql>');
const root=await realpath('.'),target=resolve(output),parent=await realpath(resolve(target,'..'));const rel=relative(root,parent);
if((rel!== '..'&&!rel.startsWith('..'+sep)&&!rel.startsWith(sep))||/(^|[\\/])(public|static|dist)([\\/]|$)/i.test(target))throw Error('Private SQL must be outside the repository and public directories');
if((await stat(input)).size>10000000||(await stat(receipt)).size>100000)throw Error('Input too large');
const snapshot=JSON.parse(await readFile(input,'utf8')),proof=JSON.parse(await readFile(receipt,'utf8'));
const options={expectedSha:proof.sha256,expectedCounts:proof.counts,schema:await readFile('supabase/migrations/20261007220625_folkly_editorial.sql','utf8'),manifest:JSON.parse(await readFile('web/vercel/manual-releases.json','utf8')),catalog:JSON.parse(await readFile('web/vercel/articles.json','utf8'))};
// Validate before any private upload. --blob uses the existing linked private store.
let result=compileSnapshot(snapshot,options);
if(mode&&mode!=='--blob')throw Error('Unknown import mode');
if(mode==='--blob'){await createSnapshotStore().upload(JSON.stringify(snapshot));const store=createContentStore(),contentObjects=[];for(const version of snapshot.records.article_versions)contentObjects.push({article_version_id:version.id,...await store.upload(version.content_json)});result=compileSnapshot(snapshot,{...options,contentObjects});}
await writeFile(target,result.sql,{flag:'wx',mode:0o600});
// Do not print SQL, bodies, evidence, private titles, or credentials.
console.log(JSON.stringify({sourceSha:result.sourceSha,counts:result.counts,publishedCount:result.published.length,privateCount:result.private.length,applied:false}));

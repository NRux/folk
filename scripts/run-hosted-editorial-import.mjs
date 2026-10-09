import {readFile,writeFile,realpath,stat} from 'node:fs/promises';
import {dirname,resolve,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {readImportContract,PROJECT_ID} from '../server/editorial-import.js';
import {validatedImportRecords} from './supabase-snapshot.mjs';

async function main(){
 const args=process.argv.slice(2);if(args.length!==3)throw Error('Usage: run-hosted-editorial-import.mjs <private-snapshot.json> <private-source-receipt.json> <new-private-readback-receipt.json>');
 const root=await realpath(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
 const privatePath=async(p,output=false)=>{
  const path=output?resolve(await realpath(dirname(resolve(p))),resolve(p).split(sep).at(-1)):await realpath(p);
  const rel=relative(root,path);
  if((rel!=='..'&&!rel.startsWith('..'+sep)&&!rel.startsWith(sep))||/(^|[\\/])(public|static|dist)([\\/]|$)/i.test(path))throw Error('Import inputs and receipts must be outside the repository and public directories');
  return path;
 };
 const output=await privatePath(args[2],true);
 try{await stat(output);throw Error('Readback receipt already exists');}catch(e){if(e.code!=='ENOENT')throw e;}
 const input=await privatePath(args[0]),sourceReceipt=await privatePath(args[1]);
 if((await stat(input)).size>2_000_000||(await stat(sourceReceipt)).size>100_000)throw Error('Private input too large');
 const snapshot=JSON.parse(await readFile(input,'utf8')),receipt=JSON.parse(await readFile(sourceReceipt,'utf8'));
 const contract=await readImportContract();
 const expected=validatedImportRecords(snapshot,{...contract,expectedSha:receipt.sha256,expectedCounts:receipt.counts});
 const body=JSON.stringify({snapshot,receipt});if(Buffer.byteLength(body)>2_000_000)throw Error('Private request too large');
 const config=await new Promise((resolve,reject)=>{
  let value='';const terminal=process.stdin.isTTY;
  if(terminal)process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');process.stderr.write('Ready for private import credential on stdin (input hidden).\n');
  const end=()=>{if(terminal)process.stdin.setRawMode(false);process.stdin.pause();process.stdin.removeListener('data',data);};
  const data=chunk=>{value+=chunk;if(value.includes('\u0003')||value.length>1024){end();reject(Error('Import credential input cancelled'));}else if(value.includes('\n')){end();try{resolve(JSON.parse(value));}catch{reject(Error('Invalid credential input'));}}};
  process.stdin.on('data',data);process.stdin.once('end',()=>{end();reject(Error('Missing credential input'));});
 });
 if(!/^[a-f0-9]{64}$/.test(config?.token||''))throw Error('Invalid scoped import credential');
 const response=await fetch('https://www.folkly.com/api/editorial-import',{method:'POST',redirect:'error',
  headers:{authorization:'Bearer '+config.token,'content-type':'application/json'},body,signal:AbortSignal.timeout(240000)});
 const text=await response.text();if(Buffer.byteLength(text)>100000)throw Error('Invalid import response');
 const result=JSON.parse(text);
 if(response.status!==200){const stage=['configuration','authorization','validation','claim','blob','commit','readback','receipt'].includes(result.stage)?result.stage:'unknown';throw Error('Hosted import HTTP '+response.status+'; stage='+stage);}
 const proof=result.receipt;
 const keys=['backupVerified','counts','format','mode','privateCount','projectId','publishedCount','sourceSha','sweeps','switchesPaused','verifiedAt','verifiedVersions'];
 if(!result.ok||!response.headers.get('cache-control')?.includes('no-store')||!proof||Object.keys(proof).sort().join()!==keys.join()||
  proof.projectId!==PROJECT_ID||proof.sourceSha!==snapshot.sha256||proof.format!=='folkly-import-readback-v1'||proof.mode!=='blob'||
  proof.backupVerified!==true||proof.switchesPaused!==true||proof.sweeps!==2||proof.verifiedVersions!==snapshot.records.article_versions.length||
  proof.publishedCount!==expected.published.length||proof.privateCount!==expected.private.length||!isDeepStrictEqual(proof.counts,receipt.counts)||
  !Number.isFinite(Date.parse(proof.verifiedAt)))throw Error('Invalid hosted readback receipt');
 await writeFile(output,JSON.stringify(proof,null,2)+'\n',{mode:0o600,flag:'wx'});
 console.log(JSON.stringify(proof));
}
main().catch(error=>{const safe=/^(Usage:|Import inputs|Readback receipt|Private input|Private request|Hosted import HTTP|Invalid hosted|Import credential|Invalid credential|Missing credential|Invalid scoped)/.test(error.message)?error.message:'Hosted import failed; inspect the private grant and deployed fixed-stage diagnostics. No automatic retry performed.';console.error(safe);process.exitCode=1;});

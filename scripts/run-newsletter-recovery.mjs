import {writeFile,realpath,stat} from 'node:fs/promises';
import {dirname,resolve,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {recoveryContract,RECOVERY_FORMAT,RECOVERY_PROJECT,RECOVERY_CHECKS} from '../server/newsletter-recovery.js';

async function main(){
 if(process.argv.length!==3)throw Error('Usage: run-newsletter-recovery.mjs <new-private-receipt.json>');
 const root=await realpath(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
 const candidate=resolve(process.argv[2]),output=resolve(await realpath(dirname(candidate)),candidate.split(sep).at(-1)),rel=relative(root,output);
 if((rel!=='..'&&!rel.startsWith('..'+sep)&&!rel.startsWith(sep))||/(^|[\\/])(public|static|dist)([\\/]|$)/i.test(output))throw Error('Receipt must be outside the repository and public directories');
 try{await stat(output);throw Error('Receipt already exists');}catch(error){if(error.code!=='ENOENT')throw error;}
 const contractSha=await recoveryContract();
 const token=await new Promise((resolve,reject)=>{
  let value='';const terminal=process.stdin.isTTY;if(terminal)process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');process.stderr.write('Ready for one-use recovery token on stdin (input hidden).\n');
  const end=()=>{if(terminal)process.stdin.setRawMode(false);process.stdin.pause();process.stdin.removeListener('data',data);};
  const data=chunk=>{value+=chunk;if(value.includes('\u0003')||value.length>256){end();reject(Error('Recovery token input cancelled'));}else if(value.includes('\n')){end();resolve(value.trim());}};
  process.stdin.on('data',data);process.stdin.once('end',()=>{end();reject(Error('Recovery token input missing'));});
 });
 if(!/^[a-f0-9]{64}$/.test(token))throw Error('Recovery token input invalid');
 const response=await fetch('https://www.folkly.com/api/newsletter-recovery',{method:'POST',redirect:'error',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({operation:RECOVERY_FORMAT}),signal:AbortSignal.timeout(175000)});
 const reader=response.body.getReader(),chunks=[];let length=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>10000)throw Error('Invalid recovery response');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 const result=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
 if(response.status!==200){const stage=['configuration','authorization','validation','claim','storage','receipt'].includes(result.stage)?result.stage:'unknown';throw Error('Hosted recovery HTTP '+response.status+'; stage='+stage);}
 const receipt=result.receipt,keys=['checks','contractSha','deliveryPaused','emailsSent','format','grantId','inventorySha','objects','projectId','switchesPaused','verifiedAt'];
 if(result.ok!==true||!response.headers.get('cache-control')?.includes('no-store')||!receipt||Object.keys(receipt).sort().join()!==keys.join()||
  receipt.format!==RECOVERY_FORMAT||receipt.projectId!==RECOVERY_PROJECT||receipt.contractSha!==contractSha||
  !isDeepStrictEqual(receipt.checks,Object.fromEntries(RECOVERY_CHECKS.map(name=>[name,true])))||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(receipt.grantId)||
  !/^[0-9a-f]{64}$/.test(receipt.inventorySha)||!Number.isSafeInteger(receipt.objects)||receipt.objects<1||receipt.objects>30||
  receipt.emailsSent!==0||receipt.deliveryPaused!==true||receipt.switchesPaused!==true||
  typeof receipt.verifiedAt!=='string'||!Number.isFinite(Date.parse(receipt.verifiedAt))||new Date(receipt.verifiedAt).toISOString()!==receipt.verifiedAt)throw Error('Invalid recovery response');
 await writeFile(output,JSON.stringify(receipt,null,2)+'\n',{mode:0o600,flag:'wx'});
 console.log(JSON.stringify(receipt));
}
main().catch(error=>{console.error(/^(Usage:|Receipt must|Receipt already|Recovery token|Hosted recovery HTTP|Invalid recovery response)/.test(error.message)?error.message:'Hosted recovery could not complete; inspect the private grant and fixed-stage diagnostics. No automatic retry.');process.exitCode=1;});

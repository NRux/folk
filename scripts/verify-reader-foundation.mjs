// Read-only production artifact checks. No owner session, signup or Google requests.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile),origin='https://www.folkly.com';
const evidence={checkedAt:new Date().toISOString(),implementationCommit:process.argv[2],origin,checks:[]};
assert.match(evidence.implementationCommit||'',/^[a-f0-9]{40}$/);
async function request(path){const {stdout}=await run('curl',['-sS','-L','--max-time','30','-w','\n%{http_code}',origin+path],{maxBuffer:2_000_000});const at=stdout.lastIndexOf('\n');return {status:Number(stdout.slice(at+1)),body:stdout.slice(0,at)};}
const assets=['article-release-registry.json','reader-events.js','privacy.js','subscribe.js','locales.css','language.js'];
for(const asset of assets){const r=await request('/'+asset);assert.equal(r.status,200,asset);assert.equal(r.body,await readFile('dist/'+asset,'utf8'),asset);evidence.checks.push({path:'/'+asset,status:r.status,exactBuildMatch:true});}
for(const path of ['/ar/lisbon-fado','/fr/lisbon-fado','/translation-manifest.json','/translation-glossary.json','/build/translation-contracts/lisbon-fado.json']){const r=await request(path);assert.equal(r.status,404,path);evidence.checks.push({path,status:r.status,unapprovedOrNonpublic:true});}
for(const path of ['/api/owner?view=subscribers','/api/owner?view=contacts']){const r=await request(path);assert.equal(r.status,401,path);evidence.checks.push({path,status:r.status,anonymousDenied:true});}
await writeFile('docs/verification/translation-reader-events-live-2026-10-09.json',JSON.stringify(evidence,null,2)+'\n');
console.log(`Reader foundation deployed checks passed: ${evidence.checks.length} exact assets, unpublished/private output denial and anonymous private API denial. No records written.`);

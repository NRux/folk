import assert from 'node:assert/strict';
import { readOwnerDashboard } from '../server/owner-dashboard.js';
const queried=[];
const db={from(name){const q={select(columns){queried.push({name,columns});return q;},order(){return q;},eq(){return q;},limit(limit){assert(limit<=25);return name==='folkly_jobs'?Promise.resolve({error:{message:'secret failure'}}):Promise.resolve({data:name==='folkly_model_budget'?[{daily_usd:0,job_usd:0}]:[]});}};return q;}};
const result=await readOwnerDashboard(db);
assert.equal(result.publicationLocked,true);
assert.equal(result.sections.jobs.available,false);
assert.equal(result.sections.articles.available,true);
assert.equal(result.sections.budget.rows[0].daily_usd,0);
assert(!JSON.stringify(result).includes('secret failure'));
assert(queried.every(q=>!/(content_json|error|evidence|email|secret|\*)/.test(q.columns)));
const outage=await readOwnerDashboard({from(){throw Error('credential details');}});
assert(Object.values(outage.sections).every(s=>!s.available));
assert(!JSON.stringify(outage).includes('credential details'));
console.log('Owner dashboard passed: bounded metadata only, no private source/error/credential payloads, partial outage distinguished from empty records, publishing locked.');

assert.equal(result.migration.state,'pending');assert.equal(outage.migration.state,'unavailable');
const importReceipt={format:'folkly-import-readback-v1',mode:'blob',backupVerified:true,sweeps:2,switchesPaused:true,counts:{articles:11,article_versions:15},verifiedVersions:15};
for(const [receipt,state] of [[importReceipt,'verified'],[{...importReceipt,backupVerified:false},'unavailable']]){
 const fixture={from(name){if(name!=='folkly_import_grants')return db.from(name);const q={select:()=>q,eq:()=>q,order:()=>q,limit:async()=>({data:[{receipt:{...receipt,privateText:'never-return-private'},completed_at:'2026-10-09T23:47:12Z'}]})};return q;}};
 const read=await readOwnerDashboard(fixture);assert.equal(read.migration.state,state);assert(!JSON.stringify(read).includes('never-return-private'));
 if(state==='verified')assert.match(read.migration.message,/11 stories and 15 saved versions/);
}
console.log('Import status passed: verified receipt counts, absent/outage distinction and private receipt-field redaction.');

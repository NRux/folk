import assert from 'node:assert/strict';
import {analyticsEvidence} from '../server/analytics.js';
const at=new Date('2026-10-08T04:00:00Z'),options={at,expectedPropertyId:'558035708'};
const snapshot={propertyId:'558035708',version:'page-daily-v1',startDate:'2026-09-08',endDate:'2026-10-05',report:{timeZone:'America/Los_Angeles',quality:[{thresholded:false,sampled:false,otherRows:false,truncated:false,emptyReason:null}],rows:Array.from({length:14},(_,i)=>({date:`2026-09-${String(i+8).padStart(2,'0')}`,path:'/lisbon-fado',views:10,engagementSeconds:100}))}};
const assess=change=>analyticsEvidence({...structuredClone(snapshot),...change},options);
let evidence=assess({});assert.equal(evidence.state,'descriptive_only');assert.equal(evidence.canPublish,false);assert.equal(evidence.articles[0].state,'observe_only');assert.equal(evidence.articles[1].observedDays,14);assert.equal(evidence.articles[1].engagementSecondsPerView,10);assert.equal(evidence.thresholds.heuristic,true);
assert.equal(analyticsEvidence(snapshot,{at}).state,'observe_only');
assert.equal(assess({propertyId:'123'}).state,'observe_only');
assert.equal(assess({endDate:'2026-10-04'}).state,'observe_only');
assert.equal(assess({endDate:'2026-10-06'}).state,'observe_only');
assert.equal(assess({startDate:'2026-09-31'}).state,'observe_only');
assert.equal(assess({version:'unknown'}).state,'observe_only');
const report=structuredClone(snapshot.report);report.rows=[{date:'2026-09-08',path:'/lisbon-fado',views:100000,engagementSeconds:1000}];assert.equal(assess({report}).state,'observe_only');
report.rows=Array.from({length:14},(_,i)=>({date:`2026-09-${i+10}`,path:i%2?'/lisbon-fado':'/detroit-future-frequency',views:100,engagementSeconds:1000}));assert.equal(assess({report}).state,'observe_only');
for(const mutation of [r=>r.rows.push({...r.rows[0]}),r=>r.rows[0].path='/owner?email=secret',r=>r.rows[0].views=NaN,r=>r.rows[0].engagementSeconds=Infinity,r=>r.rows[0].date='2026-09-31',r=>r.quality=[],r=>r.quality[0].sampled=true,r=>r.timeZone='invalid']){const r=structuredClone(snapshot.report);mutation(r);assert.equal(assess({report:r}).state,'observe_only');}
assert.throws(()=>analyticsEvidence(snapshot,{...options,minimumViews:1}),/thresholds/);assert.throws(()=>analyticsEvidence(snapshot,{...options,minimumDays:1}),/thresholds/);
console.log('Analytics evidence checks passed: article isolation, observation days, launch spike hold, stale/immature windows, property verification, invalid observations, quality, safe thresholds, no publication. Synthetic only.');

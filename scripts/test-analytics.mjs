import assert from 'node:assert/strict';
import {collectAnalytics,canonicalArticlePath,analyticsWindow,analyticsEvidence,analyticsClient,PUBLIC_ARTICLES} from '../server/analytics.js';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
assert.equal(canonicalArticlePath('/lisbon-fado.html?email=secret'),'/lisbon-fado');assert.equal(canonicalArticlePath('/owner'),null);
assert.deepEqual(analyticsWindow(new Date('2026-10-08T04:00:00Z'),'America/Los_Angeles'),{startDate:'2026-09-08',endDate:'2026-10-05'});
assert.equal((await collectAnalytics({env:{},tokenProvider:()=>{throw Error('must not call');}})).state,'paused');assert.throws(()=>analyticsClient({}),/missing/);
const env={FOLKLY_ANALYTICS_ENABLED:'true',GA4_PROPERTY_ID:'123456',GA4_TIME_ZONE:'America/Los_Angeles'};let saved,calls=0;
const report={dimensionHeaders:[{name:'date'},{name:'pagePath'}],metricHeaders:[{name:'screenPageViews'},{name:'userEngagementDuration'}],rowCount:2,metadata:{timeZone:env.GA4_TIME_ZONE},rows:[{dimensionValues:[{value:'20261001'},{value:'/lisbon-fado'}],metricValues:[{value:'50'},{value:'500'}]},{dimensionValues:[{value:'20261001'},{value:'/lisbon-fado.html'}],metricValues:[{value:'60'},{value:'600'}]}]};
const fetcher=async(url,args)=>{calls++;assert(url.startsWith('https://analyticsdata.googleapis.com/v1beta/properties/123456:'));assert.equal(args.redirect,'error');return Response.json(url.endsWith('checkCompatibility')?{dimensionCompatibilities:['date','pagePath'].map(apiName=>({dimensionMetadata:{apiName},compatibility:'COMPATIBLE'})),metricCompatibilities:['screenPageViews','userEngagementDuration'].map(apiName=>({metricMetadata:{apiName},compatibility:'COMPATIBLE'}))}:report);};
const params={env,at:new Date('2026-10-08T04:00:00Z'),tokenProvider:async args=>{assert(args.scope.endsWith('analytics.readonly'));return 'fixture-secret';},fetcher,client:{rpc:async(name,args)=>{assert.equal(name,'folkly_save_analytics_snapshot');saved=args.snapshot;return {data:true};}}};
assert.equal((await collectAnalytics(params)).rows,1);assert.equal(saved.report.rows[0].views,110);assert(!JSON.stringify(saved).includes('fixture-secret'));assert.equal(analyticsEvidence(saved).canPublish,false);
await assert.rejects(collectAnalytics({...params,env:{...env,GA4_PROPERTY_ID:'G-RQJD3XG35C'}}),/property/);
await assert.rejects(collectAnalytics({...params,fetcher:async()=>new Response('secret failure',{status:403})}),/failed \(403\)/);
await assert.rejects(collectAnalytics({...params,client:{rpc:async()=>({data:false})}}),/not persisted/);
await assert.rejects(collectAnalytics({...params,tokenProvider:async()=>{throw Error('secret credentials');}}),/^Error: GA4 authentication unavailable$/);
await assert.rejects(collectAnalytics({...params,fetcher:async()=>Response.json({dimensionCompatibilities:[],metricCompatibilities:[]})}),/incompatible/);
// Invalid dates and repeated raw cells must never become apparently valid totals.
for(const mutate of [r=>r.rows[0].dimensionValues[0].value='20260931',r=>r.rows[1]=structuredClone(r.rows[0]),r=>r.rows[0].metricValues[0].value='',r=>r.rows[0].dimensionValues[1].value='/lisbon-fado?email=private']){
 const bad=structuredClone(report);mutate(bad);let writes=0;
 await assert.rejects(collectAnalytics({...params,fetcher:async url=>url.endsWith('checkCompatibility')?fetcher(url,{redirect:'error'}):Response.json(bad),client:{rpc:async()=>{writes++;return {data:true};}}}),/Invalid|Duplicate/);
 assert.equal(writes,0);
}
// Alias rows may legitimately span pages; exact raw cells may not repeat.
const baseline=structuredClone(report),compatibility={dimensionCompatibilities:['date','pagePath'].map(apiName=>({dimensionMetadata:{apiName},compatibility:'COMPATIBLE'})),metricCompatibilities:['screenPageViews','userEngagementDuration'].map(apiName=>({metricMetadata:{apiName},compatibility:'COMPATIBLE'}))};
async function pagesFixture(pages,expectedFailure){
 let page=0,writes=0,receipt;
 const run=()=>collectAnalytics({...params,fetcher:async(url,args)=>{
  if(url.endsWith('checkCompatibility'))return Response.json(compatibility);
  const request=JSON.parse(args.body);assert.equal(request.offset,String(page));assert.equal(request.returnPropertyQuota,true);assert(!request.dimensionFilter.andGroup.expressions[1].filter.inListFilter.values.includes('/owner'));
  return Response.json(pages[page++]);
 },client:{rpc:async(name,args)=>{writes++;receipt=args.snapshot;return {data:true};}}});
 if(expectedFailure){await assert.rejects(run,expectedFailure);assert.equal(writes,0);}else{await run();assert.equal(writes,1);}
 return {page,receipt};
}
const split=baseline.rows.map(row=>({...baseline,rows:[row]}));
let paged=await pagesFixture(split);assert.equal(paged.page,2);assert.equal(paged.receipt.report.rows[0].views,110);
await pagesFixture([split[0],split[0]],/Duplicate/);
await pagesFixture([split[0],{...split[1],rowCount:3}],/changed/);
await pagesFixture([split[0],{...split[1],rows:[]}],/incomplete/);
await pagesFixture([split[1],split[0]],/order/);
await pagesFixture([{...baseline,rowCount:617}],/bound/);
const quotaFirst={...split[0],propertyQuota:{tokensPerHour:{consumed:10,remaining:0}}};
assert.equal((await pagesFixture([quotaFirst,split[1]],/quota exhausted/)).page,1);
paged=await pagesFixture([split[0],{...split[1],propertyQuota:{tokensPerHour:{consumed:10,remaining:0},unknown:{private:'must not persist'}}}]);
assert.deepEqual(paged.receipt.report.quotas,[null,{tokensPerHour:{consumed:10,remaining:0}}]);
assert(!JSON.stringify(paged.receipt).includes('must not persist'));
await pagesFixture([{...baseline,propertyQuota:{tokensPerDay:{remaining:-1}}}],/quota evidence/);
for(const mutate of [r=>r.rows[0].dimensionValues.push({value:'unknown'}),r=>r.rows[0].dimensionValues[0].value=20261001,r=>r.rows[0].metricValues[0].value='0x10',r=>r.rows[0].metricValues[1].value='Infinity',r=>r.rows[0].metricValues[0].value=' ',r=>r.rows[0].metricValues[1].value=null]){const invalid=structuredClone(baseline);mutate(invalid);await pagesFixture([invalid],/Invalid/);}
// 429 carries a bounded retry hint but never triggers an automatic second attempt.
let attempts=0,persists=0;
await assert.rejects(collectAnalytics({...params,fetcher:async url=>{if(url.endsWith('checkCompatibility'))return Response.json(compatibility);attempts++;return new Response('fixture-secret',{status:429,headers:{'Retry-After':'60'}});},client:{rpc:async()=>{persists++;return {data:true};}}}),error=>error.message==='GA4 report request failed (429)'&&error.retryAfterSeconds===60);
assert.equal(attempts,1);assert.equal(persists,0);
// Oversize streaming data is canceled before the whole response is buffered.
let canceled=false;
await assert.rejects(collectAnalytics({...params,fetcher:async()=>new Response(new ReadableStream({start(controller){for(let i=0;i<3;i++)controller.enqueue(new Uint8Array(512000));},cancel(){canceled=true;}})),client:{rpc:async()=>{throw Error('must not persist');}}}),/exceeds bound/);assert(canceled);
for(const response of [()=>new Response('null'),()=>new Response('[]'),()=>new Response(new Uint8Array([123,34,120,34,58,34,255,34,125]))])await assert.rejects(collectAnalytics({...params,fetcher:async()=>response()}),/Invalid GA4 report response/);
await assert.rejects(collectAnalytics({...params,fetcher:async()=>new Response(new ReadableStream({start(controller){controller.error(Error('fixture-secret'));}}))}),/^Error: GA4 report request unavailable$/);
paged=await pagesFixture([{...baseline,rowCount:0,rows:[]}]);assert.equal(paged.receipt.report.rows.length,0);assert.equal(analyticsEvidence(paged.receipt).state,'observe_only');
const publicCatalog=JSON.parse(await readFile('web/vercel/articles.json','utf8')).filter(a=>a.status==='published').map(a=>a.slug).sort();assert.deepEqual([...PUBLIC_ARTICLES].sort(),publicCatalog);
report.metadata.subjectToThresholding=true;await collectAnalytics(params);assert.equal(analyticsEvidence(saved).state,'observe_only');
report.metadata.timeZone='UTC';await assert.rejects(collectAnalytics(params),/timezone/);
const db=new PGlite();try{
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE ROLE folkly_publisher; CREATE ROLE authenticator; CREATE SCHEMA auth; CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;`);
 await db.exec(await readFile('supabase/migrations/20261008043058_analytics_snapshots.sql','utf8'));
 const persist=async()=> (await db.query('select public.folkly_save_analytics_snapshot($1::jsonb) as saved',[JSON.stringify(saved)])).rows[0].saved;
 await db.exec(`SET ROLE folkly_analytics; SET request.jwt.claims='{"role":"folkly_analytics"}';`);assert.equal(await persist(),false);
 await assert.rejects(db.query('select * from public.folkly_analytics_snapshots'),/permission denied/);
 await db.exec(`RESET ROLE; UPDATE public.folkly_analytics_config SET enabled=true,property_id='123456'; SET ROLE folkly_analytics;`);assert.equal(await persist(),true);assert.equal(await persist(),true);
 await db.exec('RESET ROLE');assert.equal((await db.query('select count(*)::int as n from public.folkly_analytics_snapshots')).rows[0].n,1);
 for(const role of ['anon','authenticated','folkly_publisher','service_role']){await db.exec(`RESET ROLE; SET ROLE ${role};`);await assert.rejects(persist(),/permission denied/);}
}finally{await db.close();}
console.log('GA4 foundation passed: paused guard, numeric property, read-only requests, safe paths, additive normalization, quality flags, bounded failures, scoped storage, disabled config and idempotent snapshots. Cross-page duplicate/order/count/quota failures cannot persist partial totals; strict dates/metrics/path/UTF-8 and streaming body cancellation pass. No live Google calls.');

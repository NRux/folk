import assert from 'node:assert/strict';
import {collectAnalytics,canonicalArticlePath,analyticsWindow,analyticsEvidence,analyticsClient} from '../server/analytics.js';
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
console.log('GA4 foundation passed: paused guard, numeric property, read-only requests, safe paths, additive normalization, quality flags, bounded failures, scoped storage, disabled config and idempotent snapshots. No live Google calls.');

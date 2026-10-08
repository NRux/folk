import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
export const PUBLIC_ARTICLES=['new-orleans-second-line','lisbon-fado','oaxaca-living-color','detroit-future-frequency'];
const paths=PUBLIC_ARTICLES.flatMap(slug=>['/'+slug,'/'+slug+'.html']);
export function canonicalArticlePath(value) {
  if(typeof value!=='string')return null;
  const clean=value.split(/[?#]/)[0].replace(/\.html$/,'');
  return PUBLIC_ARTICLES.includes(clean.slice(1))?clean:null;
}
export function analyticsWindow(at,timeZone) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(at).map(x=>[x.type,x.value]));
  const today=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day));
  const iso=delta=>new Date(today-delta*86400000).toISOString().slice(0,10);
  return {startDate:iso(29),endDate:iso(2)};
}
export function analyticsClient(env=process.env,factory=createClient) {
  if(!env.SUPABASE_ANALYTICS_TOKEN||!env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_URL!=='https://vxmyggasjgsiohqzzwzh.supabase.co')throw Error('Scoped analytics configuration missing');
  let claims;try{claims=JSON.parse(Buffer.from(env.SUPABASE_ANALYTICS_TOKEN.split('.')[1],'base64url').toString());}catch{throw Error('Invalid analytics credential');}
  if(claims.role!=='folkly_analytics'||!Number.isFinite(claims.exp)||claims.exp<=Date.now()/1000)throw Error('Scoped analytics credential required');
  return factory(env.SUPABASE_URL,env.SUPABASE_PUBLISHABLE_KEY,{global:{headers:{Authorization:`Bearer ${env.SUPABASE_ANALYTICS_TOKEN}`}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
export async function collectAnalytics({env=process.env,tokenProvider,client,fetcher=fetch,at=new Date()}) {
  if(env.FOLKLY_ANALYTICS_ENABLED!=='true')return {state:'paused'};
  if(!/^[0-9]{1,20}$/.test(env.GA4_PROPERTY_ID||'')||!env.GA4_TIME_ZONE||typeof tokenProvider!=='function')throw Error('GA4 property, timezone and read-only authentication required');
  const window=analyticsWindow(at,env.GA4_TIME_ZONE);
  let token;try{token=await tokenProvider({scope:'https://www.googleapis.com/auth/analytics.readonly'});}catch{throw Error('GA4 authentication unavailable');}
  if(typeof token!=='string'||!token||token.length>8192)throw Error('GA4 authentication unavailable');
  const base=`https://analyticsdata.googleapis.com/v1beta/properties/${env.GA4_PROPERTY_ID}`;
  const request={dimensions:[{name:'date'},{name:'pagePath'}],metrics:[{name:'screenPageViews'},{name:'userEngagementDuration'}],dimensionFilter:{andGroup:{expressions:[{filter:{fieldName:'hostName',inListFilter:{values:['www.folkly.com','folkly.com']}}},{filter:{fieldName:'pagePath',inListFilter:{values:paths}}}]}}};
  async function post(method,body) {
    let response;try{response=await fetcher(base+':'+method,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000),redirect:'error'});}catch{throw Error('GA4 report request unavailable');}
    if(!response.ok)throw Error(`GA4 report request failed (${response.status})`);
    const text=await response.text();if(Buffer.byteLength(text)>1000000)throw Error('GA4 report exceeds bound');
    try{return JSON.parse(text);}catch{throw Error('Invalid GA4 report response');}
  }
  const compatible=await post('checkCompatibility',{...request,compatibilityFilter:'COMPATIBLE'});
  if(!request.dimensions.every(d=>compatible.dimensionCompatibilities?.some(x=>x.dimensionMetadata?.apiName===d.name&&x.compatibility==='COMPATIBLE'))||!request.metrics.every(m=>compatible.metricCompatibilities?.some(x=>x.metricMetadata?.apiName===m.name&&x.compatibility==='COMPATIBLE')))throw Error('GA4 report dimensions/metrics incompatible');
  const records=new Map(),quality=[],hashes=[];let offset=0,expected;
  for(let page=0;page<5;page++) {
    const report=await post('runReport',{...request,dateRanges:[window],offset:String(offset),limit:'2000',orderBys:[{dimension:{dimensionName:'date'}},{dimension:{dimensionName:'pagePath'}}],returnPropertyQuota:true});
    hashes.push(createHash('sha256').update(JSON.stringify(report)).digest('hex'));
    if(report.metadata?.timeZone!==env.GA4_TIME_ZONE)throw Error('GA4 property timezone mismatch');
    if(JSON.stringify(report.dimensionHeaders?.map(x=>x.name))!==JSON.stringify(['date','pagePath'])||JSON.stringify(report.metricHeaders?.map(x=>x.name))!==JSON.stringify(['screenPageViews','userEngagementDuration']))throw Error('Unexpected GA4 report columns');
    if(!Number.isSafeInteger(report.rowCount)||report.rowCount<0||report.rowCount>10000||(expected!==undefined&&expected!==report.rowCount))throw Error('GA4 report changed or exceeds bound');expected=report.rowCount;
    quality.push({thresholded:!!report.metadata.subjectToThresholding,sampled:!!report.metadata.samplingMetadatas?.length,otherRows:!!report.metadata.dataLossFromOtherRow,truncated:!!report.metadata.dataTruncationReasons?.length,emptyReason:report.metadata.emptyReason||null});
    if(!Array.isArray(report.rows)&&report.rowCount!==0)throw Error('GA4 report rows missing');
    const rows=report.rows||[];if(rows.length>2000||(!rows.length&&offset<expected))throw Error('GA4 pagination incomplete');
    for(const row of rows){
      const rawDate=row.dimensionValues?.[0]?.value,path=canonicalArticlePath(row.dimensionValues?.[1]?.value),values=row.metricValues?.map(v=>Number(v.value));
      const date=/^\d{8}$/.test(rawDate||'')?`${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6,8)}`:'';
      if(!path||date<window.startDate||date>window.endDate||values?.length!==2||!Number.isSafeInteger(values[0])||values[0]<0||!Number.isFinite(values[1])||values[1]<0)throw Error('Invalid GA4 report row');
      const key=date+path,prior=records.get(key)||{date,path,views:0,engagementSeconds:0};prior.views+=values[0];prior.engagementSeconds+=values[1];if(!Number.isSafeInteger(prior.views)||!Number.isFinite(prior.engagementSeconds))throw Error('GA4 aggregate exceeds bound');records.set(key,prior);
    }
    offset+=rows.length;if(offset===expected)break;if(offset>expected||page===4)throw Error('GA4 pagination incomplete');
  }
  const snapshot={propertyId:env.GA4_PROPERTY_ID,...window,version:'page-daily-v1',hash:createHash('sha256').update(JSON.stringify(hashes)).digest('hex'),report:{timeZone:env.GA4_TIME_ZONE,rows:[...records.values()],quality}};
  const db=client||analyticsClient(env);const saved=await db.rpc('folkly_save_analytics_snapshot',{snapshot});
  if(saved.error||saved.data!==true)throw Error('Analytics snapshot not persisted; collection disabled or unavailable');
  return {state:'collected',rows:snapshot.report.rows.length,startDate:window.startDate,endDate:window.endDate};
}
export function analyticsEvidence(snapshot,{minimumViews=100}={}) {
  const reasons=[];
  if(!snapshot?.report?.rows?.length)reasons.push('No observed article data');
  if(snapshot?.report?.quality?.some(q=>q.thresholded||q.sampled||q.otherRows||q.truncated||q.emptyReason))reasons.push('Incomplete or qualified report');
  const rows=snapshot?.report?.rows||[],views=rows.reduce((n,r)=>n+r.views,0);
  if(views<minimumViews)reasons.push('Insufficient exposure');
  return {state:reasons.length?'observe_only':'descriptive_only',views,reasons,canPublish:false,note:'Aggregate observations do not establish causal effects or authorize revisions.'};
}

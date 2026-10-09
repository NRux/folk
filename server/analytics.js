import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
export const PUBLIC_ARTICLES=['new-orleans-second-line','lisbon-fado','oaxaca-living-color','detroit-future-frequency','bonwire-kente','castells-tarragona','kimjang-seoul','matariki-puanga','nowruz-tajikistan','tokushima-aizome','xochimilco-chinampas'];
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
const MAX_REPORT_BYTES=1000000;
const QUOTA_FIELDS=['tokensPerDay','tokensPerHour','tokensPerProjectPerHour','concurrentRequests','serverErrorsPerProjectPerHour','potentiallyThresholdedRequestsPerHour'];
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HEX=/^[a-f0-9]{64}$/;
const REPORT_VERSION='page-daily-v1';
export function analyticsLedger(db) {
  return {
    async claim({jobId,propertyId,window}) {
      const {data,error}=await db.rpc('folkly_claim_analytics_run',{job_key:jobId,analytics_property:propertyId,first_day:window.startDate,last_day:window.endDate,query_version:REPORT_VERSION});
      if(error||!data||typeof data!=='object')throw Error('Analytics run claim unavailable');
      return data;
    },
    async checkpoint({jobId,leaseToken,digest,value}) {
      const {data,error}=await db.rpc('folkly_checkpoint_analytics_run',{job_key:jobId,lease_token:leaseToken,checkpoint_digest:digest,checkpoint_value:value});
      if(error||data!==true)throw Error('Analytics checkpoint unavailable');
    },
    async finish({jobId,leaseToken,digest,snapshot}) {
      const {data,error}=await db.rpc('folkly_finish_analytics_run',{job_key:jobId,lease_token:leaseToken,checkpoint_digest:digest,snapshot});
      if(error||data!==true)throw Error('Analytics snapshot not persisted; collection disabled or unavailable');
    },
    async fail({jobId,leaseToken,failure,retryAfterSeconds}) {
      const {data,error}=await db.rpc('folkly_fail_analytics_run',{job_key:jobId,lease_token:leaseToken,failure,retry_seconds:retryAfterSeconds??null});
      if(error||data!==true)throw Error('Analytics failure evidence unavailable');
    }
  };
}
function quotaEvidence(value) {
  if(value===undefined)return null;
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid GA4 quota evidence');
  const result={};
  for(const field of QUOTA_FIELDS)if(Object.hasOwn(value,field)){
    const status=value[field];if(!status||typeof status!=='object'||Array.isArray(status))throw Error('Invalid GA4 quota evidence');
    const normalized={};for(const key of ['consumed','remaining'])if(Object.hasOwn(status,key)){
      if(!Number.isSafeInteger(status[key])||status[key]<0)throw Error('Invalid GA4 quota evidence');normalized[key]=status[key];
    }
    result[field]=normalized;
  }
  return result;
}
async function readReport(response) {
  if(Number(response.headers?.get('content-length'))>MAX_REPORT_BYTES){await response.body?.cancel().catch(()=>{});throw Error('GA4 report exceeds bound');}
  const reader=response.body?.getReader();if(!reader)throw Error('Invalid GA4 report response');
  const chunks=[];let size=0;
  try {
    while(true){let part;try{part=await reader.read();}catch{throw Error('GA4 report request unavailable');}
      if(part.done)break;size+=part.value.byteLength;
      if(size>MAX_REPORT_BYTES){await reader.cancel().catch(()=>{});throw Error('GA4 report exceeds bound');}chunks.push(part.value);
    }
  }finally{reader.releaseLock();}
  let report;try{report=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}catch{throw Error('Invalid GA4 report response');}
  if(!report||typeof report!=='object'||Array.isArray(report))throw Error('Invalid GA4 report response');return report;
}
function analyticsFailure(error) {
  if(error?.message==='GA4 authentication unavailable')return {failure:'auth_unavailable',retryAfterSeconds:300};
  if(error?.message==='GA4 report request unavailable')return {failure:'request_unavailable',retryAfterSeconds:300};
  if(error?.message==='GA4 report request failed (429)')return {failure:'rate_limited',retryAfterSeconds:error.retryAfterSeconds||300};
  if(error?.message?.startsWith('GA4 report request failed (5'))return {failure:'request_unavailable',retryAfterSeconds:300};
  if(error?.message?.includes('quota exhausted'))return {failure:'quota_exhausted',retryAfterSeconds:3600};
  if(error?.message?.includes('incompatible'))return {failure:'incompatible'};
  if(error?.message?.includes('timezone mismatch'))return {failure:'property_mismatch'};
  if(error?.message?.includes('checkpoint')||error?.message?.includes('persisted'))return {failure:'persistence_unavailable',retryAfterSeconds:300};
  return {failure:'invalid_report'};
}
function checkpointDigest(value){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
function restoreCheckpoint(value,{propertyId,window,maximumRows}) {
  if(value===null||value===undefined)return {rows:[],quality:[],quotas:[],hashes:[],expected:undefined,previousKey:undefined};
  if(!value||typeof value!=='object'||Array.isArray(value)||value.format!=='folkly-ga4-checkpoint-v1'||value.propertyId!==propertyId||value.startDate!==window.startDate||value.endDate!==window.endDate||value.version!==REPORT_VERSION||!Number.isSafeInteger(value.nextOffset)||!Number.isSafeInteger(value.expectedRows)||value.nextOffset<0||value.nextOffset>value.expectedRows||value.expectedRows>Math.min(10000,maximumRows)||!Array.isArray(value.rows)||value.rows.length!==value.nextOffset||!Array.isArray(value.quality)||!Array.isArray(value.quotas)||!Array.isArray(value.responseHashes)||value.quality.length>5||value.quotas.length!==value.quality.length||value.responseHashes.length!==value.quality.length||Buffer.byteLength(JSON.stringify(value))>MAX_REPORT_BYTES)throw Error('Invalid analytics checkpoint');
  const seen=new Set();let previousKey;
  for(const row of value.rows){
    if(!row||typeof row!=='object'||Array.isArray(row)||typeof row.rawDate!=='string'||typeof row.rawPath!=='string'||typeof row.date!=='string'||typeof row.path!=='string'||!Number.isSafeInteger(row.views)||row.views<0||!Number.isFinite(row.engagementSeconds)||row.engagementSeconds<0)throw Error('Invalid analytics checkpoint');
    const date=/^\d{8}$/.test(row.rawDate)?`${row.rawDate.slice(0,4)}-${row.rawDate.slice(4,6)}-${row.rawDate.slice(6,8)}`:'';
    const key=row.rawDate+'|'+row.rawPath;
    if(date!==row.date||canonicalArticlePath(row.rawPath)!==row.path||!paths.includes(row.rawPath)||civilDate(row.date)===null||row.date<window.startDate||row.date>window.endDate||seen.has(key)||(previousKey!==undefined&&key<previousKey))throw Error('Invalid analytics checkpoint');
    seen.add(key);previousKey=key;
  }
  for(const hash of value.responseHashes)if(typeof hash!=='string'||!HEX.test(hash))throw Error('Invalid analytics checkpoint');
  for(const q of value.quotas)quotaEvidence(q===null?undefined:q);
  for(const q of value.quality)if(!q||typeof q!=='object'||Array.isArray(q)||typeof q.thresholded!=='boolean'||typeof q.sampled!=='boolean'||typeof q.otherRows!=='boolean'||typeof q.truncated!=='boolean'||!(q.emptyReason===null||typeof q.emptyReason==='string'))throw Error('Invalid analytics checkpoint');
  return {rows:value.rows.map(row=>({...row})),quality:value.quality.map(row=>({...row})),quotas:value.quotas.map(row=>row===null?null:structuredClone(row)),hashes:[...value.responseHashes],expected:value.expectedRows,previousKey};
}
export async function collectAnalytics({env=process.env,tokenProvider,client,ledger,jobId,fetcher=fetch,at=new Date()}) {
  if(env.FOLKLY_ANALYTICS_ENABLED!=='true')return {state:'paused'};
  if(!UUID.test(jobId||'')||!/^[0-9]{1,20}$/.test(env.GA4_PROPERTY_ID||'')||!env.GA4_TIME_ZONE||typeof tokenProvider!=='function')throw Error('GA4 job, property, timezone and read-only authentication required');
  const window=analyticsWindow(at,env.GA4_TIME_ZONE);
  const runLedger=ledger||analyticsLedger(client||analyticsClient(env));
  const claim=await runLedger.claim({jobId,propertyId:env.GA4_PROPERTY_ID,window});
  if(claim.state==='completed')return {state:'already_collected',hash:claim.snapshotHash};
  if(['paused','busy','backoff','held'].includes(claim.state))return {state:claim.state};
  if(claim.state!=='claimed'||!UUID.test(claim.leaseToken||''))throw Error('Invalid analytics run claim');
  const leaseToken=claim.leaseToken;
  let token;
  try{token=await tokenProvider({scope:'https://www.googleapis.com/auth/analytics.readonly'});}catch{const error=Error('GA4 authentication unavailable');await runLedger.fail({jobId,leaseToken,...analyticsFailure(error)}).catch(()=>{});throw error;}
  if(typeof token!=='string'||!token||token.length>8192){const error=Error('GA4 authentication unavailable');await runLedger.fail({jobId,leaseToken,...analyticsFailure(error)}).catch(()=>{});throw error;}
  const base=`https://analyticsdata.googleapis.com/v1beta/properties/${env.GA4_PROPERTY_ID}`;
  const request={dimensions:[{name:'date'},{name:'pagePath'}],metrics:[{name:'screenPageViews'},{name:'userEngagementDuration'}],dimensionFilter:{andGroup:{expressions:[{filter:{fieldName:'hostName',inListFilter:{values:['www.folkly.com','folkly.com']}}},{filter:{fieldName:'pagePath',inListFilter:{values:paths}}}]}}};
  async function post(method,body) {
    let response;try{response=await fetcher(base+':'+method,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000),redirect:'error'});}catch{throw Error('GA4 report request unavailable');}
    if(!response.ok){const error=Error(`GA4 report request failed (${response.status})`);const retry=response.headers?.get('retry-after');
      if(response.status===429&&/^\d{1,5}$/.test(retry||'')&&Number(retry)<=86400)error.retryAfterSeconds=Number(retry);
      throw error;
    }
    return readReport(response);
  }
  const maximumRows=paths.length*((Date.parse(window.endDate)-Date.parse(window.startDate))/86400000+1);
  let restored;
  try{restored=restoreCheckpoint(claim.checkpoint,{propertyId:env.GA4_PROPERTY_ID,window,maximumRows});}
  catch(error){await runLedger.fail({jobId,leaseToken,...analyticsFailure(error)}).catch(()=>{});throw error;}
  const records=new Map(),seen=new Set(),checkpointRows=restored.rows,quality=restored.quality,quotas=restored.quotas,hashes=restored.hashes;
  let offset=checkpointRows.length,expected=restored.expected,previousKey=restored.previousKey,lastDigest=claim.checkpoint?checkpointDigest(claim.checkpoint):undefined;
  for(const row of checkpointRows){const rawKey=row.rawDate+'|'+row.rawPath;seen.add(rawKey);const key=row.date+row.path,prior=records.get(key)||{date:row.date,path:row.path,views:0,engagementSeconds:0};prior.views+=row.views;prior.engagementSeconds+=row.engagementSeconds;if(!Number.isSafeInteger(prior.views)||!Number.isFinite(prior.engagementSeconds))throw Error('Analytics checkpoint aggregate exceeds bound');records.set(key,prior);}
  try {
   const compatible=await post('checkCompatibility',{...request,compatibilityFilter:'COMPATIBLE'});
   if(!Array.isArray(compatible.dimensionCompatibilities)||!Array.isArray(compatible.metricCompatibilities)||!request.dimensions.every(d=>compatible.dimensionCompatibilities?.some(x=>x.dimensionMetadata?.apiName===d.name&&x.compatibility==='COMPATIBLE'))||!request.metrics.every(m=>compatible.metricCompatibilities?.some(x=>x.metricMetadata?.apiName===m.name&&x.compatibility==='COMPATIBLE')))throw Error('GA4 report dimensions/metrics incompatible');
   for(let page=quality.length;offset!==expected&&page<5;page++) {
    const report=await post('runReport',{...request,dateRanges:[window],offset:String(offset),limit:'2000',orderBys:[{dimension:{dimensionName:'date'}},{dimension:{dimensionName:'pagePath'}}],returnPropertyQuota:true});
    hashes.push(createHash('sha256').update(JSON.stringify(report)).digest('hex'));
    if(report.metadata?.timeZone!==env.GA4_TIME_ZONE)throw Error('GA4 property timezone mismatch');
    if(!Array.isArray(report.dimensionHeaders)||!Array.isArray(report.metricHeaders)||JSON.stringify(report.dimensionHeaders?.map(x=>x.name))!==JSON.stringify(['date','pagePath'])||JSON.stringify(report.metricHeaders?.map(x=>x.name))!==JSON.stringify(['screenPageViews','userEngagementDuration']))throw Error('Unexpected GA4 report columns');
    if(!Number.isSafeInteger(report.rowCount)||report.rowCount<0||report.rowCount>Math.min(10000,maximumRows)||(expected!==undefined&&expected!==report.rowCount))throw Error('GA4 report changed or exceeds bound');expected=report.rowCount;
    const quota=quotaEvidence(report.propertyQuota);quotas.push(quota);
    quality.push({thresholded:!!report.metadata.subjectToThresholding,sampled:!!report.metadata.samplingMetadatas?.length,otherRows:!!report.metadata.dataLossFromOtherRow,truncated:!!report.metadata.dataTruncationReasons?.length,emptyReason:report.metadata.emptyReason||null});
    if(!Array.isArray(report.rows)&&report.rowCount!==0)throw Error('GA4 report rows missing');
    const rows=report.rows||[];if(rows.length>2000||(!rows.length&&offset<expected))throw Error('GA4 pagination incomplete');
    for(const row of rows){
      if(!Array.isArray(row?.dimensionValues)||row.dimensionValues.length!==2||!Array.isArray(row.metricValues)||row.metricValues.length!==2)throw Error('Invalid GA4 report row');
      const rawDate=row.dimensionValues[0]?.value,rawPath=row.dimensionValues[1]?.value,path=canonicalArticlePath(rawPath),rawValues=row.metricValues.map(v=>v?.value);
      if(typeof rawValues[0]!=='string'||!/^(?:0|[1-9]\d*)$/.test(rawValues[0])||typeof rawValues[1]!=='string'||!/^(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(rawValues[1]))throw Error('Invalid GA4 report metrics');
      const values=rawValues.map(Number);
      if(typeof rawDate!=='string'||typeof rawPath!=='string')throw Error('Invalid GA4 report row');
      const date=/^\d{8}$/.test(rawDate||'')?`${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6,8)}`:'';
      if(!path||!paths.includes(rawPath)||civilDate(date)===null||date<window.startDate||date>window.endDate||values?.length!==2||!Number.isSafeInteger(values[0])||values[0]<0||!Number.isFinite(values[1])||values[1]<0)throw Error('Invalid GA4 report row');
      const rawKey=rawDate+'|'+rawPath;if(seen.has(rawKey))throw Error('Duplicate GA4 report row');
      if(previousKey!==undefined&&rawKey<previousKey)throw Error('Invalid GA4 report order');seen.add(rawKey);previousKey=rawKey;
      const key=date+path,prior=records.get(key)||{date,path,views:0,engagementSeconds:0};prior.views+=values[0];prior.engagementSeconds+=values[1];if(!Number.isSafeInteger(prior.views)||!Number.isFinite(prior.engagementSeconds))throw Error('GA4 aggregate exceeds bound');records.set(key,prior);
      checkpointRows.push({rawDate,rawPath,date,path,views:values[0],engagementSeconds:values[1]});
    }
    offset+=rows.length;
    const checkpoint={format:'folkly-ga4-checkpoint-v1',propertyId:env.GA4_PROPERTY_ID,...window,version:REPORT_VERSION,nextOffset:offset,expectedRows:expected,rows:checkpointRows,quality,quotas,responseHashes:hashes};
    lastDigest=checkpointDigest(checkpoint);await runLedger.checkpoint({jobId,leaseToken,digest:lastDigest,value:checkpoint});
    if(offset===expected)break;if(offset>expected||page===4)throw Error('GA4 pagination incomplete');
    if(['tokensPerDay','tokensPerHour','tokensPerProjectPerHour','serverErrorsPerProjectPerHour'].some(field=>quota?.[field]?.remaining===0))throw Error('GA4 quota exhausted; incomplete report not persisted');
   }
   const snapshot={propertyId:env.GA4_PROPERTY_ID,...window,version:REPORT_VERSION,hash:createHash('sha256').update(JSON.stringify(hashes)).digest('hex'),report:{timeZone:env.GA4_TIME_ZONE,rows:[...records.values()],quality,quotas}};
   await runLedger.finish({jobId,leaseToken,digest:lastDigest,snapshot});
   return {state:'collected',rows:snapshot.report.rows.length,startDate:window.startDate,endDate:window.endDate};
  }catch(error){await runLedger.fail({jobId,leaseToken,...analyticsFailure(error)}).catch(()=>{});throw error;}
}
function civilDate(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const stamp=Date.parse(value+'T00:00:00Z');
  return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===value?stamp:null;
}
export function analyticsEvidence(snapshot,{minimumViews=100,minimumDays=14,expectedPropertyId,at=new Date()}={}) {
  const reasons=[],articles=[];
  const hold=reason=>{if(!reasons.includes(reason))reasons.push(reason);};
  if(!Number.isSafeInteger(minimumViews)||minimumViews<100||!Number.isSafeInteger(minimumDays)||minimumDays<14||minimumDays>60)throw Error('Unsafe analytics evidence thresholds');
  const start=civilDate(snapshot?.startDate),end=civilDate(snapshot?.endDate);
  let latest;
  try{latest=analyticsWindow(at,snapshot?.report?.timeZone).endDate;if(!snapshot?.report?.timeZone)throw Error();}catch{hold('Invalid property timezone');}
  if(start===null||end===null||end<start||end-start>59*86400000)hold('Invalid report window');
  else {
    if((end-start)/86400000+1<minimumDays)hold('Insufficient observation window');
    if(latest&&snapshot.endDate!==latest)hold(snapshot.endDate>latest?'Report includes immature data':'Stale report window');
  }
  if(!/^[0-9]{1,20}$/.test(snapshot?.propertyId||'')||expectedPropertyId===undefined||snapshot.propertyId!==expectedPropertyId)hold('Unverified reporting property');
  if(snapshot?.version!=='page-daily-v1')hold('Unsupported report version');
  const quality=snapshot?.report?.quality;
  if(!Array.isArray(quality)||!quality.length||quality.some(q=>!q||['thresholded','sampled','otherRows','truncated'].some(k=>typeof q[k]!=='boolean')||q.thresholded||q.sampled||q.otherRows||q.truncated||q.emptyReason))hold('Incomplete or qualified report');
  const rows=snapshot?.report?.rows,seen=new Set(),byPath=new Map();
  if(!Array.isArray(rows)||!rows.length)hold('No observed article data');
  if(Array.isArray(rows)&&rows.length>10000)hold('Report exceeds bound');
  let views=0;
  for(const row of Array.isArray(rows)?rows.slice(0,10000):[]) {
    const date=civilDate(row?.date),path=canonicalArticlePath(row?.path);
    if(!path||path!==row.path||date===null||start===null||end===null||date<start||date>end||!Number.isSafeInteger(row.views)||row.views<0||!Number.isFinite(row.engagementSeconds)||row.engagementSeconds<0||seen.has(row.date+path)) {hold('Invalid or duplicate article observations');continue;}
    seen.add(row.date+path);
    const item=byPath.get(path)||{path,views:0,engagementSeconds:0,observedDays:0};
    item.views+=row.views;item.engagementSeconds+=row.engagementSeconds;if(row.views>0)item.observedDays++;
    views+=row.views;
    if(!Number.isSafeInteger(views)||!Number.isSafeInteger(item.views)||!Number.isFinite(item.engagementSeconds))hold('Aggregate exceeds bound');
    byPath.set(path,item);
  }
  for(const path of PUBLIC_ARTICLES.map(slug=>'/'+slug)) {
    const item=byPath.get(path)||{path,views:0,engagementSeconds:0,observedDays:0};
    const local=[];
    if(item.views<minimumViews)local.push('Insufficient article exposure');
    if(item.observedDays<minimumDays)local.push('Insufficient observed article days');
    articles.push({...item,state:reasons.length||local.length?'observe_only':'descriptive_only',reasons:[...reasons,...local],engagementSecondsPerView:item.views>0&&Number.isFinite(item.engagementSeconds/item.views)?item.engagementSeconds/item.views:null});
  }
  if(!articles.some(a=>a.state==='descriptive_only'))hold('No article meets observation thresholds');
  return {state:reasons.length?'observe_only':'descriptive_only',views:Number.isSafeInteger(views)?views:null,reasons,articles,canPublish:false,thresholds:{minimumViews,minimumDays,heuristic:true},note:'Missing days are not zero observations. Engagement per view is descriptive, not a user conversion rate. Cohorts, release mapping and consent coverage remain unverified; observations do not establish causation or authorize revisions.'};
}

import {generateTranslation,recoverTranslation,translationLedger,translationReadiness} from './translation-jobs.js';
import {validateTranslation,hash,LOCALES} from '../scripts/translations.mjs';
import {batchConfig,submitTranslationBatch,syncTranslationBatch} from './translation-batches.js';
const reply=(status,data)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const uuid=value=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value||'');
export function createTranslationHandlers({authorize,source,sources=async()=>[],glossary,store,env=process.env,generate,batchProvider}){
 async function owner(request){try{return await authorize(request);}catch{return null;}}
 async function configuration(db,mode='standard'){const {data,error}=await db.from('folkly_translation_budget').select('enabled,model,total_usd,job_usd,input_per_million,output_per_million,valid_until').eq('id',true).maybeSingle();const ready=translationReadiness(env,error?null:data,Date.now(),mode);if(mode==='batch'){try{batchConfig(env);}catch{ready.available=false;ready.blockers.push('OpenAI Batch requires OPENAI_API_KEY and an OpenAI model ID.');ready.message=ready.blockers.join(' ');}}return ready;}
 return {
  async GET(request){
   const access=await owner(request);if(!access)return reply(401,{message:'Owner sign-in required.'});
   try{
    const id=new URL(request.url).searchParams.get('job');
    if(!id){const {data,error}=await access.db.from('folkly_translation_jobs').select('job_id,slug,locale,model,state,reserved_usd,estimated_usd,evidence,created_at,recorded_at').order('created_at',{ascending:false}).limit(50);if(error)throw Error();let batches=[],batchReady=await configuration(access.db,'batch');try{const r=await access.db.from('folkly_translation_batches').select('batch_id,model,state,provider_status,created_at,updated_at').order('created_at',{ascending:false}).limit(20);if(r.error)throw Error();batches=r.data||[];}catch{batchReady={...batchReady,available:false,message:'Apply the translation batch queue migration before submitting bulk jobs.'};}return reply(200,{jobs:data||[],batches,sources:await sources(),configuration:await configuration(access.db),batchConfiguration:batchReady});}
    if(!uuid(id))return reply(400,{message:'Invalid translation job.'});
    const {data,error}=await access.db.from('folkly_translation_jobs').select('job_id,slug,locale,state,evidence,content_reference').eq('job_id',id).maybeSingle();if(error||!data)return reply(404,{message:'Translation job unavailable.'});
    if(data.state!=='generated')return reply(200,{job:{jobId:id,state:data.state,usage:data.evidence}});
    const contract=await source(data.slug),value=JSON.parse(await store.read(data.content_reference));validateTranslation(value,contract);if(value.locale!==data.locale)throw Error();
    return reply(200,{job:{jobId:id,state:data.state,usage:data.evidence,translationHash:hash(value)},draft:value});
   }catch{return reply(503,{message:'Private translation evidence unavailable.'});}
  },
  async POST(request){
   if(request.headers.get('origin')!==new URL(request.url).origin)return reply(403,{message:'Use the owner panel.'});
   const access=await owner(request);if(!access)return reply(401,{message:'Owner sign-in required.'});
   try{
    const raw=await request.text();if(Buffer.byteLength(raw)>2048)return reply(413,{message:'Request too large.'});let value;try{value=JSON.parse(raw);}catch{return reply(400,{message:'Invalid translation request.'});}
    if(value?.action==='batch'){
     if(Object.keys(value).sort().join('|')!=='action|batchId|locales|slugs'||!uuid(value.batchId)||!Array.isArray(value.slugs)||!Array.isArray(value.locales)||!value.slugs.length||!value.locales.length||value.slugs.length*value.locales.length>12||new Set(value.slugs).size!==value.slugs.length||new Set(value.locales).size!==value.locales.length||value.slugs.some(s=>typeof s!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)||s.length>100)||value.locales.some(l=>!Object.hasOwn(LOCALES,l)||l==='en'))return reply(400,{message:'Choose unique public sources and languages, at most 12 translations per batch.'});
     const ready=await configuration(access.db,'batch');if(!ready.available)return reply(503,{code:'TRANSLATION_CONFIGURATION',message:ready.message});
     return reply(202,await submitTranslationBatch({...value,source,glossary:await glossary(),db:access.db,env,provider:batchProvider}));
    }
    if(value?.action==='sync'){
     if(Object.keys(value).sort().join('|')!=='action|batchId'||!uuid(value.batchId))return reply(400,{message:'Invalid batch receipt.'});
     // Read/import paid results even after pilot approval expires. Never generate.
     return reply(200,await syncTranslationBatch({batchId:value.batchId,db:access.db,source,glossary:await glossary(),store,env,provider:batchProvider}));
    }
    if(value?.action==='recover'){
     if(Object.keys(value).sort().join('|')!=='action|byteSize|jobId|sha256'||!uuid(value.jobId)||!/^[a-f0-9]{64}$/.test(value.sha256||'')||!Number.isSafeInteger(value.byteSize)||value.byteSize<1||value.byteSize>200000)return reply(400,{message:'Invalid recovery receipt.'});
     const {data:job,error}=await access.db.from('folkly_translation_jobs').select('job_id,reservation_id,slug,locale,source_hash,glossary_hash,prompt_version,model,state').eq('job_id',value.jobId).maybeSingle();if(error||!job)return reply(404,{message:'Translation job unavailable.'});
     const reference={pathname:`editorial/translations/${value.sha256}.json`,sha256:value.sha256,byte_size:value.byteSize};
     return reply(200,await recoverTranslation({job,reference,contract:await source(job.slug),store,ledger:translationLedger(access.db)}));
    }
    if(!value||Object.keys(value).sort().join('|')!=='jobId|locale|slug'||!uuid(value.jobId)||!Object.hasOwn(LOCALES,value.locale)||value.locale==='en'||typeof value.slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug)||value.slug.length>100)return reply(400,{message:'Invalid translation request.'});
    const contract=await source(value.slug),readiness=await configuration(access.db);
    if(!readiness.available)return reply(503,{code:'TRANSLATION_CONFIGURATION',message:readiness.message});
    const result=await generateTranslation({...value,contract,glossary:await glossary(),ledger:translationLedger(access.db),store},env,generate);
    return reply(200,result);
   }catch(error){return reply(503,{message:'Translation unavailable or held. Inspect saved attempts before retrying.',...(error.privateReference?{jobId:error.jobId,privateReference:error.privateReference}:{})});}
  }
 };
}

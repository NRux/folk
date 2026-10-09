import {generateTranslation,recoverTranslation,translationLedger,translationConfig} from './translation-jobs.js';
import {validateTranslation,hash,LOCALES} from '../scripts/translations.mjs';
const reply=(status,data)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const uuid=value=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value||'');
export function createTranslationHandlers({authorize,source,sources=async()=>[],glossary,store,env=process.env,generate}){
 async function owner(request){try{return await authorize(request);}catch{return null;}}
 return {
  async GET(request){
   const access=await owner(request);if(!access)return reply(401,{message:'Owner sign-in required.'});
   try{
    const id=new URL(request.url).searchParams.get('job');
    if(!id){const {data,error}=await access.db.from('folkly_translation_jobs').select('job_id,slug,locale,model,state,reserved_usd,estimated_usd,evidence,created_at,recorded_at').order('created_at',{ascending:false}).limit(50);if(error)throw Error();let configuration;try{const c=translationConfig(env);configuration={available:true,model:c.model,maxJobDollars:c.amount};}catch{configuration={available:false};}return reply(200,{jobs:data||[],sources:await sources(),configuration});}
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
    if(value?.action==='recover'){
     if(Object.keys(value).sort().join('|')!=='action|byteSize|jobId|sha256'||!uuid(value.jobId)||!/^[a-f0-9]{64}$/.test(value.sha256||'')||!Number.isSafeInteger(value.byteSize)||value.byteSize<1||value.byteSize>200000)return reply(400,{message:'Invalid recovery receipt.'});
     const {data:job,error}=await access.db.from('folkly_translation_jobs').select('job_id,reservation_id,slug,locale,source_hash,glossary_hash,prompt_version,model,state').eq('job_id',value.jobId).maybeSingle();if(error||!job)return reply(404,{message:'Translation job unavailable.'});
     const reference={pathname:`editorial/translations/${value.sha256}.json`,sha256:value.sha256,byte_size:value.byteSize};
     return reply(200,await recoverTranslation({job,reference,contract:await source(job.slug),store,ledger:translationLedger(access.db)}));
    }
    if(!value||Object.keys(value).sort().join('|')!=='jobId|locale|slug'||!uuid(value.jobId)||!Object.hasOwn(LOCALES,value.locale)||value.locale==='en'||typeof value.slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug)||value.slug.length>100)return reply(400,{message:'Invalid translation request.'});
    const contract=await source(value.slug);translationConfig(env);
    const result=await generateTranslation({...value,contract,glossary:await glossary(),ledger:translationLedger(access.db),store},env,generate);
    return reply(200,result);
   }catch(error){return reply(503,{message:'Translation unavailable or held. Inspect saved attempts before retrying.',...(error.privateReference?{jobId:error.jobId,privateReference:error.privateReference}:{})});}
  }
 };
}

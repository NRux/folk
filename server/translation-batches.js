import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {prepareTranslation,TRANSLATION_SYSTEM,translationConfig,translationLedger} from './translation-jobs.js';
import {hash,validateTranslation,LOCALES} from '../scripts/translations.mjs';
const uuid=value=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value||'');
const providerId=(value,prefix)=>typeof value==='string'&&value.length<=120&&new RegExp('^'+prefix+'[A-Za-z0-9_-]+$').test(value);
const terminal=new Set(['completed','failed','expired','cancelled']);
export function batchConfig(env){
 if((env.FOLKLY_TRANSLATION_MODEL_ID?.includes('/')&&!env.FOLKLY_TRANSLATION_MODEL_ID.startsWith('openai/'))||!env.OPENAI_API_KEY)throw Error('OpenAI Batch requires OPENAI_API_KEY and an OpenAI model ID.');
 const config=translationConfig(env);
 return {...config,providerModel:config.model.replace(/^openai\//,'')};
}
export function batchRequest({jobId,locale,contract,glossary},config){
 const {prompt,schema}=prepareTranslation({jobId,locale,contract,glossary});
 return {custom_id:jobId,method:'POST',url:'/v1/chat/completions',body:{model:config.providerModel,messages:[{role:'system',content:TRANSLATION_SYSTEM},{role:'user',content:prompt}],reasoning_effort:'none',max_completion_tokens:24000,response_format:{type:'json_schema',json_schema:{name:'folkly_translation',strict:true,schema:z.toJSONSchema(schema)}}}};
}
// Fixed origin, bounded reads and deadlines, no SDK retries and no caller URLs.
export function openAITranslationBatch(env,fetcher=fetch){
 if(!env.OPENAI_API_KEY)throw Error('OpenAI Batch provider unavailable');
 async function call(path,{method='GET',body,json=false,text=false}={}){
  const response=await fetcher('https://api.openai.com/v1'+path,{method,redirect:'error',headers:{Authorization:'Bearer '+env.OPENAI_API_KEY,...(json?{'Content-Type':'application/json'}:{})},body:json?JSON.stringify(body):body,signal:AbortSignal.timeout(15000)});
  if(!response.ok){await response.body?.cancel();throw Error('OpenAI Batch request unavailable');}
  const reader=response.body.getReader(),parts=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4000000)throw Error('Batch response too large');parts.push(Buffer.from(value));}}catch(e){await reader.cancel().catch(()=>{});throw e;}
  const value=Buffer.concat(parts).toString('utf8');return text?value:JSON.parse(value);
 }
 return {
  async upload(jsonl){if(Buffer.byteLength(jsonl)>1500000)throw Error('Batch input too large');const form=new FormData();form.set('purpose','batch');form.set('file',new Blob([jsonl],{type:'application/jsonl'}),'folkly-translations.jsonl');const r=await call('/files',{method:'POST',body:form});if(!providerId(r.id,'file-'))throw Error('Invalid input receipt');return r.id;},
  create(inputFileId,batchId,manifestHash){return call('/batches',{method:'POST',json:true,body:{input_file_id:inputFileId,endpoint:'/v1/chat/completions',completion_window:'24h',metadata:{application:'folkly',queue_id:batchId,manifest_hash:manifestHash},output_expires_after:{anchor:'created_at',seconds:2592000}}});},
  retrieve(id){if(!providerId(id,'batch_'))throw Error('Invalid batch receipt');return call('/batches/'+id);},
  file(id){if(!providerId(id,'file-'))throw Error('Invalid file receipt');return call('/files/'+id+'/content',{text:true});},
  async reconcile(batchId,manifestHash){
   let after='',matches=[],exhausted=false;
   for(let page=0;page<5;page++){const r=await call('/batches?limit=100'+(after?'&after='+encodeURIComponent(after):''));if(!Array.isArray(r.data))throw Error('Batch lookup unavailable');matches.push(...r.data.filter(b=>b.metadata?.application==='folkly'&&b.metadata?.queue_id===batchId&&b.metadata?.manifest_hash===manifestHash));if(!r.has_more){exhausted=true;break;}if(!providerId(r.last_id,'batch_'))throw Error('Invalid lookup cursor');after=r.last_id;}
   if(!exhausted||matches.length!==1)throw Error('Submission held; provider reconciliation required. Never resubmit this batch.');return matches[0];
  }
 };
}
async function rpc(db,name,args){const {data,error}=await db.rpc(name,args);if(error||data!==true)throw Error('Translation batch held; inspect its existing receipt before retrying.');}
export async function submitTranslationBatch({batchId,slugs,locales,source,glossary,db,env,provider}){
 if(!uuid(batchId)||!Array.isArray(slugs)||!Array.isArray(locales)||!slugs.length||!locales.length||slugs.length*locales.length>12||new Set(slugs).size!==slugs.length||new Set(locales).size!==locales.length||slugs.some(s=>typeof s!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)||s.length>100)||locales.some(l=>!Object.hasOwn(LOCALES,l)||l==='en'))throw Error('Choose unique public sources and languages, at most 12 translations per batch.');
 const config=batchConfig(env),requests=[],claims=[];
 // Resolve ALL public contracts and validate ALL prompts before any reservation.
 for(const slug of slugs){const contract=await source(slug);if(contract.slug!==slug)throw Error('Public source identity mismatch');for(const locale of locales){const jobId=randomUUID();requests.push(batchRequest({jobId,locale,contract,glossary},config));claims.push({jobId,slug,locale,sourceHash:contract.sourceHash,glossaryHash:contract.glossaryHash,promptVersion:contract.promptVersion});}}
 const jsonl=requests.map(r=>JSON.stringify(r)).join('\n')+'\n';if(Buffer.byteLength(jsonl)>1500000)throw Error('Batch input too large');const manifestHash=hash(jsonl);
 provider??=openAITranslationBatch(env);
 await rpc(db,'folkly_claim_translation_batch',{batch_key:batchId,manifest_checksum:manifestHash,model_id:config.model,max_dollars:config.amount,requests:claims});
 await rpc(db,'folkly_start_translation_batch',{batch_key:batchId});
 // Ambiguous failures retain the durable submitting fence and every reservation.
 const inputFileId=await provider.upload(jsonl);
 await rpc(db,'folkly_attach_translation_batch',{batch_key:batchId,file_id:inputFileId,provider_id:null});
 const receipt=await provider.create(inputFileId,batchId,manifestHash);
 verifyReceipt(receipt,{batch_id:batchId,manifest_hash:manifestHash,input_file_id:inputFileId});
 await rpc(db,'folkly_attach_translation_batch',{batch_key:batchId,file_id:inputFileId,provider_id:receipt.id});
 return {batchId,state:'submitted',requests:claims.length,message:'Batch queued. Processing can take up to 24 hours. Check progress to import private drafts.'};
}
function verifyReceipt(receipt,batch){
 if(!providerId(receipt?.id,'batch_')||!providerId(receipt.input_file_id,'file-')||receipt.endpoint!=='/v1/chat/completions'||receipt.metadata?.application!=='folkly'||receipt.metadata?.queue_id!==batch.batch_id||receipt.metadata?.manifest_hash!==batch.manifest_hash||(batch.input_file_id&&receipt.input_file_id!==batch.input_file_id)||(batch.provider_batch_id&&receipt.id!==batch.provider_batch_id))throw Error('Provider batch identity mismatch');
}
export function batchLines(files,jobIds){
 const result=new Map(),allowed=new Set(jobIds);
 for(const file of files){if(Buffer.byteLength(file)>4000000)throw Error('Batch output too large');for(const line of file.split('\n').filter(l=>l.trim())){const r=JSON.parse(line);if(!allowed.has(r.custom_id)||result.has(r.custom_id))throw Error('Unexpected or duplicate batch result');result.set(r.custom_id,r);}}
 return result;
}
export async function syncTranslationBatch({batchId,db,source,glossary,store,env,provider}){
 if(!uuid(batchId))throw Error('Invalid batch');
 const {data:batch,error}=await db.from('folkly_translation_batches').select('*').eq('batch_id',batchId).maybeSingle();if(error||!batch)throw Error('Batch unavailable');
 if(batch.state==='completed')return {batchId,state:'completed',message:'Private drafts already imported. Language review remains required.'};
 const token=randomUUID();await rpc(db,'folkly_lock_translation_batch',{batch_key:batchId,lock_token:token});let status='held';
 try{
  provider??=openAITranslationBatch(env);
  const receipt=batch.provider_batch_id?await provider.retrieve(batch.provider_batch_id):await provider.reconcile(batchId,batch.manifest_hash);verifyReceipt(receipt,batch);
  if(!batch.provider_batch_id)await rpc(db,'folkly_attach_translation_batch',{batch_key:batchId,file_id:receipt.input_file_id,provider_id:receipt.id});
  const valid=['validating','in_progress','finalizing','completed','failed','expired','cancelling','cancelled'];if(!valid.includes(receipt.status))throw Error('Invalid provider status');status=receipt.status;
  if(!terminal.has(status))return {batchId,state:'submitted',providerStatus:status,message:'Batch is processing. No additional generation call was made.'};
  const {data:jobs,error:jobError}=await db.from('folkly_translation_jobs').select('*').eq('batch_id',batchId);if(jobError||!jobs?.length||jobs.length>12)throw Error('Batch jobs unavailable');
  const files=[];for(const fileId of [receipt.output_file_id,receipt.error_file_id].filter(Boolean))files.push(await provider.file(fileId));
  const lines=batchLines(files,jobs.map(j=>j.job_id)),ledger=translationLedger(db);let generated=0,failed=0,held=0;
  for(const job of jobs){
   if(job.state!=='reserved'){if(job.state==='generated')generated++;else failed++;continue;}
   const line=lines.get(job.job_id),body=line?.response?.body,count=n=>Number.isSafeInteger(n)&&n>=0&&n<=10000000?n:null;
   const usage={mode:'batch',batchId,providerBatchId:receipt.id,model:job.model,modelSnapshot:String(body?.model||job.model).slice(0,120),inputTokens:count(body?.usage?.prompt_tokens),outputTokens:count(body?.usage?.completion_tokens),totalTokens:count(body?.usage?.total_tokens)};
   let value,contract;
   // A temporarily unreadable source holds persistence, rather than declaring
   // a valid paid translation failed. A proven hash change is rejected below.
   try{contract=await source(job.slug);}catch{held++;continue;}
   try{
    if(line?.error||line?.response?.status_code!==200||body?.choices?.length!==1||body.choices[0].finish_reason!=='stop'||body.choices[0].message?.refusal)throw Error('Incomplete batch translation');
    if(contract.sourceHash!==job.source_hash||contract.glossaryHash!==job.glossary_hash||contract.promptVersion!==job.prompt_version||hash(glossary)!==job.glossary_hash)throw Error('Source changed');
    const model=job.model.replace(/^openai\//,'');if(typeof body.model!=='string'||!(body.model===model||body.model.startsWith(model+'-')))throw Error('Model receipt mismatch');
    const {schema}=prepareTranslation({jobId:job.job_id,locale:job.locale,contract,glossary});
    value={format:'folkly-translation-v1',slug:job.slug,locale:job.locale,sourceHash:job.source_hash,glossaryHash:job.glossary_hash,promptVersion:job.prompt_version,...schema.parse(JSON.parse(body.choices[0].message.content))};validateTranslation(value,contract);
   }catch{await ledger.finish({jobId:job.job_id,reservation:{id:job.reservation_id},status:'failed',usage,reference:null});failed++;continue;}
   // Persistence faults keep the job reserved. A later sync reads the same paid
   // provider output and retries storage only, never generation or a refund.
   try{const reference=await store.upload(JSON.stringify(value));if(hash(JSON.parse(await store.read(reference)))!==hash(value))throw Error('Readback mismatch');await ledger.finish({jobId:job.job_id,reservation:{id:job.reservation_id},status:'generated',usage,reference});generated++;}catch{held++;}
  }
  if(held)status='held';
  return {batchId,state:held?'held':'completed',generated,failed,held,message:held?'Some drafts need persistence recovery. Check this batch again; no new model call will occur.':'Batch results recorded. Verified drafts require language review before release.'};
 }catch{status='held';throw Error('Batch progress unavailable or held. Check the existing batch again; do not submit a replacement.');}
 finally{await rpc(db,'folkly_unlock_translation_batch',{batch_key:batchId,lock_token:token,status});}
}

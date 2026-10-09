import {hash} from '../scripts/translations.mjs';
import {batchConfig} from './translation-batches.js';
const dollars=value=>typeof value==='string'&&/^(?:0|[1-9][0-9]?)(?:\.[0-9]{1,2})?$/.test(value)?Number(value):NaN;
function view(data,env){
 const budget=data?.budget,reserved=Number(data?.reserved);
 if(!budget||!Number.isFinite(reserved)||reserved<0)throw Error('Budget unavailable');
 let config;try{config=batchConfig(env);}catch{}
 const total=Number(budget.total_usd),editable=Boolean(config&&config.model===budget.model&&Number(budget.input_per_million)>0&&Number(budget.output_per_million)>0);
 return {available:true,editable,revision:hash(budget),model:budget.model,totalDollars:total,reservedDollars:reserved,remainingDollars:Math.max(0,total-reserved),perTranslationDollars:config?.amount??null,enabled:budget.enabled===true,validUntil:budget.valid_until,message:editable?'Enter the total USD spending limit and expiry.':'Configure the matching OpenAI model, per-translation reservation and pricing before saving.'};
}
export async function readTranslationBudget(db,env){
 try{const {data,error}=await db.rpc('folkly_read_translation_budget',{});if(error)throw Error();return view(data,env);}
 catch{return {available:false,editable:false,message:'Translation budget controls unavailable. Apply the budget-controls migration and refresh.'};}
}
export async function saveTranslationBudget(db,env,value,now=Date.now()){
 if(!value||Object.keys(value).sort().join('|')!=='action|enabled|revision|totalDollars|validUntil'||typeof value.revision!=='string'||!/^[a-f0-9]{64}$/.test(value.revision)||typeof value.enabled!=='boolean')return {status:400,message:'Check the translation budget fields.'};
 const maximum=dollars(value.totalDollars),expires=Date.parse(value.validUntil);
 if(!Number.isFinite(maximum)||maximum<0||maximum>50||typeof value.validUntil!=='string'||!Number.isFinite(expires)||new Date(expires).toISOString()!==value.validUntil||expires<=now||expires>now+30*86400000)return {status:400,message:'Enter a USD limit from 0 to 50 with at most two decimals, and an expiry within the next 30 days.'};
 const read=await db.rpc('folkly_read_translation_budget',{});if(read.error)throw Error('Budget unavailable');
 const current=view(read.data,env);
 if(current.revision!==value.revision)return {status:409,message:'The translation budget changed. Refresh before saving.'};
 if(!current.editable)return {status:503,message:current.message};
 const config=batchConfig(env);
 const result=await db.rpc('folkly_save_translation_budget',{expected_budget:read.data.budget,maximum,approval_until:new Date(expires).toISOString(),pilot_enabled:value.enabled,configured_model:config.model,configured_job:config.amount});
 if(result.error)throw Error('Budget save unavailable');
 const state=result.data?.status;
 if(state==='conflict')return {status:409,message:'The translation budget changed. Refresh before saving.'};
 if(state==='invalid')return {status:400,message:'Check the spending limit and expiry.'};
 if(state==='below_reserved')return {status:400,message:'The limit must cover retained reservations and at least one enabled translation.'};
 if(state!=='saved')return {status:503,message:'The configured model, pricing or per-translation reservation needs attention.'};
 const saved=view(result.data,env),verified=await readTranslationBudget(db,env);
 if(!verified.available||verified.revision!==saved.revision)return {status:503,message:'Save acknowledgement could not be verified. Refresh the budget before retrying.'};
 return {status:200,message:'Translation budget saved and verified. '+(saved.enabled?'The separate translation pilot is enabled within these limits.':'The translation pilot remains paused.')+' No batch was started.',budget:verified};
}

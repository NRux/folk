import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {get,put} from '@vercel/blob';
import {createOwnerHandlers} from './owner-auth.js';
import {newsletterConfigFromEnv,newsletterMissingConfig} from './newsletter-config.js';
import {readNewsletterCatalog} from './newsletter-catalog.js';
import {createNewsletterStore} from './newsletter-store.js';
import {readNewsletterRecord,validNewsletterDate} from './newsletter-records.js';
import {digestWindow} from './newsletter.js';
import {createResendSender} from './resend.js';

const switches=['production.autonomous_enabled','publication.autonomous_enabled','schedule.enabled'];
async function readBody(request){
 const reader=request.body?.getReader();if(!reader)throw Error('Missing input');const chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>256)throw Error('Input too large');chunks.push(value);}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function context(env,now){
 const email=(env.FOLKLY_OWNER_EMAIL||'').trim().toLowerCase();
 if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Invalid owner address');
 const date=now(),day=date.toISOString().slice(0,10),id=createHash('sha256').update(email).digest('hex'),week=digestWindow(date).key;
 return {email,date,day,prefix:`newsletter/owner-tests/${day}/${id}/`,claim:`newsletter/delivery/${week}/${id}.json`,receipt:`newsletter/receipts/${week}/${id}.json`};
}
function scopedStore(ctx,sdk){
 const path=logical=>{if(logical!==ctx.claim&&logical!==ctx.receipt)throw Error('Invalid test path');return ctx.prefix+logical;};
 return createNewsletterStore({get:(logical,options)=>sdk.get(path(logical),options),put:(logical,value,options)=>sdk.put(path(logical),value,options),list:()=>{throw Error('No subscriber listing permitted');}});
}
async function status(ctx,sdk){
 const read=logical=>readNewsletterRecord(sdk.get,ctx.prefix+logical);
 const [claim,receipt,confirmation]=await Promise.all([read(ctx.claim),read(ctx.receipt),read('confirmed.json')]);
 if(claim&&(!isDeepStrictEqual(Object.keys(claim).sort(),['createdAt','state'])||claim.state!=='claimed'||!validNewsletterDate(claim.createdAt)))throw Error('Invalid claim');
 if(receipt&&(!isDeepStrictEqual(Object.keys(receipt).sort(),['acceptedAt','providerId','state'])||receipt.state!=='accepted'||!validNewsletterDate(receipt.acceptedAt)||!/^[-a-zA-Z0-9_]{1,200}$/.test(receipt.providerId||'')))throw Error('Invalid receipt');
 if(confirmation&&(!receipt||!isDeepStrictEqual(Object.keys(confirmation).sort(),['providerId','receivedAt'])||confirmation.providerId!==receipt.providerId||!validNewsletterDate(confirmation.receivedAt)))throw Error('Invalid mailbox proof');
 return {day:ctx.day,state:confirmation?'confirmed':receipt?'accepted':claim?'held':'none',providerAccepted:Boolean(receipt),mailboxConfirmed:Boolean(confirmation),acceptedAt:receipt?.acceptedAt||null,receivedAt:confirmation?.receivedAt||null,...(receipt&&!claim?{incompleteRestore:true}:{})};
}
export function createOwnerNewsletterTestHandler({env=process.env,authorize=createOwnerHandlers({env}).authorize,sdk={get,put},send=createResendSender(),catalog=readNewsletterCatalog,now=()=>new Date()}={}){
 const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
 async function paused(db){const result=await db.from('folkly_settings').select('key,value').in('key',switches);if(result.error||result.data?.length!==3||!switches.every(key=>result.data.filter(row=>row.key===key&&row.value==='false').length===1))throw Error('Article switches must remain paused');}
 return async request=>{
  if(!['GET','POST'].includes(request.method))return reply({message:'Method not allowed.'},405);
  if(request.method==='POST'&&request.headers.get('origin')!==new URL(request.url).origin)return reply({message:'Use the owner page.'},403);
  let stage='authorization';
  try{
   const owner=await authorize(request);if(!owner)return reply({message:'Owner sign-in required.'},401);
   if(new URL(request.url).search)return reply({message:'Invalid test request.'},400);
   stage='configuration';const cfg=newsletterConfigFromEnv(env),missing=newsletterMissingConfig(cfg).filter(name=>!['CRON_SECRET','NEWSLETTER_SECRET'].includes(name));
   const ctx=context(env,now);await paused(owner.db);
   stage='readback';const current=await status(ctx,sdk);
   const readiness={missing,deliveryPaused:!cfg.enabled,canSend:!cfg.enabled&&!missing.length&&current.state==='none'};
   if(request.method==='GET')return reply({owner:true,test:{...current,...readiness}});
   stage='validation';if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))return reply({message:'JSON required.'},415);
   let body;try{body=await readBody(request);}catch{return reply({message:'Invalid or oversized test request.'},400);}
   if(cfg.enabled)return reply({message:'Weekly delivery must stay paused for this isolated test.'},409);
   if(isDeepStrictEqual(body,{action:'confirm',received:true})){
    if(!current.providerAccepted)return reply({message:'There is no verified provider receipt to confirm.'},409);
    const original=await readNewsletterRecord(sdk.get,ctx.prefix+ctx.receipt),record={providerId:original.providerId,receivedAt:now().toISOString()};
    if(!current.mailboxConfirmed){try{await sdk.put(ctx.prefix+'confirmed.json',JSON.stringify(record),{access:'private',addRandomSuffix:false,allowOverwrite:false,contentType:'application/json',abortSignal:AbortSignal.timeout(10000)});}catch{}}
    stage='confirmation';const verified=await status(ctx,sdk);if(!verified.mailboxConfirmed)throw Error('Mailbox confirmation unavailable');
    return reply({owner:true,test:{...verified,canSend:false},message:'Your mailbox confirmation is saved. Weekly delivery remains off.'});
   }
   if(!isDeepStrictEqual(body,{action:'send',consent:true}))return reply({message:'Confirm one test email to your owner sign-in address.'},400);
   if(missing.length)return reply({message:'Test configuration is incomplete.',missing},503);
   if(current.state!=='none')return reply({owner:true,test:{...current,canSend:false},message:'A test attempt already exists for this UTC day. No second email was sent.'});
   stage='catalog';const stories=(await catalog()).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)||a.slug.localeCompare(b.slug)).slice(0,1);
   if(!stories.length)return reply({message:'No published story is available for a test.'},503);
   const story=stories[0],link=`https://www.folkly.com/${story.slug}`;
   const payload={from:cfg.from,to:[ctx.email],subject:'Folkly newsletter delivery test',text:`This is the single-recipient delivery test you requested in the Folkly owner panel. Weekly delivery is still off.\n\n${story.title}\n${link}\n\nReturn to https://www.folkly.com/owner and confirm that you received this email. This test does not enroll you in the newsletter.\n\nA Then Media inc. project.\n${cfg.postalAddress}`,html:`<h1>Folkly delivery test</h1><p>This is the single-recipient test you requested. Weekly delivery is still off.</p><h2><a href="${escape(link)}">${escape(story.title)}</a></h2><p>Return to the <a href="https://www.folkly.com/owner">owner panel</a> and confirm receipt. This test does not enroll you in the newsletter.</p><p>A Then Media inc. project.<br>${escape(cfg.postalAddress)}</p>`};
   stage='claim';const store=scopedStore(ctx,sdk);if(!await store.claim(ctx.claim,{state:'claimed',createdAt:ctx.date.toISOString()}))return reply({message:'This test is held or already attempted. Refresh the test status; do not resend.',test:{...await status(ctx,sdk),canSend:false}},409);
   await paused(owner.db);
   stage='provider';const accepted=await send(payload,`folkly-owner-test/${ctx.day}/${createHash('sha256').update(ctx.email).digest('hex')}`,cfg.apiKey);
   stage='receipt';await store.finish(ctx.claim,{state:'accepted',providerId:accepted.id,acceptedAt:now().toISOString()});
   const verified=await status(ctx,sdk);if(!verified.providerAccepted)throw Error('Test receipt unavailable');
   return reply({owner:true,test:{...verified,canSend:false},message:'Resend accepted the test. Check your inbox, then confirm receipt here. Weekly delivery remains off.'});
  }catch{return reply({message:stage==='provider'||stage==='receipt'?'The test outcome is held. An email may have been accepted. Refresh status and inspect Resend before resolving it; do not resend.':stage==='confirmation'?'Mailbox confirmation could not be verified. Refresh to check before confirming again.':'The isolated newsletter test is unavailable. No automatic retry.',stage},503);}
 };
}

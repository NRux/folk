import {createOwnerHandlers} from './owner-auth.js';
import {newsletterConfigFromEnv,newsletterMissingConfig} from './newsletter-config.js';
import {readNewsletterCatalog} from './newsletter-catalog.js';
import {digestWindow,digestStories,digestEmail} from './newsletter.js';

export async function readOwnerNewsletter({env=process.env,catalog=readNewsletterCatalog,now=()=>new Date()}={}) {
 const cfg=newsletterConfigFromEnv(env),missing=newsletterMissingConfig(cfg);
 const readiness={deliveryEnabled:cfg.enabled,configurationComplete:missing.length===0,missing,hostedAcceptance:'pending'};
 try {
  const date=now();
  // Strictly next Friday boundary. The preview and worker share date-only story
  // selection, so Friday stories wait for the next digest rather than being lost.
  const run=new Date(digestWindow(date).end.getTime()+7*86400000);
  const end=new Date(run);end.setUTCHours(0,0,0,0);
  const start=new Date(end.getTime()-7*86400000);
  const stories=digestStories(await catalog(),run).map(x=>({slug:x.slug,title:x.title,description:x.description||x.summary||'',publishedAt:x.publishedAt}));
  const email=digestEmail(stories,'[Personal unsubscribe link added for each recipient]','[Configured business mailing address]');
  return {readiness,preview:{available:true,runAt:run.toISOString(),from:start.toISOString().slice(0,10),until:end.toISOString().slice(0,10),stories,subject:email.subject,text:email.text,empty:stories.length===0},generatedAt:date.toISOString()};
 }catch {
  return {readiness,preview:{available:false,message:'Digest preview unavailable. Refresh to try again.'}};
 }
}
export function createOwnerNewsletterHandler({env=process.env,authorize=createOwnerHandlers({env}).authorize,catalog=readNewsletterCatalog,now=()=>new Date()}={}) {
 const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
 return async request=>{
  if(request.method!=='GET')return reply({message:'Method not allowed'},405);
  try {
   if(!await authorize(request))return reply({message:'Owner sign-in required.'},401);
   if([...new URL(request.url).searchParams].length)return reply({message:'Invalid newsletter preview request.'},400);
   return reply({owner:true,newsletter:await readOwnerNewsletter({env,catalog,now})});
  }catch{return reply({message:'Newsletter status unavailable.'},503);}
 };
}

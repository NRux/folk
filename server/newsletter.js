import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
export const subscriberId = email => createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function unsubscribeToken(id, secret) { return `${id}.${createHmac('sha256',secret).update(`unsubscribe:${id}`).digest('hex')}`; }
export function verifyUnsubscribe(token, secret) {
 if (!secret || secret.length < 32 || !/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(token || '')) return null;
 const [id] = token.split('.'), expected = unsubscribeToken(id,secret);
 return timingSafeEqual(Buffer.from(token),Buffer.from(expected)) ? id : null;
}
// The Friday 16:00 UTC boundary is shared by all retries of the weekly run.
export function digestWindow(now) {
 const end = new Date(now); end.setUTCHours(16,0,0,0);
 end.setUTCDate(end.getUTCDate()-((end.getUTCDay()+2)%7));
 if(end>now)end.setUTCDate(end.getUTCDate()-7);
 return {key:end.toISOString().slice(0,10),end,start:new Date(end.getTime()-7*86400000)};
}
export function digestStories(items, now) {
 const window=digestWindow(now);
 const end=new Date(window.end);end.setUTCHours(0,0,0,0);
 const start=new Date(end.getTime()-7*86400000);
 return items.filter(x=>x.status==='published' && /^[a-z0-9-]+$/.test(x.slug) && new Date(x.publishedAt)>=start && new Date(x.publishedAt)<end).sort((a,b)=>a.slug.localeCompare(b.slug));
}
export function digestEmail(items, unsubscribe, postalAddress) {
 const intro='This week’s stories about the intersection of Culture and Place.';
 const text=`${intro}\n\n${items.map(x=>`${x.title}\nhttps://www.folkly.com/${x.slug}`).join('\n\n')}\n\nUnsubscribe: ${unsubscribe}\nA Then Media inc. project.\n${postalAddress}`;
 const html=`<h1>Folkly weekly</h1><p>${intro}</p>${items.map(x=>`<h2><a href="https://www.folkly.com/${escape(x.slug)}">${escape(x.title)}</a></h2><p>${escape(x.description || x.summary || '')}</p>`).join('')}<p><a href="${escape(unsubscribe)}">Unsubscribe</a></p><p>A Then Media inc. project.<br>${escape(postalAddress)}</p>`;
 return {subject:'Folkly: this week’s stories',text,html};
}
export function createNewsletterHandler({config, catalog, store, send, now=()=>new Date(), pause=()=>new Promise(r=>setTimeout(r,600))}) {
 const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
 return async request => {
  const cfg=config();
  if(request.method!=='GET')return reply({message:'Method not allowed'},405);
  if(!cfg.cronSecret || request.headers.get('authorization')!==`Bearer ${cfg.cronSecret}`)return reply({message:'Unauthorized'},401);
  if(!cfg.enabled)return reply({paused:true});
  if(!cfg.apiKey || !cfg.from || /[\r\n]/.test(cfg.from) || !cfg.postalAddress || !cfg.secret || cfg.secret.length<32 || !cfg.storage)return reply({message:'Newsletter configuration incomplete'},503);
  try {
   const date=now(),window=digestWindow(date),stories=digestStories(await catalog(),date);
   if(!stories.length)return reply({sent:0,reason:'No newly published stories'});
   // Read the whole bounded list before sending; never silently omit later pages.
   const subscribers=await store.subscribers(200); let accepted=0,held=0,skipped=0;
   for(const {id,record} of subscribers) {
    if(!record?.consent || typeof record.email!=='string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email) || subscriberId(record.email)!==id || record.email==='acceptance-test@example.com' || /[\r\n]/.test(record.email)) {skipped++;continue;}
    if(await store.suppressed(id)){skipped++;continue;}
    const key=`newsletter/delivery/${window.key}/${id}.json`;
    // Create-only claim is permanent: concurrent/retried jobs cannot resend. An
    // ambiguous transport failure stays held for reconciliation, never replayed.
    if(!await store.claim(key,{state:'claimed',createdAt:date.toISOString()})){held++;continue;}
    if(await store.suppressed(id)){await store.finish(key,{state:'suppressed'});skipped++;continue;}
    const unsubscribe=`https://www.folkly.com/api/unsubscribe?token=${unsubscribeToken(id,cfg.secret)}`;
    const email=digestEmail(stories,unsubscribe,cfg.postalAddress);
    try {
     const result=await send({...email,from:cfg.from,to:[record.email],headers:{'List-Unsubscribe':`<${unsubscribe}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}},`folkly/${window.key}/${id}`,cfg.apiKey);
     await store.finish(key,{state:'accepted',providerId:result.id,acceptedAt:now().toISOString()});accepted++;
    }catch {held++;} // No recipient/provider details in responses or logs.
    await pause();
   }
   return reply({accepted,held,skipped});
  }catch{return reply({message:'Newsletter processing unavailable'},503);}
 };
}

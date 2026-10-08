import {readFile} from 'node:fs/promises';
import {createNewsletterHandler} from '../server/newsletter.js';
import {newsletterStore} from '../server/newsletter-store.js';
import {createResendSender} from '../server/resend.js';
export const config={maxDuration:300};
export const GET=createNewsletterHandler({
 config:()=>({enabled:process.env.NEWSLETTER_ENABLED==='true',cronSecret:process.env.CRON_SECRET,apiKey:process.env.RESEND_API_KEY,from:process.env.NEWSLETTER_FROM,postalAddress:process.env.NEWSLETTER_POSTAL_ADDRESS,secret:process.env.NEWSLETTER_SECRET,storage:Boolean(process.env.BLOB_STORE_ID||process.env.BLOB_READ_WRITE_TOKEN)}),
 catalog:async()=>{
  const items=JSON.parse(await readFile(new URL('../web/vercel/articles.json',import.meta.url),'utf8'));
  const routes=JSON.parse(await readFile(new URL('../web/vercel/routes.json',import.meta.url),'utf8'));
  return items.filter(item=>Object.hasOwn(routes,`/${item.slug}`));
 },
 store:newsletterStore,
 send:createResendSender()
});

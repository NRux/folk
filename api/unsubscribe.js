import {verifyUnsubscribe} from '../server/newsletter.js';
import {newsletterStore} from '../server/newsletter-store.js';
export function createUnsubscribeHandler({secret,suppress}) {
 return async request=>{
  const headers={'Cache-Control':'no-store','Content-Type':'text/html; charset=utf-8','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; form-action 'self'; base-uri 'none'"};
  if(!['GET','POST'].includes(request.method))return new Response('Method not allowed',{status:405,headers});
  const signingSecret=secret();
  if(!signingSecret || signingSecret.length<32)return new Response('Unsubscribe temporarily unavailable',{status:503,headers});
  const params=new URL(request.url).searchParams,id=params.getAll('token').length===1?verifyUnsubscribe(params.get('token'),signingSecret):null;
  if(!id)return new Response('Invalid unsubscribe link',{status:400,headers});
  // Opening links is read-only; scanners cannot unsubscribe a reader by GET.
  if(request.method==='GET')return new Response(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"><title>Unsubscribe | Folkly</title></head><body><h1>Unsubscribe from Folkly</h1><form method="post"><button type="submit">Unsubscribe</button></form></body></html>`,{headers});
  try{await suppress(id);return new Response('<!doctype html><html lang="en"><head><title>Unsubscribed | Folkly</title></head><body><h1>You’re unsubscribed.</h1><p>You will no longer receive Folkly weekly updates.</p><a href="https://www.folkly.com">Return to Folkly</a></body></html>',{headers});}
  catch{return new Response('Could not save your preference. Please retry.',{status:503,headers});}
 };
}
export const GET=createUnsubscribeHandler({secret:()=>process.env.NEWSLETTER_SECRET,suppress:id=>newsletterStore.suppress(id)});
export const POST=GET;

import { createHash } from 'node:crypto';
const reply=(status,message)=>Response.json({message},{status,headers:{'Cache-Control':'no-store'}});
const reasons=new Set(['story-suggestion','correction','contributing','partnership','other']);
export function createContactHandler({configured,save}) {
  return async request=>{
    if(request.method!=='POST')return reply(405,'Please use the contact form.');
    if(request.headers.get('origin')!==new URL(request.url).origin)return reply(403,'Please contact us from the Folkly website.');
    if(Number(request.headers.get('content-length')||0)>8192)return reply(413,'Your message is too long.');
    let data;
    try {
      const text=await request.text();
      if(Buffer.byteLength(text)>8192)return reply(413,'Your message is too long.');
      const type=request.headers.get('content-type')||'';
      if(type.startsWith('application/json'))data=JSON.parse(text);
      else if(type.startsWith('application/x-www-form-urlencoded'))data=Object.fromEntries(new URLSearchParams(text));
      else return reply(415,'Please use the contact form.');
    }catch{return reply(400,'Please check your message and try again.');}
    if(!data||typeof data!=='object'||Array.isArray(data)||data.website)return reply(400,'Please use the contact form.');
    const name=typeof data.name==='string'?data.name.trim():'';
    const email=typeof data.email==='string'?data.email.trim().toLowerCase():'';
    const message=typeof data.message==='string'?data.message.trim():'';
    if(!name||name.length>100||/[\u0000-\u001f\u007f]/.test(name)||email.length>254||! /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)||!reasons.has(data.reason)||message.length<10||message.length>3000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(message)||!['yes',undefined].includes(data.contributor)||data.consent!=='yes')return reply(400,'Enter your name, a valid email, a reason and a message of 10–3,000 characters, and agree to contact storage.');
    if(!configured())return reply(503,'Contact is temporarily unavailable. Please try again later.');
    const record={name,email,reason:data.reason,message,contributor:data.contributor==='yes'||data.reason==='contributing',consent:true,consentVersion:'2026-10-08',source:'folkly-about'};
    const id=createHash('sha256').update(JSON.stringify(record)).digest('hex');
    try {
      await save('contacts/'+id+'.json',{...record,receivedAt:new Date().toISOString()});
      return reply(200,'Thank you. Your message has been saved for Folkly.');
    }catch{return reply(503,'Could not save your message. Please try again later.');}
  };
}
export const POST=createContactHandler({
  configured:()=>Boolean(process.env.BLOB_STORE_ID||process.env.BLOB_READ_WRITE_TOKEN),
  save:async(path,record)=>{
    const {put}=await import('@vercel/blob');
    await put(path,JSON.stringify(record),{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json'});
  },
});

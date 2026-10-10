import {get,put,list} from '@vercel/blob';
import {isDeepStrictEqual} from 'node:util';
import {readNewsletterRecord,validateSubscriber,validateSuppression,validNewsletterDate,newsletterRecordLimit} from './newsletter-records.js';

const options={access:'private',addRandomSuffix:false,contentType:'application/json',allowOverwrite:false};
const validId=id=>typeof id==='string'&&/^[a-f0-9]{64}$/.test(id);
const validCursor=value=>typeof value==='string'&&value.length<=2048&&/^[\x20-\x7e]+$/.test(value);
function deliveryReceipt(path) {
 const match=/^newsletter\/delivery\/(\d{4}-\d{2}-\d{2})\/([a-f0-9]{64})\.json$/.exec(path);
 if(!match||!validNewsletterDate(`${match[1]}T00:00:00.000Z`)||new Date(`${match[1]}T00:00:00.000Z`).getUTCDay()!==5)throw Error('Invalid delivery path');
 return `newsletter/receipts/${match[1]}/${match[2]}.json`;
}
function validateDelivery(record,{claimOnly=false,terminalOnly=false}={}) {
 if(!record||typeof record!=='object'||Array.isArray(record))throw Error('Invalid delivery record');
 const keys=Object.keys(record).sort().join(',');
 if(!terminalOnly&&record.state==='claimed'&&keys==='createdAt,state'&&validNewsletterDate(record.createdAt))return record;
 if(!claimOnly&&record.state==='suppressed'&&keys==='state')return record;
 if(!claimOnly&&record.state==='accepted'&&keys==='acceptedAt,providerId,state'&&validNewsletterDate(record.acceptedAt)&&typeof record.providerId==='string'&&/^[a-zA-Z0-9_-]{1,200}$/.test(record.providerId))return record;
 throw Error('Invalid delivery record');
}
export function createNewsletterStore({get,put,list}) {
 const readPrivate=path=>readNewsletterRecord(get,path);
 async function verifiedTerminal(path,record) {
  const existing=await readPrivate(path);
  if(existing){validateDelivery(existing,{terminalOnly:true});if(!isDeepStrictEqual(existing,record))throw Error('Conflicting receipt');return;}
  // Only exact readback can reconcile a transport failure after persistence.
  // This never permits another provider send.
  try{await put(path,JSON.stringify(record),{...options,abortSignal:AbortSignal.timeout(10000)});}catch{}
  const saved=await readPrivate(path);
  if(!saved||!isDeepStrictEqual(saved,record))throw Error('Receipt verification failed');
 }
 return {
  async subscribers(limit) {
   if(!Number.isSafeInteger(limit)||limit<1||limit>200)throw Error('Invalid subscriber bound');
   const paths=[],seen=new Set(),cursors=new Set();let cursor,pages=0;
   do {
    if(++pages>20)throw Error('Listing bound exceeded');
    const page=await list({prefix:'subscribers/',limit:100,...(cursor?{cursor}:{}),abortSignal:AbortSignal.timeout(10000)});
    if(!page||!Array.isArray(page.blobs)||page.blobs.length>100||typeof page.hasMore!=='boolean')throw Error('Invalid subscriber listing');
    for(const blob of page.blobs) {
     if(!blob||!/^subscribers\/[a-f0-9]{64}\.json$/.test(blob.pathname)||seen.has(blob.pathname)||(blob.size!==undefined&&(!Number.isSafeInteger(blob.size)||blob.size<0||blob.size>newsletterRecordLimit)))throw Error('Invalid subscriber listing');
     seen.add(blob.pathname);paths.push(blob.pathname);
    }
    if(paths.length>limit)throw Error('Subscriber capacity exceeded');
    if(page.hasMore) {
     if(!page.blobs.length||!validCursor(page.cursor)||cursors.has(page.cursor))throw Error('Incomplete subscriber listing');
     cursors.add(page.cursor);cursor=page.cursor;
    }else cursor=undefined;
   }while(cursor);
   return Promise.all(paths.map(async path=>{const id=path.slice(12,-5);return {id,record:validateSubscriber(await readPrivate(path),id)};}));
  },
  async suppressed(id) {
   if(!validId(id))throw Error('Invalid subscriber ID');
   const record=await readPrivate(`newsletter/suppressed/${id}.json`);
   return record?Boolean(validateSuppression(record)):false;
  },
  async claim(path,record) {
   const receipt=deliveryReceipt(path);validateDelivery(record,{claimOnly:true});
   const expected=JSON.parse(JSON.stringify(record)),existing=await readPrivate(path);
   if(existing){validateDelivery(existing);return false;}
   // An incomplete restore must not resend when only the terminal receipt survived.
   const terminal=await readPrivate(receipt);
   if(terminal){validateDelivery(terminal,{terminalOnly:true});return false;}
   try{await put(path,JSON.stringify(expected),{...options,abortSignal:AbortSignal.timeout(10000)});}
   catch {
    const saved=await readPrivate(path);
    if(saved){validateDelivery(saved);return false;} // Ambiguous claim stays held.
    throw Error('Claim persistence unavailable');
   }
   const saved=await readPrivate(path);
   if(!saved||!isDeepStrictEqual(saved,expected))throw Error('Claim verification failed');
   return true;
  },
  async finish(path,record) {
   const receipt=deliveryReceipt(path);validateDelivery(record,{terminalOnly:true});
   const expected=JSON.parse(JSON.stringify(record)),claim=await readPrivate(path);
   validateDelivery(claim);
   // Older deployments stored terminal state in the claim itself. Preserve it.
   if(claim.state!=='claimed') {
    if(!isDeepStrictEqual(claim,expected))throw Error('Conflicting delivery state');
    return;
   }
   await verifiedTerminal(receipt,expected);
  },
  async suppress(id) {
   if(!validId(id))throw Error('Invalid subscriber ID');
   const path=`newsletter/suppressed/${id}.json`,existing=await readPrivate(path);
   if(existing){validateSuppression(existing);return;}
   const record={unsubscribedAt:new Date().toISOString()};
   try{await put(path,JSON.stringify(record),{...options,abortSignal:AbortSignal.timeout(10000)});}catch{}
   // Concurrent requests share monotonic intent. Keep the first verified time.
   validateSuppression(await readPrivate(path));
  }
 };
}
export const newsletterStore=createNewsletterStore({get,put,list});

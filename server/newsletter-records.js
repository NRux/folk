import {createHash} from 'node:crypto';

export const newsletterRecordLimit=4096;
const emailPattern=/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;
export const validNewsletterDate=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
export function validateSubscriber(record,id) {
 if(!record||typeof record.email!=='string'||record.email.length>254||!emailPattern.test(record.email)||createHash('sha256').update(record.email.trim().toLowerCase()).digest('hex')!==id||record.consent!==true||!validNewsletterDate(record.subscribedAt)||typeof record.consentVersion!=='string'||!record.consentVersion.length||record.consentVersion.length>40||typeof record.source!=='string'||!record.source.length||record.source.length>80)throw Error('Invalid subscriber record');
 return record;
}
export function validateSuppression(record) {
 if(!record||!validNewsletterDate(record.unsubscribedAt))throw Error('Invalid suppression record');
 return record;
}

// Bound private bodies while streaming, before allocating the entire object.
export async function readNewsletterRecord(get,path) {
 const signal=AbortSignal.timeout(10000);
 const result=await get(path,{access:'private',useCache:false,abortSignal:signal});
 if(!result)return null;
 if(result.statusCode!==200||!result.stream?.getReader)throw Error('Private read unavailable');
 const reader=result.stream.getReader(),chunks=[];let size=0,complete=false;
 const abort=()=>{void reader.cancel().catch(()=>{});};
 signal.addEventListener('abort',abort,{once:true});
 try {
  if(result.blob?.size!==undefined&&(!Number.isSafeInteger(result.blob.size)||result.blob.size<0||result.blob.size>newsletterRecordLimit))throw Error('Invalid record size');
  while(true) {
   signal.throwIfAborted();const {done,value}=await reader.read();signal.throwIfAborted();
   if(done){complete=true;break;}
   if(!(value instanceof Uint8Array)||(size+=value.byteLength)>newsletterRecordLimit)throw Error('Record too large');
   chunks.push(value);
  }
  const record=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,size)));
  if(!record||typeof record!=='object'||Array.isArray(record))throw Error('Invalid private record');
  return record;
 }finally {
  signal.removeEventListener('abort',abort);
  if(!complete)await reader.cancel().catch(()=>{});
  reader.releaseLock();
 }
}

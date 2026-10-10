import {readNewsletterRecord,validateSubscriber,validateSuppression} from './newsletter-records.js';
// Called only through the authenticated owner dashboard.
export async function readSubscriberInbox({env=process.env,storage,cursor}={}) {
  if(!env.BLOB_STORE_ID&&!env.BLOB_READ_WRITE_TOKEN)return {available:false,rows:[]};
  if(cursor!==undefined&&(typeof cursor!=='string'||cursor.length>2048||!/^[\x20-\x7e]+$/.test(cursor)))return {available:false,rows:[]};
  try{
    const sdk=storage||await import('@vercel/blob');
    const result=await sdk.list({prefix:'subscribers/',limit:20,...(cursor?{cursor}:{}),abortSignal:AbortSignal.timeout(10000)});
    if(!Array.isArray(result.blobs)||result.blobs.length>20||typeof result.hasMore!=='boolean')throw Error();
    const seen=new Set();
    const rows=await Promise.all(result.blobs.map(async blob=>{
      const match=/^subscribers\/([a-f0-9]{64})\.json$/.exec(blob.pathname);
      if(!match||seen.has(blob.pathname)||!Number.isSafeInteger(blob.size)||blob.size<0||blob.size>4096)throw Error();
      seen.add(blob.pathname);
      const record=validateSubscriber(await readNewsletterRecord(sdk.get.bind(sdk),blob.pathname),match[1]);
      const suppression=await readNewsletterRecord(sdk.get.bind(sdk),`newsletter/suppressed/${match[1]}.json`);
      if(suppression)validateSuppression(suppression);
      return {email:record.email,status:suppression?'Unsubscribed':'Subscribed',subscribedAt:record.subscribedAt,consentVersion:record.consentVersion,source:record.source};
    }));
    if(result.hasMore&&(!result.blobs.length||typeof result.cursor!=='string'||result.cursor.length>2048||!/^[\x20-\x7e]+$/.test(result.cursor)||result.cursor===cursor))throw Error();
    return {available:true,rows,hasMore:!!result.hasMore,nextCursor:result.hasMore?result.cursor:null};
  }catch{return {available:false,rows:[]};}
}

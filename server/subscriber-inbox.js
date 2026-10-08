import {createHash} from 'node:crypto';
// Called only through the authenticated owner dashboard.
const emailPattern=/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;
export async function readSubscriberInbox({env=process.env,storage,cursor}={}) {
  if(!env.BLOB_STORE_ID&&!env.BLOB_READ_WRITE_TOKEN)return {available:false,rows:[]};
  if(cursor!==undefined&&(typeof cursor!=='string'||cursor.length>2048||!/^[\x20-\x7e]+$/.test(cursor)))return {available:false,rows:[]};
  try{
    const sdk=storage||await import('@vercel/blob');
    const result=await sdk.list({prefix:'subscribers/',limit:20,...(cursor?{cursor}:{})});
    if(!Array.isArray(result.blobs)||result.blobs.length>20)throw Error();
    const rows=await Promise.all(result.blobs.map(async blob=>{
      const match=/^subscribers\/([a-f0-9]{64})\.json$/.exec(blob.pathname);
      if(!match||!Number.isFinite(blob.size)||blob.size>4096)throw Error();
      const file=await sdk.get(blob.pathname,{access:'private',useCache:false});
      if(file?.statusCode!==200)throw Error();
      const text=await new Response(file.stream).text();if(Buffer.byteLength(text)>4096)throw Error();
      const record=JSON.parse(text);
      if(typeof record.email!=='string'||record.email.length>254||!emailPattern.test(record.email)||createHash('sha256').update(record.email.trim().toLowerCase()).digest('hex')!==match[1]||record.consent!==true||typeof record.subscribedAt!=='string'||!Number.isFinite(Date.parse(record.subscribedAt))||typeof record.consentVersion!=='string'||record.consentVersion.length>40||typeof record.source!=='string'||record.source.length>80)throw Error();
      const suppression=await sdk.get(`newsletter/suppressed/${match[1]}.json`,{access:'private',useCache:false});
      if(suppression&&suppression.statusCode!==200)throw Error();
      return {email:record.email,status:suppression?'Unsubscribed':'Subscribed',subscribedAt:record.subscribedAt,consentVersion:record.consentVersion,source:record.source};
    }));
    if(result.hasMore&&(typeof result.cursor!=='string'||result.cursor.length>2048||!/^[\x20-\x7e]+$/.test(result.cursor)||result.cursor===cursor))throw Error();
    return {available:true,rows,hasMore:!!result.hasMore,nextCursor:result.hasMore?result.cursor:null};
  }catch{return {available:false,rows:[]};}
}

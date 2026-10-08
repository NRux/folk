// Called only through the authenticated owner dashboard.
export async function readContactInbox({env=process.env,storage,cursor}={}) {
  if(!env.BLOB_STORE_ID&&!env.BLOB_READ_WRITE_TOKEN)return {available:false,rows:[]};
  if(cursor!==undefined&&(typeof cursor!=='string'||cursor.length>2048||!/^[\x20-\x7e]+$/.test(cursor)))return {available:false,rows:[]};
  try{
    const sdk=storage||await import('@vercel/blob');
    const result=await sdk.list({prefix:'contacts/',limit:20,...(cursor?{cursor}:{})});
    if(!Array.isArray(result.blobs)||result.blobs.length>20)throw Error();
    const rows=await Promise.all(result.blobs.map(async blob=>{
      if(!/^contacts\/[a-f0-9]{64}\.json$/.test(blob.pathname)||!Number.isFinite(blob.size)||blob.size>8192)throw Error();
      const file=await sdk.get(blob.pathname,{access:'private',useCache:false});
      if(file?.statusCode!==200)throw Error();
      const text=await new Response(file.stream).text();if(Buffer.byteLength(text)>8192)throw Error();
      const r=JSON.parse(text);
      if(typeof r.name!=='string'||!r.name.trim()||r.name.length>100||typeof r.email!=='string'||r.email.length>254||!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(r.email)||typeof r.message!=='string'||r.message.length>3000||!['story-suggestion','correction','contributing','partnership','other'].includes(r.reason)||typeof r.contributor!=='boolean'||typeof r.receivedAt!=='string'||!Number.isFinite(Date.parse(r.receivedAt)))throw Error();
      return {name:r.name,email:r.email,reason:r.reason,message:r.message,contributor:r.contributor?'Yes':'No',receivedAt:r.receivedAt};
    }));
    if(result.hasMore&&(typeof result.cursor!=='string'||result.cursor.length>2048||!/^[\x20-\x7e]+$/.test(result.cursor)||result.cursor===cursor))throw Error();
    return {available:true,rows,hasMore:!!result.hasMore,nextCursor:result.hasMore?result.cursor:null};
  }catch{return {available:false,rows:[]};}
}

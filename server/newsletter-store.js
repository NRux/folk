import { get, put, list } from '@vercel/blob';
const options={access:'private',addRandomSuffix:false,contentType:'application/json'};
export function createNewsletterStore({get,put,list}) {
async function readPrivate(path) {
 const result=await get(path,{access:'private',useCache:false});
 if(!result)return null;
 if(result.statusCode!==200)throw Error('Private read unavailable');
 const text=await new Response(result.stream).text();
 if(Buffer.byteLength(text)>4096)throw Error('Record too large');
 return JSON.parse(text);
}
return {
 async subscribers(limit){
  const paths=[];let cursor,pages=0;
  do {if(++pages>20)throw Error('Listing bound exceeded');const page=await list({prefix:'subscribers/',limit:100,cursor});
   for(const blob of page.blobs){if(/^subscribers\/[a-f0-9]{64}\.json$/.test(blob.pathname))paths.push(blob.pathname);}
   if(paths.length>limit)throw Error('Subscriber capacity exceeded');
   cursor=page.hasMore?page.cursor:undefined;
  }while(cursor);
  return Promise.all(paths.map(async path=>({id:path.slice(12,-5),record:await readPrivate(path)})));
 },
 async suppressed(id){return Boolean(await readPrivate(`newsletter/suppressed/${id}.json`));},
 async claim(path,record){
  try{await put(path,JSON.stringify(record),{...options,allowOverwrite:false});return true;}
  catch(error){if(await readPrivate(path))return false;throw error;}
 },
 async finish(path,record){await put(path,JSON.stringify(record),{...options,allowOverwrite:true});},
 async suppress(id){await put(`newsletter/suppressed/${id}.json`,JSON.stringify({unsubscribedAt:new Date().toISOString()}),{...options,allowOverwrite:true});}
};

}
export const newsletterStore=createNewsletterStore({get,put,list});

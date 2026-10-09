import {get,put,list} from '@vercel/blob';
const prefix='owner-workspace/';
const options={access:'private',addRandomSuffix:false,contentType:'application/json'};
const conflict=()=>Object.assign(Error('Revision conflict'),{code:'CONFLICT'});
export function createWorkspaceStore(blob={get,put,list}){
 async function read(kind,id){const result=await blob.get(`${prefix}${kind}/${id}.json`,{access:'private',useCache:false});if(!result||result.statusCode!==200)throw Error('Private read unavailable');const text=await new Response(result.stream).text();if(Buffer.byteLength(text)>24000)throw Error('Record too large');return {...JSON.parse(text),etag:result.blob.etag};}
 return {
 read,
 async list(kind){let cursor,all=[];do{const page=await blob.list({prefix:`${prefix}${kind}/`,limit:100,...(cursor?{cursor}:{})});all.push(...page.blobs);if(page.hasMore&&(!page.cursor||all.length>=1000))throw Error('Workspace capacity exceeded');cursor=page.hasMore?page.cursor:undefined;}while(cursor);const paths=all.filter(b=>/\/[a-f0-9-]{36}\.json$/.test(b.pathname));const rows=await Promise.all(paths.map(b=>read(kind,b.pathname.split('/').at(-1).slice(0,-5))));const sorted=rows.sort((a,b)=>(b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||''));return kind==='chat'?sorted.slice(0,100):sorted;},
 async save(kind,id,record,etag){
  try{
   const result=await blob.put(`${prefix}${kind}/${id}.json`,JSON.stringify(record),{...options,allowOverwrite:Boolean(etag),...(etag?{ifMatch:etag}:{})});
   if(kind==='ideas'){
    try{const saved=await read(kind,id);if(!saved.etag||saved.etag!==result.etag||Object.entries(record).some(([key,value])=>saved[key]!==value))throw Error();return saved;}
    catch{throw Object.assign(Error('Save readback unavailable'),{code:'SAVE_UNVERIFIED'});}
   }
   return {...record,etag:result.etag};
  }
  catch(error){if(error.name==='BlobPreconditionFailedError')throw conflict();throw error;}
 },
 async reserve(date,id){
  const day=date.toISOString().slice(0,10);
  for(let slot=0;slot<20;slot++){
   const path=`${prefix}chat-budget/${day}/${slot}.json`;
   const existing=await blob.get(path,{access:'private',useCache:false});if(existing)continue;
   try{await blob.put(path,JSON.stringify({attempt:id,reservedUSD:0.15}),{...options,allowOverwrite:false});return;}catch{if(await blob.get(path,{access:'private',useCache:false}))continue;throw Error('Budget unavailable');}
  }
  throw Error('Daily editor chat budget exhausted');
 }
 };
}

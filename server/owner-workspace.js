import {createContentStore} from './content-store.js';
import {randomUUID} from 'node:crypto';
import {editorCompletionDiagnostics} from './editor-completion.js';
const uuid=value=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value||'');
const reply=(status,data)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export function workspaceFaultCode(error,stage){
 const known=['CONFLICT','SAVE_UNVERIFIED','EDITOR_NOT_CONFIGURED','BUDGET_EXHAUSTED','BUDGET_UNAVAILABLE'];
 if(known.includes(error?.code))return error.code;
 const blob={BlobAccessError:'BLOB_ACCESS_DENIED',BlobStoreNotFoundError:'BLOB_STORE_NOT_FOUND',BlobStoreSuspendedError:'BLOB_STORE_SUSPENDED',BlobServiceRateLimited:'BLOB_RATE_LIMITED',BlobServiceNotAvailable:'BLOB_UNAVAILABLE'};
 if(Object.hasOwn(blob,error?.name||''))return blob[error.name];
 if(stage==='provider')return [401,403].includes(error?.statusCode)?'MODEL_CREDENTIALS_REJECTED':error?.statusCode===429?'MODEL_RATE_OR_QUOTA_LIMIT':error?.statusCode===404?'MODEL_UNAVAILABLE':error?.statusCode===400?'MODEL_REQUEST_REJECTED':['AbortError','TimeoutError'].includes(error?.name)?'MODEL_TIMEOUT':error?.code==='OUTPUT_LIMIT'?'MODEL_OUTPUT_LIMIT':error?.code==='CONTENT_FILTER'?'MODEL_CONTENT_FILTER':error?.code==='EMPTY_REPLY'?'MODEL_EMPTY_REPLY':'MODEL_UNAVAILABLE';
 return stage==='budget'?'BUDGET_UNAVAILABLE':stage==='chat-history'?'CHAT_HISTORY_UNAVAILABLE':'WORKSPACE_STORAGE_UNAVAILABLE';
}
export function workspaceConfiguration(env=process.env){
 const missing=[];
 if(env.FOLKLY_EDITOR_CHAT_ENABLED!=='true')missing.push('FOLKLY_EDITOR_CHAT_ENABLED=true');
 if(!env.OPENAI_API_KEY)missing.push('OPENAI_API_KEY');
 if(!env.BLOB_STORE_ID&&!env.BLOB_READ_WRITE_TOKEN)missing.push('private Blob connection');
 return {available:missing.length===0,message:missing.length?'Editor chat needs: '+missing.join(', ')+'. Redeploy after configuring them.':'Editor ready.',missing};
}
export function createWorkspaceHandlers({authorize,store,drafts,chat,configured,configuration=()=>({available:configured(),message:configured()?'Editor ready.':'Editor chat requires funded OpenAI access and FOLKLY_EDITOR_CHAT_ENABLED=true.'}),now=()=>new Date(),reportFault=data=>console.error('Owner workspace failure',data)}) {
 async function access(request){try{return await authorize(request);}catch{return null;}}
 return {
 async GET(request){
  const owner=await access(request);if(!owner)return reply(401,{message:'Owner sign-in required.'});
  try{
   const params=new URL(request.url).searchParams,id=params.get('draft');
   if(params.has('draft')||params.has('version')){
    const version=params.get('version');
    if(!/^[a-z0-9_-]{1,100}$/i.test(id||'')||[...params.keys()].some(k=>!['draft','version'].includes(k))||params.getAll('draft').length!==1||params.getAll('version').length>1||
     (params.has('version')&&(!/^[1-9]\d{0,3}$/.test(version)||Number(version)>9999)))return reply(400,{message:'Choose an article and a valid saved version.'});
    try{return reply(200,{draft:await drafts(owner.db,id,undefined,{version:params.has('version')?Number(version):undefined})});}
    catch(error){return reply(error?.code==='DRAFT_NOT_FOUND'?404:503,{message:error?.code==='DRAFT_NOT_FOUND'?'That article or saved version is unavailable. Refresh the article list.':'Private saved content could not be verified. No records were changed.'});}
   }
   const [ideas,history]=await Promise.allSettled([store.list('ideas'),store.list('chat')]);
   const readiness=configuration();
   return reply(200,{ideas:ideas.status==='fulfilled'?ideas.value:[],chat:history.status==='fulfilled'?history.value:[],ideasAvailable:ideas.status==='fulfilled',chatHistoryAvailable:history.status==='fulfilled',chatAvailable:readiness.available&&history.status==='fulfilled',configuration:readiness,ideasMessage:ideas.status==='fulfilled'?'':'Idea storage unavailable. Unsaved text is retained in this page.',chatMessage:history.status==='fulfilled'?readiness.message:'Editor history storage unavailable. Refresh before sending.'});
  }catch{return reply(503,{message:'Private workspace unavailable. No records were changed.'});}
 },
 async POST(request){
  if(request.headers.get('origin')!==new URL(request.url).origin)return reply(403,{message:'Use the owner workspace.'});
  const owner=await access(request);if(!owner)return reply(401,{message:'Owner sign-in required.'});
  const requestId=randomUUID();let stage='request',action='unknown';
  function failure(error,message){const code=workspaceFaultCode(error,stage),status=code==='CONFLICT'?409:503;try{reportFault({requestId,action,stage,code,status,...(stage==='provider'&&['MODEL_EMPTY_REPLY','MODEL_OUTPUT_LIMIT','MODEL_CONTENT_FILTER'].includes(code)&&error?.completion?{completion:editorCompletionDiagnostics(error.completion)}:{})});}catch{}return reply(status,{code,stage,requestId,message:message+' Reference: '+requestId+'.'});}
  try{
   const text=await request.text();if(Buffer.byteLength(text)>16000)return reply(413,{message:'Request too large.'});
   let data;try{data=JSON.parse(text);}catch{return reply(400,{message:'Invalid request.'});}
   if(data?.action==='idea'){
    action='idea';stage='idea-save';
    const row=data.idea;
    if(!row||!uuid(row.id)||!['title','place','angle','sources','notes'].every(k=>typeof row[k]==='string'&&row[k].length<=2000)||!row.title.trim()||!['Normal','High','Low'].includes(row.priority)||!['Idea','Research','Drafting','Hold'].includes(row.status))return reply(400,{message:'Check the idea fields.'});
    if(data.etag!==undefined&&(typeof data.etag!=='string'||data.etag.length>200))return reply(400,{message:'Invalid revision.'});
    const record=Object.fromEntries(['id','title','place','angle','sources','notes','priority','status'].map(k=>[k,row[k]]));record.updatedAt=now().toISOString();
    const saved=await store.save('ideas',row.id,record,data.etag);return reply(200,{idea:saved});
   }
   if(data?.action==='chat'){
    action='chat';stage='configuration';
    if(!configured())return failure({code:'EDITOR_NOT_CONFIGURED'},configuration().message);
    if(!uuid(data.id)||typeof data.message!=='string'||!data.message.trim()||Buffer.byteLength(data.message)>6000)return reply(400,{message:'Enter a message up to 6,000 bytes.'});
    // Durable create-only attempt claims prevent retries from spending again.
    stage='attempt-save';await store.save('chat',data.id,{id:data.id,message:data.message,state:'pending',createdAt:now().toISOString()});
    stage='budget';
    await store.reserve(now(),data.id);
    try{
     stage='chat-history';const history=await store.list('chat');
     stage='provider';const result=await chat(data.message,history);
     if(typeof result?.text!=='string'||!result.text.trim())throw Object.assign(Error('Empty editor reply'),{code:'EMPTY_REPLY'});
     stage='reply-read';const previous=await store.read('chat',data.id);
     stage='reply-save';
     const saved=await store.save('chat',data.id,{id:data.id,message:data.message,response:result.text,state:'complete',createdAt:now().toISOString(),usage:result.usage},previous.etag);
     return reply(200,{turn:saved});
    }catch(error){
     const reason=[401,403].includes(error.statusCode)?'The model provider rejected its credentials.':error.statusCode===429?'The model provider reported a rate or funded-quota limit.':error.statusCode===404?'The configured editor model is unavailable to this provider account.':['AbortError','TimeoutError'].includes(error.name)?'The editor request timed out.':error.code==='OUTPUT_LIMIT'?'The editor reached its response limit before completing a reply. Ask for a shorter answer or one section at a time.':error.code==='CONTENT_FILTER'?'The provider could not return this reply under its safety policy. Rephrase the request.':error.code==='EMPTY_REPLY'?'The model returned no editor text.':'The model call or private reply persistence failed.';
     return failure(error,reason+' The attempt is retained to prevent duplicate charges. Refresh to inspect it.');
    }
   }
   return reply(400,{message:'Unknown workspace action.'});
  }catch(error){return failure(error,error.code==='BUDGET_EXHAUSTED'?'The daily editor chat budget is exhausted. Existing attempts stay saved; try after the next UTC budget day.':stage==='budget'?'The editor budget could not be reserved. No model call was made; check private Blob storage before retrying.':error.code==='SAVE_UNVERIFIED'?'The write returned, but its saved contents could not be verified. Keep your text and refresh to check before retrying.':error.code==='CONFLICT'?'This record changed or this request was already saved. Refresh before retrying.':'Private Blob save unavailable. Keep your text; check the existing project’s private Blob connection and refresh before retrying.');}
 }
 };
}
export async function readDraft(db,id,contentStore=createContentStore(),{version:selectedVersion}={}){
 if(selectedVersion!==undefined&&(!Number.isSafeInteger(selectedVersion)||selectedVersion<1||selectedVersion>9999))throw Error('Invalid saved version');
 const notFound=()=>Object.assign(Error('Saved version unavailable'),{code:'DRAFT_NOT_FOUND'});
 const article=await db.from('folkly_articles').select('id,title,status').eq('id',id).maybeSingle();if(article.error)throw Error('Private article metadata unavailable');if(!article.data)throw notFound();
 // Read only bounded history metadata; fetch one body and one private pointer.
 const history=await db.from('folkly_article_versions').select('id,version,created_at').eq('article_id',id).order('version',{ascending:false}).limit(101);
 if(history.error||!Array.isArray(history.data)||history.data.length>100)throw Error('Private version history unavailable');
 if(!history.data.length)throw notFound();
 const identities=new Set(),numbers=new Set();
 for(const item of history.data){
  if(typeof item.id!=='string'||!item.id||!Number.isSafeInteger(item.version)||item.version<1||item.version>9999||!Number.isFinite(Date.parse(item.created_at))||identities.has(item.id)||numbers.has(item.version))throw Error('Invalid saved version history');
  identities.add(item.id);numbers.add(item.version);
 }
 const rows=history.data.slice().sort((a,b)=>b.version-a.version),target=selectedVersion===undefined?rows[0]:rows.find(v=>v.version===selectedVersion);
 if(!target)throw notFound();
 const result=await db.from('folkly_article_versions').select('id,version,content_json,created_at').eq('article_id',id).eq('id',target.id).maybeSingle();
 const version=result.data;if(result.error||!version||version.id!==target.id||version.version!==target.version||version.created_at!==target.created_at)throw Error('Saved version changed during read');
 const pointer=await db.from('folkly_content_objects').select('pathname,sha256,byte_size,verified_at').eq('article_version_id',version.id).maybeSingle();
 if(pointer.error)throw Error('Private content index unavailable');
 const content=pointer.data?await contentStore.read(pointer.data):version.content_json;
 if(typeof content!=='string'||!content.length||Buffer.byteLength(content)>200000)throw Error('Invalid draft');
 JSON.parse(content);
 return {title:article.data.title,status:article.data.status,version:version.version,versionId:version.id,createdAt:version.created_at,
  versions:rows.map(row=>({version:row.version,createdAt:row.created_at})),content};
}

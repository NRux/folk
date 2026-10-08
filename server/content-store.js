import {get,put} from '@vercel/blob';
import {createHash} from 'node:crypto';
export const contentHash=text=>createHash('sha256').update(text).digest('hex');
export const contentPath=hash=>{if(!/^[a-f0-9]{64}$/.test(hash||''))throw Error('Invalid content checksum');return `editorial/versions/${hash}.json`;};
function createObjectStore(blob,prefix,maxBytes){
 const pathFor=hash=>{if(!/^[a-f0-9]{64}$/.test(hash||''))throw Error('Invalid content checksum');return prefix+hash+'.json';};
 async function read(reference){
  if(reference.pathname!==pathFor(reference.sha256)||!Number.isSafeInteger(reference.byte_size)||reference.byte_size<1||reference.byte_size>maxBytes)throw Error('Invalid content reference');
  const result=await blob.get(reference.pathname,{access:'private',useCache:false});if(!result||result.statusCode!==200)throw Error('Private content unavailable');
  const reader=result.stream.getReader();let size=0;const chunks=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>reference.byte_size||size>maxBytes)throw Error('Content size mismatch');chunks.push(Buffer.from(value));}}catch(error){await reader.cancel().catch(()=>{});throw error;}
  const bytes=Buffer.concat(chunks);if(size!==reference.byte_size||contentHash(bytes)!==reference.sha256)throw Error('Content checksum mismatch');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);JSON.parse(text);return text;
 }
 async function upload(text){
  if(typeof text!=='string'||!text.length||Buffer.byteLength(text)>maxBytes)throw Error('Invalid content size');JSON.parse(text);
  const sha256=contentHash(text),reference={pathname:pathFor(sha256),sha256,byte_size:Buffer.byteLength(text)};
  try{await blob.put(reference.pathname,text,{access:'private',addRandomSuffix:false,allowOverwrite:false,contentType:'application/json'});}catch(error){try{await read(reference);}catch{throw error;}}
  await read(reference);return {...reference,verified_at:new Date().toISOString()};
 }
 return {read,upload};
}

export const createContentStore=(blob={get,put})=>createObjectStore(blob,'editorial/versions/',200000);
export const createSnapshotStore=(blob={get,put})=>createObjectStore(blob,'editorial/backups/',10000000);

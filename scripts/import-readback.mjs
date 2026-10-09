import {isDeepStrictEqual} from 'node:util';
import {validatedImportRecords,TABLES,digest} from './supabase-snapshot.mjs';
import {contentPath} from '../server/content-store.js';

export const SWITCH_KEYS=['production.autonomous_enabled','publication.autonomous_enabled','schedule.enabled'];
const OBJECT_COLUMNS=['article_version_id','pathname','sha256','byte_size','verified_at'];
const MAX_ROWS=10000;
const keyColumn=table=>table==='page_blocks'?'slug':table==='content_objects'?'article_version_id':table==='settings'?'key':'id';
const ordered=rows=>rows.map(row=>Object.fromEntries(Object.keys(row).sort().map(k=>[k,row[k]])));
const rowKey=value=>JSON.stringify(value);

// The adapter exposes SELECT only. Names come from this fixed private allowlist.
export function createImportReader(client){
 return async ({table,columns,offset,limit})=>{
  if(![...TABLES,'content_objects','settings'].includes(table))throw Error('Unknown readback table');
  let query=client.from('folkly_'+table).select(columns.join(','),{count:'exact'});
  if(table==='settings')query=query.in('key',SWITCH_KEYS);
  const result=await query.order(keyColumn(table),{ascending:true}).range(offset,offset+limit-1);
  if(result.error)throw Error('Private database readback unavailable');
  return {rows:result.data,count:result.count};
 };
}

async function readRows(readPage,table,columns,pageSize){
 const rows=[],keys=new Set();let total;
 for(let offset=0;;offset+=pageSize){
  let page;try{page=await readPage({table,columns,offset,limit:pageSize});}catch{throw Error('Database readback unavailable: '+table);}
  if(!page||!Array.isArray(page.rows)||page.rows.length>pageSize||!Number.isSafeInteger(page.count)||page.count<0||page.count>MAX_ROWS)throw Error('Invalid readback page: '+table);
  if(total===undefined)total=page.count;
  if(total!==page.count||rows.length+page.rows.length>total)throw Error('Readback changed during pagination: '+table);
  for(const row of page.rows){
   if(!row||Object.keys(row).sort().join()!==[...columns].sort().join())throw Error('Invalid readback columns: '+table);
   const key=row[keyColumn(table)];
   if(!(typeof key==='string'&&key.length>0)&&!(Number.isSafeInteger(key)&&key>0))throw Error('Invalid readback identity: '+table);
   if(keys.has(rowKey(key)))throw Error('Duplicate readback identity: '+table);
   keys.add(rowKey(key));rows.push(row);
  }
  if(rows.length===total)break;
  if(page.rows.length!==pageSize)throw Error('Incomplete readback page: '+table);
 }
 // Client-side canonical ordering avoids depending on database text collation.
 return rows.sort((a,b)=>rowKey(a[keyColumn(table)]).localeCompare(rowKey(b[keyColumn(table)]),'en'));
}

const compareRows=(actual,expected,table)=>{
 const byKey=new Map(expected.map(row=>[rowKey(row[keyColumn(table)]),row]));
 if(actual.length!==byKey.size)throw Error('Destination count mismatch: '+table);
 for(const row of actual)if(!isDeepStrictEqual(row,byKey.get(rowKey(row[keyColumn(table)]))))throw Error('Destination record mismatch: '+table);
};

export async function verifyImportedSnapshot(snapshot,options,{readPage,contentStore,snapshotStore,mode='blob',pageSize=100}={}){
 // Validate the independent source receipt before making any destination call.
 const {records,columns,sourceSha,published,private:privateStories}=validatedImportRecords(snapshot,options);
 if(!['blob','sql'].includes(mode)||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>1000||typeof readPage!=='function')throw Error('Invalid verification configuration');
 if(mode==='blob'&&(!contentStore?.read||!snapshotStore?.read))throw Error('Private Blob readback configuration required');
 const expected=structuredClone(records);
 if(mode==='blob')for(const version of expected.article_versions)version.content_json='';
 const switches=()=>readRows(readPage,'settings',['key','value'],pageSize);
 const assertPaused=rows=>{
  if(rows.length!==3||SWITCH_KEYS.some(key=>rows.find(r=>r.key===key)?.value!=='false'))throw Error('Editorial switches must remain paused');
 };
 assertPaused(await switches());
 let firstReferenceHash;
 // Two complete independent sweeps detect drift across paginated/Blob reads.
 // This is verification of a quiescent import, not a database snapshot transaction.
 for(let pass=0;pass<2;pass++){
  for(const table of TABLES)compareRows(await readRows(readPage,table,columns[table],pageSize),expected[table],table);
  const refs=await readRows(readPage,'content_objects',OBJECT_COLUMNS,pageSize);
  if(mode==='sql'&&refs.length!==0)throw Error('Unexpected Blob references in SQL import');
  if(mode==='blob'){
   if(refs.length!==records.article_versions.length)throw Error('Incomplete Blob reference readback');
   const versions=new Map(records.article_versions.map(v=>[v.id,v]));
   for(const ref of refs){
    const version=versions.get(ref.article_version_id),hash=version&&digest(version.content_json);
    if(!version||ref.sha256!==hash||ref.pathname!==contentPath(hash)||ref.byte_size!==Buffer.byteLength(version.content_json)||!Number.isFinite(Date.parse(ref.verified_at)))throw Error('Blob reference mismatch');
    if(pass===0){
     let text;try{text=await contentStore.read(ref);}catch{throw Error('Private version readback failed');}
     if(text!==version.content_json)throw Error('Private version content mismatch');
    }
   }
   const fingerprint=digest(ordered(refs));
   if(pass===0){
    firstReferenceHash=fingerprint;
    const text=JSON.stringify(snapshot),sha256=digest(text),reference={pathname:'editorial/backups/'+sha256+'.json',sha256,byte_size:Buffer.byteLength(text)};
    let backup;try{backup=await snapshotStore.read(reference);}catch{throw Error('Private backup readback failed');}
    if(backup!==text)throw Error('Private backup content mismatch');
   }else if(fingerprint!==firstReferenceHash)throw Error('Blob references changed during verification');
  }
  assertPaused(await switches());
 }
 // Safe receipt only: never return titles, slugs, row IDs, bodies, paths or secrets.
 return {format:'folkly-import-readback-v1',sourceSha,counts:Object.fromEntries(TABLES.map(t=>[t,records[t].length])),publishedCount:published.length,privateCount:privateStories.length,mode,verifiedVersions:records.article_versions.length,backupVerified:mode==='blob',sweeps:2,switchesPaused:true};
}

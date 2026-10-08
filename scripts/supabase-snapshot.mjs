import {contentPath} from '../server/content-store.js';
// Offline compiler only. Private snapshot and generated SQL never belong in Git/dist.
import {createHash} from 'node:crypto';
export const TABLES=['personas','persona_briefs','pitches','articles','article_versions','assignments','page_blocks','sources','claim_citations','media_assets','editorial_checks'];
export const digest=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const literal=value=>{if(value===null)return 'NULL';if(typeof value==='number'&&Number.isFinite(value))return String(value);if(typeof value==='string'&&!value.includes('\0'))return "'"+value.replaceAll("'","''")+"'";throw Error('Invalid scalar');};
const json=value=>literal(JSON.stringify(value))+'::jsonb';
export function compileSnapshot(snapshot,{expectedSha,expectedCounts,schema,manifest,catalog,contentObjects}){
 if(snapshot?.format!=='folkly-d1-snapshot-v1'||snapshot.release_state!=='unpublished')throw Error('Unsupported snapshot');
 const {sha256,...payload}=snapshot;
 if(!/^[a-f0-9]{64}$/.test(expectedSha||'')||sha256!==expectedSha||digest(payload)!==sha256)throw Error('Independent snapshot checksum mismatch');
 if(Object.keys(snapshot.records||{}).sort().join()!==[...TABLES].sort().join())throw Error('Unexpected snapshot tables');
 const records=structuredClone(snapshot.records),columns={};
 for(const table of TABLES){
  const definition=schema.match(new RegExp(`CREATE TABLE public.folkly_${table} \\(([\\s\\S]*?)\\);`))?.[1];if(!definition)throw Error('Missing trusted schema');
  columns[table]=[...definition.matchAll(/(?:^|\n|,)\s*([a-z_][a-z_0-9]*)\s+(?:TEXT|INTEGER|BIGINT|DOUBLE PRECISION)\b/g)].map(m=>m[1]);
  const rows=records[table];if(!Array.isArray(rows)||rows.length>10000||expectedCounts?.[table]!==rows.length)throw Error('Independent source count mismatch: '+table);
  const keys=new Set();for(const row of rows){
   if(!row||Object.keys(row).sort().join()!==[...columns[table]].sort().join())throw Error('Incomplete or unknown columns: '+table);
   for(const value of Object.values(row))literal(value);
   const key=table==='page_blocks'?row.slug:row.id;if(key===undefined||keys.has(key))throw Error('Duplicate record: '+table);keys.add(key);
  }
 }
 const published=new Set(catalog.filter(a=>a.status==='published').map(a=>a.slug));const release=new Map(manifest.articles.map(a=>[a.slug,a]));
 if(published.size!==catalog.filter(a=>a.status==='published').length||release.size!==manifest.articles.length)throw Error('Duplicate publication catalog');
 for(const article of records.articles){
  const versions=records.article_versions.filter(v=>v.article_id===article.id).sort((a,b)=>b.version-a.version);
  if(!versions.length||versions.some(v=>!Number.isSafeInteger(v.version)||v.version<1))throw Error('Missing article version');
  for(const version of versions){try{JSON.parse(version.content_json);}catch{throw Error('Truncated or invalid version JSON');}}
  if(digest(versions[0].content_json)!==article.content_hash)throw Error('Latest content hash mismatch');
  if(article.status==='published'&&!published.has(article.slug))throw Error('Unexpected published story');
  const authorized=release.get(article.slug);
  if(authorized){const version=versions.find(v=>v.id===authorized.versionId);if(!published.has(article.slug)||!version||digest(version.content_json)!==authorized.contentHash)throw Error('Manual release/version mismatch');article.status='published';article.pipeline_state='published';}
 }
 const importedPublic=new Set(records.articles.filter(a=>a.status==='published').map(a=>a.slug));if([...published].some(slug=>!importedPublic.has(slug)))throw Error('Missing published catalog story');
 const versions=new Set(records.article_versions.map(v=>v.id));const articleIds=new Set(records.articles.map(a=>a.id));
 if(records.article_versions.some(v=>!articleIds.has(v.article_id)))throw Error('Orphan article version');
 for(const table of ['sources','claim_citations','editorial_checks'])if(records[table].some(r=>!versions.has(r.article_version_id)))throw Error('Orphan evidence');
 let objects;
 if(contentObjects){
  if(!Array.isArray(contentObjects)||contentObjects.length!==records.article_versions.length)throw Error('Incomplete Blob references');
  const references=new Map(contentObjects.map(r=>[r.article_version_id,r]));if(references.size!==contentObjects.length)throw Error('Duplicate Blob references');
  objects=records.article_versions.map(version=>{const ref=references.get(version.id);const hash=digest(version.content_json);if(!ref||ref.sha256!==hash||ref.pathname!==contentPath(hash)||ref.byte_size!==Buffer.byteLength(version.content_json)||!Number.isFinite(Date.parse(ref.verified_at)))throw Error('Unverified Blob reference');version.content_json='';return {article_version_id:version.id,pathname:ref.pathname,sha256:hash,byte_size:ref.byte_size,verified_at:ref.verified_at};});
 }
 const sql=['BEGIN;','SET LOCAL standard_conforming_strings = on;',"SET LOCAL lock_timeout = '5s';", "SET LOCAL statement_timeout = '60s';",`LOCK TABLE public.folkly_settings, ${[...TABLES.map(t=>'public.folkly_'+t),...(objects?['public.folkly_content_objects']:[])].join(', ')} IN SHARE ROW EXCLUSIVE MODE;`,
 "CREATE FUNCTION pg_temp.folkly_assert(ok boolean, reason text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%', reason; END IF; END $$;",
 "SELECT pg_temp.folkly_assert((SELECT count(*)=3 AND bool_and(value='false') FROM public.folkly_settings WHERE key IN ('production.autonomous_enabled','publication.autonomous_enabled','schedule.enabled')), 'Editorial switches must remain paused');"];
 for(const table of TABLES){const rows=records[table],target='public.folkly_'+table,cols=columns[table];
  for(const row of rows)sql.push(`INSERT INTO ${target} (${cols.join(',')}) VALUES (${cols.map(c=>literal(row[c])).join(',')}) ON CONFLICT DO NOTHING;`);
  sql.push(`SELECT pg_temp.folkly_assert((SELECT count(*)=${rows.length} FROM ${target}), 'Destination count conflict: ${table}');`);
  const pk=table==='page_blocks'?'slug':'id';for(const row of rows)sql.push(`SELECT pg_temp.folkly_assert((SELECT to_jsonb(t) @> ${json(row)} FROM ${target} t WHERE ${pk}=${literal(row[pk])}), 'Destination revision conflict: ${table}');`);
 }
 if(objects){
  for(const ref of objects){const cols=Object.keys(ref);sql.push(`INSERT INTO public.folkly_content_objects (${cols.join(',')}) VALUES (${cols.map(c=>literal(ref[c])).join(',')}) ON CONFLICT DO NOTHING;`);sql.push(`SELECT pg_temp.folkly_assert((SELECT pathname=${literal(ref.pathname)} AND sha256=${literal(ref.sha256)} AND byte_size=${ref.byte_size} FROM public.folkly_content_objects WHERE article_version_id=${literal(ref.article_version_id)}),'Blob reference conflict');`);}
  sql.push(`SELECT pg_temp.folkly_assert((SELECT count(*)=${objects.length} FROM public.folkly_content_objects),'Blob reference count conflict');`);
 }
 for(const table of ['persona_briefs','editorial_checks'])sql.push(`SELECT setval('public.folkly_${table}_id_seq', GREATEST((SELECT COALESCE(max(id),1) FROM public.folkly_${table}), (SELECT last_value FROM public.folkly_${table}_id_seq)), true);`);
 sql.push('DROP FUNCTION pg_temp.folkly_assert(boolean,text);','COMMIT;');
 return {sql:sql.join('\n'),sourceSha:sha256,counts:Object.fromEntries(TABLES.map(t=>[t,records[t].length])),published:[...importedPublic].sort(),private:records.articles.filter(a=>a.status!=='published').map(a=>a.slug).sort()};
}

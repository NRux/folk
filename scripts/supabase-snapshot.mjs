// Offline compiler only. Private snapshot and generated SQL never belong in Git/dist.
import {createHash} from 'node:crypto';
export const TABLES=['personas','persona_briefs','pitches','articles','article_versions','assignments','page_blocks','sources','claim_citations','media_assets','editorial_checks'];
export const digest=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const literal=value=>{if(value===null)return 'NULL';if(typeof value==='number'&&Number.isFinite(value))return String(value);if(typeof value==='string'&&!value.includes('\0'))return "'"+value.replaceAll("'","''")+"'";throw Error('Invalid scalar');};
const json=value=>literal(JSON.stringify(value))+'::jsonb';
export function compileSnapshot(snapshot,{expectedSha,expectedCounts,schema,manifest,catalog}){
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
 const sql=['BEGIN;','SET LOCAL standard_conforming_strings = on;',"SET LOCAL lock_timeout = '5s';", "SET LOCAL statement_timeout = '60s';",`LOCK TABLE public.folkly_settings, ${TABLES.map(t=>'public.folkly_'+t).join(', ')} IN SHARE ROW EXCLUSIVE MODE;`,
 "CREATE FUNCTION pg_temp.folkly_assert(ok boolean, reason text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%', reason; END IF; END $$;",
 "SELECT pg_temp.folkly_assert((SELECT count(*)=3 AND bool_and(value='false') FROM public.folkly_settings WHERE key IN ('production.autonomous_enabled','publication.autonomous_enabled','schedule.enabled')), 'Editorial switches must remain paused');"];
 for(const table of TABLES){const rows=records[table],target='public.folkly_'+table,cols=columns[table];
  for(const row of rows)sql.push(`INSERT INTO ${target} (${cols.join(',')}) VALUES (${cols.map(c=>literal(row[c])).join(',')}) ON CONFLICT DO NOTHING;`);
  sql.push(`SELECT pg_temp.folkly_assert((SELECT count(*)=${rows.length} FROM ${target}), 'Destination count conflict: ${table}');`);
  const pk=table==='page_blocks'?'slug':'id';for(const row of rows)sql.push(`SELECT pg_temp.folkly_assert((SELECT to_jsonb(t) @> ${json(row)} FROM ${target} t WHERE ${pk}=${literal(row[pk])}), 'Destination revision conflict: ${table}');`);
 }
 for(const table of ['persona_briefs','editorial_checks'])sql.push(`SELECT setval('public.folkly_${table}_id_seq', GREATEST((SELECT COALESCE(max(id),1) FROM public.folkly_${table}), (SELECT last_value FROM public.folkly_${table}_id_seq)), true);`);
 sql.push('DROP FUNCTION pg_temp.folkly_assert(boolean,text);','COMMIT;');
 return {sql:sql.join('\n'),sourceSha:sha256,counts:Object.fromEntries(TABLES.map(t=>[t,records[t].length])),published:[...importedPublic].sort(),private:records.articles.filter(a=>a.status!=='published').map(a=>a.slug).sort()};
}

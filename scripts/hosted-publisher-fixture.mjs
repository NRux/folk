import { readFile } from 'node:fs/promises';
export const schema = 'folkly_acceptance_20261007';
export async function setupSql() {
  const base = await readFile('supabase/migrations/20261007220625_folkly_editorial.sql','utf8');
  const lease = await readFile('supabase/migrations/20261007223002_publisher_leases.sql','utf8');
  const transform = sql => sql.replace(/^BEGIN;|^COMMIT;/gm,'').replaceAll('public.',`${schema}.`).replace(/^CREATE ROLE folkly_publisher NOLOGIN;|^GRANT folkly_publisher TO authenticator;/gm,'').replace('GRANT USAGE ON SCHEMA public TO folkly_publisher;',`GRANT USAGE ON SCHEMA ${schema} TO folkly_publisher;`);
  return `BEGIN; CREATE SCHEMA ${schema}; REVOKE ALL ON SCHEMA ${schema} FROM PUBLIC,anon,authenticated; GRANT USAGE ON SCHEMA ${schema} TO service_role;\n${transform(base)}\n${transform(lease)}\nUPDATE ${schema}.folkly_settings SET value='true' WHERE key IN ('publication.autonomous_enabled','schedule.enabled'); COMMIT;`;
}
export function claimSql(key) {
  if(!/^[0-9a-f-]{36}$/i.test(key))throw Error('Invalid fixture key');
  return `BEGIN; SET LOCAL ROLE folkly_publisher; SET LOCAL request.jwt.claims='{"role":"folkly_publisher"}'; SELECT ${schema}.folkly_claim_slot((now() AT TIME ZONE 'America/Los_Angeles')::date,'${key}') AS claim; COMMIT;`;
}
export const cleanupSql = `DROP SCHEMA ${schema} CASCADE;`;
if (process.argv[2]==='setup') console.log(await setupSql());
else if(process.argv[2]==='claim')console.log(claimSql(process.argv[3]));
else if(process.argv[2]==='cleanup')console.log(cleanupSql);

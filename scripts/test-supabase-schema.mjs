import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
try {
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY);');
  await db.exec(await readFile('supabase/migrations/20261007220625_folkly_editorial.sql', 'utf8'));
  const tables = await db.query("SELECT relname, relrowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND relname LIKE 'folkly_%'");
  assert.equal(tables.rows.length, 19);
  assert(tables.rows.every(row => row.relrowsecurity));
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`SET ROLE ${role}`);
    for (const table of tables.rows) await assert.rejects(db.query(`SELECT * FROM public.${table.relname}`), /permission denied/);
    await db.exec('RESET ROLE');
  }
  await db.exec('SET ROLE service_role');
  const settings = await db.query('SELECT key,value FROM public.folkly_settings');
  assert.equal(settings.rows.length, 3);
  assert(settings.rows.every(row => row.value === 'false'));
  await db.query("INSERT INTO public.folkly_jobs(id,job_type) VALUES ('test-job','acceptance')");
  await db.query("INSERT INTO public.folkly_job_steps(job_id,step_name,status,at) VALUES ('test-job','query','pass',now()::text)");
  const steps = await db.query("SELECT id FROM public.folkly_job_steps WHERE job_id='test-job'");
  assert.equal(steps.rows.length, 1);
  await assert.rejects(db.query("INSERT INTO public.folkly_job_steps(job_id,step_name,status,at) VALUES ('missing-job','query','pass',now()::text)"), /foreign key/);
  await db.query("INSERT INTO public.folkly_publication_slots(id,slot_date) VALUES ('test-slot','2030-01-01')");
  await assert.rejects(db.query("INSERT INTO public.folkly_publication_slots(id,slot_date) VALUES ('duplicate-slot','2030-01-01')"), /unique constraint/);
  console.log('Postgres migration passed: 19 tables, RLS, anonymous/non-owner denial, service write/readback, identity IDs, foreign keys, unique daily slots, and paused settings. Local PGlite evidence only.');
} finally { await db.close(); }

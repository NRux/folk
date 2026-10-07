# Supabase editorial storage

Vercel now has Supabase environment variable metadata for production and preview.
Keep the existing Blob-backed subscriber list and public reader operating while
the editorial database migration is verified.

`server/supabase.js` uses SUPABASE_URL plus SUPABASE_SECRET_KEY (preferred) or
SUPABASE_SERVICE_ROLE_KEY. It initializes lazily, disables persisted sessions,
and must only be imported in server code. The anon/publishable key is for restricted
client access; it is never accepted as the private editorial writer credential.
Owner checks verify the bearer token with Supabase Auth and require a row in the
private folkly_owners table. User metadata alone never confers ownership.

The CLI-created migration adds namespaced folkly_* editorial tables, preserves
the existing text JSON/version hashes, creates foreign keys and indexes, enables
RLS everywhere, revokes PUBLIC/anon/authenticated table access, and grants only
the server role access. It seeds production, publication, and schedule switches
false. No content is imported and no owner is assigned by this schema migration.

Apply only to the verified Supabase project connected to Vercel's folk project.
The currently connected Supabase MCP lists only an older project containing a
different application's schema; no SQL was changed there. Vercel's environment
API supplied variable metadata but no usable URL value, so that project cannot
yet be matched to the MCP project. Authorize the Folkly Supabase project in the
Supabase plugin before applying the migration or importing the private reserve.
Do not paste keys or passwords in chat.

After migration, run the Supabase security/performance advisors, test anon and
non-owner denials, import through the reviewed release snapshot path, verify four
published and seven private reviewed stories and their evidence hashes, and run
`node scripts/check-supabase.mjs` with server variables supplied securely.
The server client's test is `node scripts/test-supabase.mjs`.
`node scripts/test-supabase-schema.mjs` executes the complete migration in an
isolated PGlite Postgres engine and tests all 19 tables' RLS/client denial, server
write/readback, identity sequences, foreign keys, unique dates, and paused settings.
This does not claim a hosted migration or hosted security-advisor pass.

This is the storage/client foundation. Postgres publication transactions,
unattended scoped publisher authority, owner UI/session integration, provider
configuration, and the complete Stage 7 deployed acceptance suite remain pending.

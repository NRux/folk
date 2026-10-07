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

The newly connected project `vxmyggasjgsiohqzzwzh`, named `folk`, now has the
editorial, owner-session, and publisher-lease migrations applied. The older
unrelated project remains untouched. Hosted checks confirm 19 RLS tables,
anonymous/client denial, server write/readback with rollback, RPC-only worker
permissions, and disabled publication claims. No articles or owners were imported.
The old Site reader truncates content_json and some evidence values, so it cannot
supply a lossless release snapshot. Export a complete database/release snapshot
from the old Site's database settings before importing it. Do not reconstruct
private articles from truncated text or publish reserve records.

Owner sign-in is `/owner`, with `/api/owner` accepting email OTP and serving only
three switch values after verified identity, private membership, and active Auth
session checks. Cookies are Secure/HttpOnly/SameSite=Strict, capped at 15 minutes,
with no refresh token persisted. Logout attempts global session revocation.
No owner account exists yet. In Supabase Auth, provision Noah's chosen email
account and configure the Magic Link template to display `{{ .Token }}` for OTP.
Set FOLKLY_OWNER_EMAIL securely in Vercel to that exact email. Then provision its
verified Auth UUID in folkly_owners through an audited server operation. The
application cannot create users or promote itself to owner. Email delivery/OTP
rate configuration and real login/logout/MFA tests remain prerequisites. This
screen is read-only; publishing/configuration controls remain unavailable.

The publisher role has no table permissions. Only its JWT role can call the slot
claim RPC. SUPABASE_PUBLISHER_TOKEN must be a short-lived, independently verified
scoped token issued securely; never use a service-role token as the worker token.
No trigger or publication commit RPC is exposed. The model adapter uses a pinned
AI SDK and configured FOLKLY_MODEL_ID via AI Gateway, requires a durable budget
reservation/usage recorder, and never runs while generation is disabled.
Provider funding/evaluation and the durable spend adapter are still pending.
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

This is the storage/auth/lease foundation. Postgres publication commit transactions,
unattended scoped publisher authority, owner UI/session integration, provider
configuration, and the complete Stage 7 deployed acceptance suite remain pending.

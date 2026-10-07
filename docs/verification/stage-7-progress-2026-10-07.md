# Stage 7 progress, 2026-10-07

Stage 7 remains BLOCKED. No article generation, publication, or schedule enabled.

Deployed source: 0f7695765cec0b285f7e71653974698fcf4a2866. Both main and master
Vercel deployments READY. Public reader passed 38 live checks. `/owner` returned
200 with the sign-in form; unauthenticated `/api/owner` returned 401; cross-origin
POST returned 403. Actual owner OTP remains untested until provisioning.
Readback also confirmed all three old Site switches remain false.

## Completed and verified

- Applied three migrations to the newly connected healthy Supabase folk project
  vxmyggasjgsiohqzzwzh. The older unrelated project was not changed.
- Hosted: all 19 editorial tables use RLS; anon/authenticated have no CRUD table
  rights. Actual role-switched reads were denied. Service-role synthetic write
  and readback passed in a rolled-back transaction; cleanup count was zero.
- Hosted: owner active-session RPC is denied to anon/authenticated and allowed
  only to service_role. Unknown Auth session returned false.
- Hosted: publisher role has no article table access; only it can call claim RPC.
  Disabled claim returned paused; no slot created. Three switches read false.
- Implemented owner OTP/login/logout/status endpoint and read-only owner page.
  Local tests: origin rejection, no signup, private membership, invalid/revoked
  session denial, bounded secure cookies, no session token in response JSON,
  logout and unavailable configuration. Live owner account remains unprovisioned.
- Publisher local Postgres tests: unique slot, retry stability, competing claim,
  lease expiration/fencing and published-state reconciliation. Date tests cover
  both DST transition dates. These are not hosted concurrency acceptance.
- Model adapter: pinned ai 7.0.131; strict draft schema, supplied source-ID and
  music URL checks, 45-second timeout, 6000 output-token limit, no internal
  retries, required durable spend reservation/recording. Tests made no live calls.
- Build and all focused suites passed. Production dependency audit found zero
  vulnerabilities. Reader/public reserve isolation checks remain part of npm test.

## Advisor findings

Two security-advisor passes reported only INFO: RLS enabled with no policies on
19 tables. This is intentional default-deny server-only storage, with explicit
client grants revoked; do not add permissive policies to clear the notice.
Reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
Performance INFO: unused indexes on a new empty database and Auth absolute
connection allocation. Retain foreign-key indexes; review connection allocation
when sizing the instance. Reference: https://supabase.com/docs/guides/deployment/going-into-prod

## Remaining gates and concrete blockers

1. Old Site export: database overview confirmed its existing articles/evidence.
   Eleven article metadata rows are available, but article_versions, page_blocks,
   and sources include truncated values. No partial import attempted. Need a
   complete hash-verifiable release snapshot from the Site database settings.
2. Owner: zero Auth users and owner rows. Provision Noah's chosen Auth account,
   OTP email template/delivery, exact FOLKLY_OWNER_EMAIL in Vercel, and audited
   private UUID membership. Then test real email OTP, expiry, revocation and MFA.
3. Worker/model: issue scoped publisher credentials securely and configure/fund
   the selected gateway/model after persona evaluation. Durable budget ledger,
   content commit/readback and hard-gate integration remain implementation work.
4. Isolated recovery environment: no Supabase branches exist. Branch cost lookup
   returned UNAVAILABLE: get_cost was not returned by tools/list. No branch was
   created, no costs accepted, and production switches were not toggled for tests.
   Need working branching/cost capability or an existing isolated test database
   before hosted concurrency, forced failures, and restore acceptance.
5. Full Vercel end-to-end acceptance, responsive browser checks, and second full
   deployed debug/security pass remain pending. Local tests do not close them.

# Vercel-resident editorial import — 2026-10-09 UTC

## Implementation checkpoint

The existing Vercel project can now perform the recovered source transfer without
exporting provider secrets. `/api/editorial-import` accepts only a fixed bounded
snapshot/receipt and temporary capability issued through the already authorized
Supabase administrative connection. No public credential-issuance/read endpoint
or additional cron exists. This checkpoint does not yet claim the actual transfer.

The migration `20261009232929_hosted_editorial_import.sql` is applied to
`vxmyggasjgsiohqzzwzh`. The grant stores only the random bearer SHA-256, exact source
SHA/counts, trusted schema/catalog/manual-release contract SHA and expiry up to
30 minutes. The issuer is administrative; service_role cannot INSERT grants.
Claim RPC fences one invocation with a five-minute lease, rejecting stale,
wrong-source/wrong-contract and used grants. All RPCs are SECURITY INVOKER with
fixed search paths, revoked PUBLIC/anon/authenticated execution, and service-only
grants. Table RLS is enabled and client SELECT is revoked.

The deployed function verifies authorization before body parsing/upload, pins the
existing Supabase origin, caps input at 2 MB, rejects query/range/foreign-origin
requests, validates the independent source receipt and whole source, and enforces
three paused settings. Private backup and each exact version are uploaded under
checksum-derived create-only names and read back before metadata application.
A shared compiler helper preserves the existing CLI import contract. The RPC
locks metadata/settings, imports every expected field with conflict refusal, and
checks exact counts and full records in one transaction. Blob references retain
append-only INSERT/SELECT privileges; locked version parents, FK and unique/full
reference coverage prevent unrelated concurrent insertions. The two identity
sequences receive the UPDATE privilege required for setval, without granting
reference mutation or grant issuance.

After commit, two complete independent HTTP DB sweeps and uncached private Blob
reads verify all metadata, source version bytes and immutable backup. Settings
must stay paused throughout. A redacted aggregate receipt is stored in the grant,
which is retired as verified. Invalid receipts and lease state are rejected.
Missing or corrupt objects cannot produce a PASS. Failure retains private objects
and any committed records for explicit reviewed recovery; no automatic retries,
refunds, overwrite, deletion, article release or autonomous activation occurs.
Global SDK deadline is 180 seconds, database HTTP deadline 15 seconds, function
maxDuration 300 seconds. No raw SDK/SQL error, body, path, title or credential is
logged/returned; fixed stage/code and random request correlation are logged.

## Validation at this checkpoint

- Source/public build: 73 public pages, 11 stories; current concurrent translation
  dropdown/shared UI changes are preserved from main/master.
- All 36 regression commands PASS, including the new hosted-import command.
- PGlite service-role fixture exercises real invoker permissions, claim/replay,
  wrong lease, late Blob-reference failure after metadata insertion (rollback),
  unsafe switch, immutable retry, private RPC/table denial and redacted receipt.
- Installed Supabase SDK fixture verifies private grant GET projection and all
  three RPC POST bodies, including sending only token hash to DB.
- Handler tests prove missing/invalid authorization is rejected before body/upload,
  wrong source/foreign origin rejection, Blob failure before commit and readback
  failure without a PASS receipt. Existing independent import/Blob corruption,
  interrupted transfer, count/pagination and private draft resolver fixtures pass.
- Hosted rollback-only claim/empty-commit fixture completed with zero persisted
  grants, articles and references. This tests real PG17/invoker access, not a full
  source import or real Blob recovery.
- Hosted ACL readback: all three RPCs invoker=true, client EXECUTE=false,
  service EXECUTE=true; grant RLS=true/client SELECT=false/server INSERT=false;
  Blob reference UPDATE/DELETE=false.
- Security advisor returns intended private RLS/no-policy INFO findings and the
  existing leaked-password-protection warning. No new function/security exposure
  is found. Existing warning remediation:
  https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

The complete source export is already verified and retained privately. This
implementation still needs actual deployed upload/transaction/readback, grant
retirement verification and full owner/recovery acceptance. No local credential
export or Vercel connector access was used. Google Cloud remains deferred.

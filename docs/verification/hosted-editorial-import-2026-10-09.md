# Vercel-resident editorial import — 2026-10-09 UTC

## Deployed transfer PASS — 2026-10-09 23:47:12 UTC

The complete recovered source was actually transferred inside the existing Vercel
project to the existing Supabase database and private Vercel Blob store. No provider
credentials were exported locally. The deployed function returned HTTP 200 and
`folkly-import-readback-v1` after two exact-field database sweeps, uncached byte-exact
readback of all 15 version bodies, and the immutable original snapshot backup.
The independently generated source SHA is
`f284367ddd8455fe6907983bd39a6b48e3d5a7209ea98ede24a66304afdacd5d`.

| Imported table | Verified records |
| --- | ---: |
| personas | 5 |
| persona_briefs | 6 |
| pitches | 0 |
| articles | 11 |
| article_versions | 15 |
| assignments | 0 |
| page_blocks | 2 |
| sources | 63 |
| claim_citations | 147 |
| media_assets | 3 |
| editorial_checks | 63 |
| private content references | 15 |

A separate administrative connection independently compared every imported field
via per-field digests and exact counts against the validated source. All eleven
metadata tables match, and all 15 Blob references match source hashes, byte sizes
and checksum paths. SQL compatibility content_json fields are empty; full original
JSON bodies remain private in Blob. The raw 411,686-byte request never entered Git.

The one-use grant is verified, its lease cleared, and its redacted receipt saved.
An actual replay with the retired credential and an anonymous request both returned
401/private,no-store. Anonymous owner-workspace access remains 401/no-store.
Homepage, Detroit story and owner shell remain 200. All 45 deployed reader checks
passed on the implementation; build and all 36 regression commands pass. Additional
CLI tests verify repository/public output refusal, existing private-proof preservation
and safe missing-file diagnostics before credential input or network access.

Implementation commit: [b52edbc](https://github.com/NRux/folk/commit/b52edbc18d9f0e7ca9cf064a3fc3cca9425eeb10).
[Vercel deployment](https://vercel.com/optagens-projects/folk/AMkWyBFqmuhwRsgMQwygohhW4WQY)
reported success. Machine-readable aggregate evidence:
[editorial-import-live-2026-10-09.json](editorial-import-live-2026-10-09.json).

The release manifest identifies all 11 imported stories as already public, including
the seven manually released stories; private article count is zero. Historical
version bodies, persona briefs, checks and evidence remain private. No new story
was published, no public revision or image/license replaced, and no historical
source evidence is asserted to validate later Vercel edits. All three autonomous
production/publication/article-schedule settings remain false. No model call,
newsletter or translation release was performed.

This supersedes the transfer-pending checkpoints below and in older reports.
Source export, actual transfer and exact hosted readback are now PASS. No source
export or new credential action remains for Noah for this prerequisite. Full
Stage 7 stays blocked for authenticated owner draft viewing and the complete
isolated publisher/newsletter/provider outage/restore acceptance, including native
language review where applicable. Vercel connector and Google Cloud stay deferred.
Existing secrets were successfully reused; setup is not being requested again.

## Implementation checkpoint (before transfer)

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

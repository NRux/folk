# Independent editorial import readback — October 9, 2026

## Implementation and boundary

Added scripts/verify-supabase-import.mjs and scripts/import-readback.mjs. The
existing compiler now shares its complete source/receipt/schema/version/manual-
release validator with the independent verifier. The compiler's transaction,
conflict and publication-classification behavior is unchanged.

The verifier exposes only SELECT and private GET operations. It compares every
imported row/column of all eleven editorial tables, validates complete deterministic
pages and exact counts, reads exact private Blob version bodies and snapshot
backup, then repeats the database sweep. Missing, extra, duplicate, truncated,
conflicting or changed records/references fail closed. All three article switches
must remain false throughout the reads. SQL-only imports are supported explicitly,
with no Blob references or backup-verification claim in that mode.

The CLI fixes the existing destination project, rejects private inputs/receipts
inside the repository or public directories, bounds input files, refuses receipt
overwrite, uses mode 0600 and omits raw errors/SDK responses/credentials. Its safe
receipt contains counts/hashes/fixed destination/time and verification booleans,
never row IDs, slugs, titles, draft bodies, private paths or evidence. Supabase
requests use a 15-second deadline. It never imports, repairs, uploads, deletes,
spends, publishes, enables a switch or attempts an automatic retry repair.

## Debug, security and regression evidence

- npm run build: 73 public pages, 11 stories, publisher disabled.
- All 35 npm test commands pass. A subsequent focused import/readback run also
  passes after adding the actual installed-SDK GET wire assertion.
- Isolated PGlite uses the actual editorial/private-reference migrations and
  real compiler output. Exact SQL replay, private/public release classification,
  retained needs-review holds and full scalar/JSON readback pass.
- Interrupted transaction leaves no imported metadata; verification refuses
  that state. Verified retry succeeds without a verifier upload. Blob fixtures
  deny missing/corrupt version files, missing backup and wrong reference sizes.
- Page count/column/identity/truncation failures, duplicate page rows, a late
  database edit, reference drift and late switch activation all deny PASS.
- Source receipt mismatch causes zero destination reads. Wrong destination and
  unsafe CLI output fail without a receipt, key, path or raw private error.
- Actual @supabase/supabase-js transport fixture confirms GET-only projection,
  id order, bounded offset/limit and Prefer count=exact parsing. No real HTTP
  request or provider is used by these tests.
- Existing RLS/client denial, service append-only references, compiler rollback,
  full-column validation and all owner/translation/newsletter regressions pass.
- npm run test:hosted passes 45 public checks: both URL forms, all eleven exact
  article bodies, five authors, subscription navigation and private-route denial.
  This code-only transfer tooling leaves the deployed public reader unchanged.

## Live read-only evidence and remaining gates

The authorized existing project vxmyggasjgsiohqzzwzh reports zero rows in each of
the eleven editorial tables and folkly_content_objects. All twelve tables have
RLS enabled, neither anon nor authenticated has SELECT, and service_role has
SELECT. Separate settings readback confirms production.autonomous_enabled,
publication.autonomous_enabled and schedule.enabled are all false.

No schema/ACL change or data mutation was made to the hosted project. No original
content snapshot was available to feed a real import/readback; do not substitute
the source reader's truncated version JSON or reconstruct it from public HTML.
The actual lossless transfer, authenticated private draft check and hosted
cross-service interruption/restore acceptance remain unpassed. Two matching
readback sweeps detect observed drift; they are not a cross-service transactional
snapshot and cannot prove absence of reverted intervening changes.

Runbook: ../platform/SUPABASE-CONTENT-IMPORT.md. Noah's remaining content action is
to supply the complete original private snapshot/SQLite backup and independently
produced source checksum/count receipt. No new credentials are requested in chat;
the verifier uses existing securely configured server credentials. Google Cloud
stays deferred; translation budget work proceeds independently in the owner panel.

Documentation reference checked: https://supabase.com/docs/reference/javascript/range
(inclusive ordered pagination and exact-count SELECT). The changelog markdown
fetch returned unsupported-content-type, so current pagination behavior was also
checked through Supabase documentation search and the installed SDK transport.

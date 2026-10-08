# Blob-backed editorial content — October 8, 2026

Implemented private immutable content objects, private snapshot backups, hybrid
import compilation and verified owner draft resolution. Existing Vercel Blob is
reused; no store/project was created and no private file was uploaded in this pass.

Applied private_content_objects and content_objects_append_only migrations to
vxmyggasjgsiohqzzwzh. Hosted readback: RLS=true; anon/authenticated reads=false;
service insert=true; service update/delete=false; reference count=0. Default
Supabase service grants initially included UPDATE; the explicit corrective
migration removed it. All three autonomous switches remain false.

Local tests: private create-only writes, duplicate/ambiguous upload recovery,
SHA-256/UTF-8 byte readback, malformed/path/oversize/missing/corrupt denial, protected
draft resolution, legacy SQL draft compatibility, hybrid transaction/retry,
complete reference requirement, unsafe reference denial, client denial and server
update denial. npm build and full regression pass; focused final hybrid checks
also pass after the corrective grant change. Mock Blob and isolated PGlite only;
no real storage/model/provider call or hosted content import is claimed.

Security advisor reports INFO for default-deny tables without policies, including
the new table; keep those client grants revoked. The existing leaked-password
protection WARN remains an Auth account configuration item, outside this storage
change. No secrets or private content are in static build output or committed SQL.
Content streams are bounded at 200 KB per version; snapshot backup at 10 MB.
Only checksum-derived private paths are allowed. Response remains owner-only and
no-store. No arbitrary URL is accepted and no automatic cleanup/deletion occurs.

Still needed: a complete original Site snapshot/backup and independent source
receipt, real Blob upload/readback, metadata commit/independent readback and an
authenticated owner draft check. Cross-service interruption/orphan recovery and
full Stage 7 publication acceptance remain open. Public prose/media are unchanged;
seven manually released stories remain classified public. Google Cloud deferred.
See docs/platform/SUPABASE-CONTENT-IMPORT.md for the --blob procedure.

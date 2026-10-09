# Private editorial import runbook

The original Site is appgprj_6abfc9a424f881918070e39a237ecc83 (DB binding). The destination is the existing Folkly Supabase project vxmyggasjgsiohqzzwzh. Do not create a replacement Site or database. Publishing stays disabled.

## Recovered source (2026-10-09)

Codex recovered the original Site source repository, deployed a fixed read-only
editorial export, and retrieved the complete live D1 snapshot twice. Both copies
match. The original Site remains public with unchanged story content. The temporary
export secret was revoked and the revoked configuration redeployed; anonymous
requests and the former authorized credential now receive 404/no-store.

The source snapshot/independent source receipt are saved privately as
folkly-editorial-source-export-2026-10-09.zip. Payload SHA-256:
`f284367ddd8455fe6907983bd39a6b48e3d5a7209ea98ede24a66304afdacd5d`.
All 11 tables, 11 articles, 15 complete versions, 63 sources, 147 claim links and
63 checks pass the current import compiler. The current release manifest marks
all 11 stories public; the seven previous releases are not private reserve.
Noah does not need to export anything. See
[full evidence](../verification/original-site-export-2026-10-09.md).

The real Blob upload, Supabase import and independent hosted readback remain
pending. Existing BLOB_READ_WRITE_TOKEN and server-only Supabase credentials
must be supplied to the private import runner by the trusted provider environment;
do not resubmit them in chat or Git. Their presence in Vercel was reported by the
owner, but they are not available in this execution environment. The Vercel
connector remains deferred at the owner's request. Generated SQL has been reviewed
offline; it has not been applied, and no Blob upload has occurred.

## Export contract

Obtain a complete private editorial export from the original Site database/settings or a complete SQLite backup. The connected table reader truncates article_versions.content_json at 2,000 characters even with limit 1; its output cannot be imported. Do not reconstruct the missing bytes from public HTML, summaries or truncated records. Export all 11 editorial tables required by the existing web/site-runtime/export-snapshot.cjs (personas, persona_briefs, pitches, articles, article_versions, assignments, page_blocks, sources, claim_citations, media_assets, editorial_checks). The export uses folkly-d1-snapshot-v1 and release_state unpublished as its transfer-format marker, not a promise that all articles are private.

Codex owns source extraction; do not require Noah to locate or export ChatGPT-generated source. For a future complete SQLite backup, run the existing exporter outside the repository and retain its independently printed sha256 and table counts as a separate receipt JSON containing {"sha256":"...","counts":{...}}. The receipt must come from the complete source export, not be manufactured from truncated data. A raw database backup first needs the existing exporter conversion; it is not accepted as JSON. Avoid posting any keys or private draft text in chat or committing the snapshot/SQL.

## Compile and review

Run from the repository:

    node scripts/prepare-supabase-import.mjs /private/snapshot.json /private/source-receipt.json /private/import.sql

The output directory must exist outside the repository and public asset directories. The command creates a new mode-0600 SQL file, refuses overwrite, prints counts/hashes only and makes no network/database call. It validates independent checksum/counts, complete schema columns, unique row IDs, parseable version JSON, latest version hashes, evidence ownership and the current publication catalog/owner release manifest. Unexpected tables/columns, partial data or changed manual-release hashes stop compilation.

The current manifest marks the seven manually released stories published in the destination; they must not replenish the private reserve. Other unpublished rows retain their private status and holds. All currently public catalog stories must be present. This is historical editorial migration: later public prose/media edits remain in the Vercel source and are not overwritten. Reconcile those as new versioned editorial changes after import, retaining old evidence and invalidating/rechecking new versions before automation.

## Controlled application and readback

Verify the destination project identity and existing migrations through the authorized Supabase connection. Back up any destination editorial records first. Apply the reviewed SQL only through protected administrative setup against that exact project. It is not a public RPC or browser endpoint. Use a connection that stops on SQL errors and rolls back on failure.

The SQL takes write-conflicting table locks, requires all three switches false, imports and compares all rows/counts in one transaction, refuses changed/conflicting records, preserves existing data and permits exact retries. It never imports credentials, owner identities, settings, publication slots, operational spend or schedules. Identity sequences advance past imported IDs; sequence advancement may survive rollback as normal PostgreSQL behavior, without creating editorial records. No automatic overwrite/delete is performed.

After commit, use an independent connection to compare each table's counts, article status/content hashes and exact version/evidence data with the receipt/snapshot. Confirm client-role denial and all switches false; open private drafts using a real owner session and verify anonymous access is denied. Re-run security advisors. Then exercise the separate recovery/publication acceptance gates in an isolated environment. A local compiler test is not hosted acceptance.

## Preferred Blob-backed import (October 8 follow-up)

Run the preparation command with --blob after validating the complete source and
configuring the existing private Vercel Blob connection securely:

    node scripts/prepare-supabase-import.mjs /private/snapshot.json /private/source-receipt.json /private/import.sql --blob

This first validates the source, then uploads a private immutable snapshot backup
under editorial/backups/<file-checksum>.json and each exact version JSON under
editorial/versions/<content-checksum>.json. Uploads are create-only; a retry verifies
an existing object rather than overwriting it. Every version is independently read
back and checksum/byte-size verified before its Supabase reference is compiled.
The backup file checksum covers the entire serialized snapshot; the source receipt
checksum covers its payload, so those two hashes intentionally differ.

Apply both private-content migrations before the generated SQL. In this mode,
article_versions.content_json is an empty compatibility field; bodies live in
Blob and folkly_content_objects holds private pathname, SHA-256, byte size and
verification time. The compiler includes those references in the same transaction
as article metadata/evidence, refusing missing, conflicting or extra references.
The owner draft endpoint checks owner authorization before fetching a private
object, enforces bounded streaming and verifies the stored checksum. Missing or
corrupt files fail closed without using an older body. Existing SQL-backed versions
remain readable only when no Blob reference exists; no existing body is deleted.

An interrupted upload leaves unreferenced private objects, not a partially public
article. Retry the exact snapshot to verify/reuse them. If SQL fails, retain objects
for investigation/retry; do not automatically delete possible referenced content.
Future orphan cleanup must compare the full reference index and backups before
owner-approved deletion. A metadata commit is not proof that Blob and Postgres
share a transaction. Independent hosted readback and interruption tests remain
acceptance gates. Existing credited public images stay on their current static/CDN
paths; no image replacement or new public Blob exposure was performed.

## Independent post-transfer verification (October 9 follow-up)

After applying the reviewed import SQL, start a separate process with the existing
Folkly server-only Supabase credentials and private Blob token supplied securely
through its environment. Run:

    node scripts/verify-supabase-import.mjs /private/snapshot.json /private/source-receipt.json /private/verified-import.json

This is a SELECT/private-GET verifier, not an importer or repair tool. It pins
the destination to vxmyggasjgsiohqzzwzh, validates the independent source checksum,
all eleven source tables and current manual-release classification before reading
the destination, and checks every imported scalar field rather than only counts
or the latest article hash. For each Blob-backed version it requires the empty
SQL compatibility field, exact reference/path/byte count/checksum, uncached bounded
private content readback and byte-exact source JSON. The original immutable
snapshot backup must also match. Two complete database sweeps catch observed
pagination/reference/concurrent-edit drift; all three publishing switches must
remain false before, between and after them.

The verifier uses deterministic ordered pages with exact counts, rejecting
truncated, duplicate, extra or missing rows and changing counts. Supabase requests
have a 15-second deadline. It performs no INSERT, UPDATE, RPC, provider call,
Blob upload, delete or retry repair. Failures produce no PASS receipt. Its stdout
and new mode-0600 receipt contain only source hash, counts, storage mode, verification
timestamp, fixed project ID and verification booleans. Titles, draft text, evidence,
row IDs, slugs, private paths and credentials are omitted. Inputs and receipt must
be outside the repository and public directories; an existing receipt is never
overwritten. For a deliberately SQL-only import add --sql; any unexpected Blob
reference is rejected, and no Blob backup verification is claimed in that mode.

Run while editorial import data is quiescent. Two matching sweeps are not a
cross-service transactional snapshot and cannot prove no intervening/reverted
change occurred. This checks exact historical migration data; it does not modify
the newer public Vercel reader or declare old evidence valid for later revisions.
Private owner draft viewing, anonymous/non-owner denial, hosted outage/restore
fixtures and the full publisher acceptance suite remain separate gates. Retain
the private source, receipt and backup for those recovery checks.

## Vercel-resident controlled transfer (2026-10-09)

The protected `/api/editorial-import` function can use the existing server
credentials without pulling them into the agent's local environment. Apply
`20261009232929_hosted_editorial_import.sql` first; the migration has been applied
to the existing project and verified with rolled-back hosted fixtures.

A trusted administrative connection issues one `folkly_import_grants` row: only a
random 256-bit token hash, the independently verified source SHA/counts, deployed
contract hash and at most 30-minute expiry are stored. This route cannot issue
credentials; service_role itself has no grant INSERT permission. Pass the raw
credential through hidden stdin as a Bearer header to the exact existing Vercel
origin, never a URL, shell argument, chat message or file. POST a bounded JSON
object containing the complete recovered `snapshot` and source `receipt`.

The function authorizes before reading the body, pins the existing Supabase
project, rejects changed schema/catalog/manifest contracts, validates the entire
source, and claims the grant exactly once with a five-minute lease. It uploads and
independently reads back create-only private Blob versions and backup, then commits
all metadata/evidence/references in one locked invoker RPC transaction. Conflicts,
missing rows and enabled switches roll back. Reference UPDATE/DELETE permissions
stay revoked; locked version parents, the FK and complete unique reference index
bound concurrent insertions. Only the two imported identity sequences receive the
UPDATE privilege needed for advancement.

The existing exact-field/two-sweep verifier runs against independent HTTP SELECTs
and private Blob GETs after commit. A safe aggregate receipt is stored privately,
and the grant becomes verified and cannot be reused. Invocation/DB deadlines are
180/15 seconds within a 300-second function; request bodies cap at 2 MB. Inputs
larger than that require the original secure CLI path, not a public upload bypass.

Failures retain state and do not automatically retry, refund, overwrite, publish
or delete. A failed grant is revoked administratively; a separately authorized
new grant may reuse identical immutable objects/metadata. If the commit succeeded
but response or readback failed, inspect the existing row and run the independent
verifier before declaring success. Full owner-session and recovery acceptance
remain separate from this capability-scoped transfer.

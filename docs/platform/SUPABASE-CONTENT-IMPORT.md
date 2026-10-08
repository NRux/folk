# Private editorial import runbook

The original Site is appgprj_6abfc9a424f881918070e39a237ecc83 (DB binding). The destination is the existing Folkly Supabase project vxmyggasjgsiohqzzwzh. Do not create a replacement Site or database. Publishing stays disabled.

## Source prerequisite

Obtain a complete private editorial export from the original Site database/settings or a complete SQLite backup. The connected table reader truncates article_versions.content_json at 2,000 characters even with limit 1; its output cannot be imported. Do not reconstruct the missing bytes from public HTML, summaries or truncated records. Export all 11 editorial tables required by the existing web/site-runtime/export-snapshot.cjs (personas, persona_briefs, pitches, articles, article_versions, assignments, page_blocks, sources, claim_citations, media_assets, editorial_checks). The export uses folkly-d1-snapshot-v1 and release_state unpublished as its transfer-format marker, not a promise that all articles are private.

Noah's required action: provide the complete export/backup privately. For an available complete SQLite backup, run the existing exporter outside the repository and retain its independently printed sha256 and table counts as a separate receipt JSON containing {"sha256":"...","counts":{...}}. The receipt must come from the complete source export, not be manufactured from truncated data. A raw database backup first needs the existing exporter conversion; it is not accepted as JSON. Avoid posting any keys or private draft text in chat or committing the snapshot/SQL.

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

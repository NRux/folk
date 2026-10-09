# Original ChatGPT Site editorial export — 2026-10-09 UTC

## Result

Complete editorial source extraction PASS. Codex recovered the original Site's
source repository and retrieved a lossless live D1 snapshot, rather than asking
Noah to export ChatGPT-generated code or supplying reconstructed article text.
Noah has no source-export action remaining. The actual Blob/Supabase transfer and
full hosted acceptance remain open; no target editorial write happened here.

## Provenance and integrity

- Original Site: `appgprj_6abfc9a424f881918070e39a237ecc83`, existing `DB` binding.
- Original source HEAD: `b61561338efa18c49759b4d5fb35b44fa89ac5ea`.
- Export implementation source commit: `fed379ef7bb4c18bbc81644beee1f1c9b74a5b21`.
- Existing Site version 6 deployed successfully with the temporary export.
- Two complete live exports matched byte for byte before saving anything.
- Source-generated payload SHA-256:
  `f284367ddd8455fe6907983bd39a6b48e3d5a7209ea98ede24a66304afdacd5d`.
- Fifteen complete version JSON values range from 5,072 to 13,646 UTF-8 bytes;
  none uses the bounded table-reader projection or public HTML reconstruction.
- Snapshot and independent source receipt are retained privately in
  `folkly-editorial-source-export-2026-10-09.zip`; zip readback matches both original
  files exactly. Archive SHA-256:
  `b608d280d69c1a621da42d70a2b414b6e128d6468197df817c8f85864a9fadc6`.
- Files are mode 0600 in a mode 0700 directory outside both source repositories.
  The private archive is saved durably for the owner; no bodies, evidence records,
  snapshot, SQL or credentials are committed to Git or exposed as public assets.

| Table | Complete rows |
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

The existing compiler accepts the checksum/count receipt, every schema column,
version JSON and latest article hash, evidence ownership, catalog and current
manual-release manifest. It generates reviewed SQL with `applied:false`, 11 public
articles and zero remaining private articles in this snapshot. The seven prior
manual releases remain public. Historical versions remain private transfer data;
newer Vercel prose, photographs and licenses are untouched. No reserve is invented,
reclassified or deleted. Operational tables and secrets remain in their original
store and are intentionally outside this editorial import contract.

## Export authorization and checks

The fixed GET endpoint uses a freshly generated 256-bit bearer credential for this
read-only operation, separate from repository/publisher/model credentials. Only its
SHA-256 and expiry are configured as runtime values; no secret is added to source
or arguments. The raw credential and platform access token are passed through
hidden stdin and retained only in session memory. The endpoint rejects missing,
invalid, expired or overlong-window credentials before touching D1, disallows
query/range inputs, exposes no arbitrary SQL/table choice, emits no CORS allowlist,
and returns private/no-store, no-referrer, noindex and nosniff headers.

One transactional D1 batch reads the fixed eleven tables, independent exact counts
and paused-state checks. Any missing result, partial row set, more than 5,000 rows
per table, oversized payload or unsafe switch rejects the entire export. The
export writes no settings, audit rows or editorial records. Generic failures expose
no database/private content. The source checksum and receipt are generated in the
Worker; the separate downloader verifies checksum/counts and compares a second
complete export before creating files with exclusive mode-0600 writes.

`node scripts/test-export-snapshot.mjs` passes authorization/expiry, fixed reads,
complete long JSON, source receipt, unsafe-state and partial/failure rejection.
`node scripts/test-publication-gates.mjs` passes existing evidence/atomic guards.
The original Site Vinext build and source push/package succeed. The focused
Supabase import/readback regression passes, including existing rollback/retry,
private Blob corruption, exact count/pagination and paused-state fixtures. These
local fixtures do not claim an actual target Blob upload or hosted restore.

## Revocation and deployed readback

Both temporary export runtime keys were removed. Site version 6 was redeployed
successfully with environment revision 6, preserving its public audience, existing
D1 binding, public routes and MCP integration. Anonymous GET and a replay using the
former valid credential both receive HTTP 404 with private/no-store. Both original
Site and Vercel homepages return 200. Anonymous Vercel owner-workspace GET remains
401/no-store. All three article switches were false in the transactionally read
source state. No autonomous activation or target setting mutation occurred.

## Remaining transfer boundary

The validated generated SQL has not been applied and no private Blob object has
been uploaded. Existing BLOB_READ_WRITE_TOKEN, SUPABASE_URL and server-only
SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY are not present in this runner. The
owner has already reported configuring provider secrets; do not ask them to create
or paste those again. The next step is to run the existing --blob preparation and
independent verifier from a trusted runner with access to that existing provider
environment, then apply the reviewed transaction to the existing Supabase project.
Vercel connector work stays deferred at the owner's request. Any remaining access
action is enabling that trusted connection/runtime, not exporting source.

Stage 7 still requires target commit/readback, authenticated draft viewing,
interruption/restore and remaining provider/newsletter/language acceptance.
Production, publication and article scheduling stay disabled. Google Cloud remains
deferred; no new article, locale, model call or outgoing email occurred.

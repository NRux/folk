# Site migration boundary, 2026-10-07

## Current deployed state

Site version 4 `appgver_5f3600578d98819183e629fe4c3991b4` deployed from source
`62c6f55044c5b7dff9605000fe9c52af0b56b98d` adds an owner-only
`/admin/story?slug=...` evidence view. It shows the latest version, source and
claim links, verification results, disclosure, and media-rights record without
exposing raw article HTML. Ready and held stories link to it from `/admin`.
The local fixture used the Site's mock sign-in, verified anonymous 401, signed-in
non-owner 403, owner 200 with evidence, invalid slug 404, no-store/CSP, dashboard
link and private reader 404. The real hosted owner session remains untested.
After deployment, anonymous hosted review access returned 401, a private story
returned 404, an original article returned 200, and the 60-check hosted reader
regression passed. The publication schedule and autonomous switches remain off.

### Earlier Worker/D1 migration

The same public Site now runs a Worker/D1 reader and owner-gated admin/MCP routes.
Version 3 `appgver_c8dbffa7d204819190627864fcbbf250` was deployed from Site source
`f2cf470865ee4e5e07c186826fec3fdc9e1d82c9` with additive migrations applied.
The hosted D1 import includes four published legacy stories and seven reviewed private
reserve stories. Held/failed drafts and the pitch backlog were excluded from the release
snapshot. Temporary bootstrap ingestion was removed after import; `/api/bootstrap` is 404.

Two consecutive runs of `node web/scripts/verify-hosted-reader.js` passed 60 checks each:
four legacy URLs in both forms and figure credits, five author URLs, archives/pages/assets,
seven private draft 404s and home exclusions, no-store headers, and anonymous admin/MCP
denial. Forged owner identity headers were rejected by the Sites boundary. A separate local
Worker/D1 fixture published exactly one eligible article under concurrent calls, returned
`already-published` on retry, and independently read back the stored version/hash. It did
not mutate hosted D1.

The hosted owner session was not available for acceptance, and the Site's MCP connection
is not installed. Production model access and hosted replenishment are absent. The
publication and production switches remain off, with no linked automation and no new
public article. Mobile viewport and the full eleven-case integration suite remain open.

## Initial migration preparation (historical baseline)

The live Folkly Site `appgprj_6abfc9a424f881918070e39a237ecc83` was read through
Sites on 2026-10-07. It is active at `https://folkly-journal.nrapp.chatgpt.site`,
public, then on static version 1, and had no linked automation. The original Site
source checkout was synchronized before the later deployment described above.

The local Node/SQLite repository now has a schema-only D1 transfer artifact and a
private editorial snapshot exporter/importer under `web/site-runtime/`. An isolated
round trip against the current local database transferred 16 articles, 19 versions,
and 88 sources. Seven drafts have `pipeline_state=ready`; four legacy articles remain
published. Repeat import, changed-snapshot checksum rejection, and public asset
path rejection passed. The test used an in-memory SQLite adapter for the D1 interface;
it did **not** execute against hosted D1.

A read-only Worker/D1 reader boundary now reuses the Folkly renderer. Its isolated
D1-shape fixture passed both forms of all four legacy article URLs, seven index and
static page paths, five persona pages, and exclusion of an unpublished ready draft
from reader routes and metadata. Admin/API paths return no editorial data. This is
local fixture evidence, not a deployed Site parity or mobile check.

At this preparation milestone no hosted data had been imported. The current deployed
state and remaining acceptance gaps are recorded above.

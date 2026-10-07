# Site migration boundary, 2026-10-07

The live Folkly Site `appgprj_6abfc9a424f881918070e39a237ecc83` was read through
Sites on 2026-10-07. It is active at `https://folkly-journal.nrapp.chatgpt.site`,
public, still on static version 1, and has no linked automation. The original Site
source checkout was synchronized without changing or deploying its content.

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

No production data was imported, no Site version was saved or deployed, and no schedule
was created. The Node renderer/admin/pipeline/publisher still need an asynchronous
Worker/D1 port and an authenticated unattended writer. Production provider access,
Site authorization, mobile layout, and all deployed acceptance cases remain unverified.

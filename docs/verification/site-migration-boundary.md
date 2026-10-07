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

No production data was imported, no Site version was saved or deployed, and no schedule
was created. The Node renderer/admin/pipeline/publisher still need an asynchronous
Worker/D1 port and an authenticated unattended writer. Production provider access,
Site authorization, mobile layout, and all deployed acceptance cases remain unverified.

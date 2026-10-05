# Folkly Build State

Master spec: `Folkly_Autonomous_Publishing_Codex_Prompt.txt` (this directory).
Each stage updates ONLY its own section. Status values: PENDING / IN PROGRESS / DONE / BLOCKED.

## Stage 00 — Architect (Hermes)
Status: DONE (2026-10-03)
Notes: Master prompt moved from repo root into docs/TODOs/. Build decomposed into 8 stage
prompts + autonomous runner (build-driver.sh). Live-site baseline captured from HTTP:
4 articles (new-orleans-second-line, lisbon-fado, oaxaca-living-color, detroit-future-frequency),
perspective page, about page; routes are extensionless with .html variants; images under /assets/.
Existing articles carry real source footers and a standard AI-essay disclosure.
Evidence: repo commit history.

## Stage 01 — Inspect & preserve
Status: DONE (2026-10-04)
Evidence: docs/preservation/inventory.md, inventory.json, pages/*.md (9 captures), raw/*.html
+ raw/style.css (captured stylesheet), NOTES.md; capture script scripts/stage01_capture.py.
Notes: 13 routes captured (both URL forms; .html canonicalizes to extensionless with 200).
Assets: 3 lead images + style.css (11.6 KB, full design system). Sites tools NOT available
in this environment (HTTP baseline only) — recorded per protocol. Divergences logged in
NOTES.md: canonicals point at a different subdomain (owner question), no JSON-LD, historical
"Folkly editorial" bylines to preserve, Detroit article is the no-photograph exemplar.

## Stage 02 — Platform & content migration
Status: DONE (2026-10-04)
Evidence: docs/verification/stage-02-url-check.md (14/14 routes exact text match, both URL
forms; idempotent re-run recorded), docs/platform/ARCHITECTURE.md.
Notes: zero-dependency Node 24 server (web/server.js, port 8787) + SQLite store (web/folkly.db,
gitignored; rebuild: node web/scripts/migrate.js). SQLite = D1 stand-in, static assets = R2
stand-in, adapter boundary in web/lib/db.js per spec. style.css md5-identical to live capture.
All 4 articles + perspective + about migrated with bylines, figure credits (Wikimedia CC BY
2.0 links), sources, and home composition preserved. Sites tools still unavailable — real
D1/R2/scheduler deployment path documented for stage 06/08.

## Stage 03 — Personas & rendering
Status: PENDING
Evidence: (stage fills: docs/verification/stage-03-personas.md)

## Stage 04 — Research pipeline & gates
Status: PENDING
Evidence: (stage fills: docs/verification/stage-04-pipeline-run.md)

## Stage 05 — Admin control room
Status: PENDING
Evidence: (stage fills: docs/verification/stage-05-admin.md)

## Stage 06 — Scheduling & publication
Status: PENDING
Evidence: (stage fills: docs/platform/SCHEDULING.md + docs/verification/stage-06-scheduling.md)

## Stage 07 — Acceptance verification & seeding
Status: PENDING
Evidence: (stage fills: docs/verification/acceptance-report.md)

## Stage 08 — Operations doc, activation & delivery
Status: PENDING
Evidence: (stage fills: docs/OPERATIONS.md + docs/DELIVERY.md)

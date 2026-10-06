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
Status: DONE (2026-10-04)
Evidence: docs/verification/stage-03-personas.md — 26/26 checks pass (5 author pages with
exact disclosure + distinct briefs/voice/tags; disclosure + legacy byline + valid Article
JSON-LD on all 4 articles; archive index + place + topic archives; related stories on every
article; homepage cover style retained; all stage-02 routes regression-clean).
Notes: web/scripts/seed-personas.js seeds the 5 spec personas verbatim (hash-guarded,
idempotent). Author pages /author/<id>; archives /archive, /archive/place/<slug>,
/archive/topic/<slug>. Legacy articles keep their "Folkly editorial" bylines and show the
Folkly disclosure. Reading time + dates computed from real body HTML in America/Los_Angeles.
Avatars are typographic initials (no fabricated headshots). Ops note: a stale node server
(PID 35960) from stage 02 still holds port 8787; the verified stage-03 server runs on
FOLKLY_PORT=8788. Reclaim 8787 by killing PID 35960, then `node web/server.js`.

## Stage 04 — Research pipeline & gates
Status: IN PROGRESS (implementation committed 2026-10-06; completion verification not recorded)
Evidence: docs/verification/stage-04-pipeline-run.md (not present in the current repository snapshot; add after verification).
Implementation commit: 016ba3b (staged pipeline, research records, verification, gates, calendar).
Notes: The commit adds the 16-state workflow with strict transitions and audit data,
deterministic gates, claim citation and editorial check ledgers, resumable jobs, image-rights
clearance, search and provider adapters, budget accounting, calendar slots, and pipeline
verification/smoke scripts. The prior 2026-10-05 notes reported a DDG search smoke, page
fetch, Ollama response, and a seeded pipeline run in progress; those results do not have a
committed run report in this repository snapshot. GitHub currently contains status markers
for stages 01–03 only; it has no stage-04 status marker. Console logs matching *.log are
ignored, so the live run outcome cannot be established from GitHub alone. Keep this stage
IN PROGRESS until verification results are committed and the stage status marker is written.

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

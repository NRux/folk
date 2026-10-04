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
Status: PENDING
Evidence: (stage fills: docs/preservation/inventory.md)

## Stage 02 — Platform & content migration
Status: PENDING
Evidence: (stage fills: docs/verification/stage-02-url-check.md)

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

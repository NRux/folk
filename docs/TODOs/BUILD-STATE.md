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
Status: DONE (2026-10-06; seven-article reserve replenishment is a Stage 06 pre-activation requirement)
Evidence: docs/verification/stage-04-pipeline-run.md (29/29 checks); docs/audits/2026-10-06-stage-04-debug-security-audit.md; `node web/scripts/test-stage04-security.js`.
Implementation: Stage 04 pipeline and audit fixes are committed on master. The real Tokushima article is ready with six retrieved sources, 24 linked claims, typographic image treatment, and AI/sourcing/no-firsthand-experience disclosure. The unsupported-claim and unresolved-image-rights fixtures reached their intended needs-review holds; both selected an available ready reserve candidate. The image-rights fixture reuses the verified seed dossier in an isolated checkpoint so it tests the image gate without creating a duplicate public article.
Notes: The database was verified on a disposable copy of the local development SQLite snapshot. Legacy numeric citation references were migrated to stable source IDs. Reserve selection now writes a selected-candidate audit event and job-step record. One verified ready article is present; Stage 06 must populate the seven-article operating reserve before activating daily publication.

## Stage 05 — Admin control room
Status: DONE (2026-10-06)
Evidence: docs/verification/stage-05-admin.md
Notes: Protected admin pages and APIs check the Sites-authenticated user ID against the configured
owner ID on every request; anonymous callers are rejected and signed-in non-owners receive 403.
Background job authorization uses a distinct scoped bearer credential. The dashboard reads the
calendar, pipeline, reserve, failures, and spend data; it reports scheduler state as unavailable
until Stage 06 installs the live registry. Owner controls persist audited edits, settings, topic
assignments/exclusions, pause state, failed-step retries, tomorrow replacements, version restores,
unpublishes, corrections, and explicit publish-now requests. Factual edits create a new version,
preserve/remap citations, invalidate verification, and queue revalidation. Publish-now is recorded
but not executed before Stage 06 installs the publisher. Verification: docs/verification/stage-05-admin.md.

## Stage 06 — Scheduling & publication
Status: DONE (2026-10-06)
Evidence: docs/platform/SCHEDULING.md; docs/verification/stage-06-scheduling.md; web/scripts/test-stage06-scheduler.js.
Notes: Added persisted one-shot publication and reserve-replenishment runners with Pacific local-date resolution, unique daily slots, serialized publication, latest-version eligibility rechecks, timeout-safe retries, delay tracking, separate content readback, five-minute retry backoff, and admin-visible failures/alerts. Provider budget reservations remain atomic under the existing daily/monthly caps. The owner control room now shows scheduler state, failures, and alerts. Verification passes across spring/fall DST offsets, two concurrent worker threads, timeout after commit, provider failure, empty reserve, backoff, and late same-day delay. The existing public Site has no MCP endpoint; the runner deliberately treats its publisher as unavailable and no recurring schedule was created. The transaction tests verify SQLite behavior only, not a live Site update. Stage 08 documents the MCP publisher and linked-schedule deployment path; activation remains gated on Stage 07.


## Stage 07 — Acceptance verification & seeding
Status: BLOCKED (2026-10-07)
Evidence: docs/verification/acceptance-report.md; docs/verification/reserve-fill.md;
web/scripts/verify-reserve.js; web/scripts/test-stage07-reader.js;
docs/verification/stage-03-personas.md; component evidence from Stages 02-06.
Notes: Local component checks pass for Tokushima, Stage 04 gate fixtures, Stage 05 owner controls,
Stage 06 scheduler fixtures, and a clean-checkout reader/draft-isolation fixture. A fresh Stage 03
run on an isolated current server passes 26/26; the previous four failures hit a stale process on
the default port. Seven locally researched and reviewed articles now pass the reserve gate;
the portable unpublished bundle is tracked for migration. Three other pitches remain held.
The live Site remains static and separate from this Node/SQLite repository; Worker/D1 migration,
a scoped publisher, and production provider configuration are still unimplemented. Production
write/readback, expired authorization, full deployed leak checks and mobile viewport checks
remain incomplete. No schedule was activated.

## Stage 08 — Operations doc, activation & delivery
Status: PENDING
Evidence: (stage fills: docs/OPERATIONS.md + docs/DELIVERY.md)

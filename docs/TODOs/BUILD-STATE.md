# Folkly Build State

## Priority TODO

1. Subscribe button and signup flow deployed; private Blob connected and live signup returned 200 after storage write on 2026-10-07. Independent readback, email delivery, and unsubscribe processing remain pending. Exclude acceptance-test@example.com from any delivery import.
2. Complete Vercel hosting migration: public reader first, then durable editorial storage and owner authentication. Keep publication and scheduling off until deployed acceptance passes.
3. About contact form implemented with reason, contributor interest and private Blob storage. Protected owner inbox shows up to 20 stored messages; pagination is implemented; reply workflow remains pending.
4. About now says Folkly is seeking contributors beside the contributor contact form.

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
2026-10-07 follow-up: the local publisher now requires deterministic checks, an independent passing review without major/critical findings, and claim citations to existing source IDs. The scheduler regression passed with four new hold fixtures. See docs/audits/2026-10-07-scheduler-publication-gate.md. The deployed Worker/D1 publisher is unchanged.
Notes: Added persisted one-shot publication and reserve-replenishment runners with Pacific local-date resolution, unique daily slots, serialized publication, latest-version eligibility rechecks, timeout-safe retries, delay tracking, separate content readback, five-minute retry backoff, and admin-visible failures/alerts. Provider budget reservations remain atomic under the existing daily/monthly caps. The owner control room now shows scheduler state, failures, and alerts. Verification passes across spring/fall DST offsets, two concurrent worker threads, timeout after commit, provider failure, empty reserve, backoff, and late same-day delay. At the Stage 06 milestone the public Site had no MCP endpoint; its local runner deliberately treated the publisher as unavailable. The Site now declares MCP, but remains unconnected and unscheduled. Transaction tests verify SQLite behavior only, not a live Site update. Activation remains gated on Stage 07.


## Stage 07 — Acceptance verification & seeding
Latest progress: Supabase folk project connected, three migrations applied,
hosted default-deny/RPC permission/paused-switch checks pass. Owner OTP read-only
screen, scoped lease RPC, and guarded model adapter implemented and locally tested.
See docs/verification/stage-7-progress-2026-10-07.md for remaining export, owner,
credential, and isolated recovery blockers. Stage 7 remains blocked.
Implementation plan: docs/platform/STAGE-7-PLAN.md covers verified storage, owner
authentication, scoped unattended publishing/model configuration, and hosted
recovery tests. AdSense, concise image credits, and listening examples are now
included in the public reader. Music examples are required in future music or
singing article review, including reserve review before publication.
Status: BLOCKED (2026-10-07)
Current Vercel prerequisite pass: public author pages and linked topic archives restored;
Supabase follow-up: connection variables are present in Vercel; secure server client
and 19-table Postgres migration prepared and locally tested. Hosted migration and
private reserve import are blocked until the Supabase connection exposes the Folkly
project rather than the older unrelated project. See docs/platform/SUPABASE.md.
requested reading-lens boxes removed; 59-route build and focused reader/subscription
checks pass. Added `npm run test:hosted` and `npm run test:mobile`. Chromium download
failed, so mobile acceptance remains unverified. Durable Vercel editorial SQL storage,
owner auth, scoped unattended publisher, production model/research provider, and
deployed concurrency/retry/failure/edit/restore checks remain missing. The historical
Sites/D1 results below do not clear Vercel acceptance. See the current matrix in
docs/verification/acceptance-report.md. No article schedule was enabled.
Evidence: docs/verification/acceptance-report.md; docs/verification/reserve-fill.md;
web/scripts/verify-reserve.js; web/scripts/test-stage07-reader.js;
docs/verification/stage-03-personas.md; component evidence from Stages 02-06.
Notes: Local component checks pass for Tokushima, Stage 04 gate fixtures, Stage 05 owner controls,
Stage 06 scheduler fixtures, and a clean-checkout reader/draft-isolation fixture. A fresh Stage 03
run on an isolated current server passes 26/26; the previous four failures hit a stale process on
the default port. Seven locally researched and reviewed articles now pass the reserve gate;
the portable unpublished bundle is tracked for migration. Three other pitches remain held.
The existing public Site was subsequently migrated to Worker/D1, with four legacy articles
published and seven reviewed reserve stories private. Its owner-gated admin and MCP publisher
are deployed. Site version 4 (`appgver_5f3600578d98819183e629fe4c3991b4`), source
`62c6f55044c5b7dff9605000fe9c52af0b56b98d`, adds an owner-only story evidence view
with the latest version, source and claim ledgers, checks, disclosure, and image rights.
The local authenticated fixture passed, including anonymous/non-owner denial and private
reader isolation. Hosted anonymous review denial and another 60-check reader regression passed.
Site version 5 (`appgver_bd0ec9d35f188191a5bf66903ce046d9`), source
`b61561338efa18c49759b4d5fb35b44fa89ac5ea`, binds every reviewed reserve story to
its complete evidence ledger and repeats mutable evidence checks atomically when claiming
the daily slot. The focused gate fixture passed twice, the production build passed, and all
seven live evidence digests matched before deployment. Post-deployment checks retained four
public stories, seven private reserve stories, zero publication slots, and all three switches off.
See docs/audits/2026-10-07-site-evidence-attestation.md.
Earlier two consecutive hosted reader/access passes each passed 60 checks. An isolated Worker/D1
fixture verified concurrent publish, retry and separate readback. Production-authenticated
write/readback, real hosted owner session, unattended connection, model provider, full hosted
failure suite, and mobile viewport remain incomplete. No schedule was activated; production
and publication switches are off.
On 2026-10-07 a schema-only D1 transfer artifact and a private content exporter/importer
were added. An isolated SQLite round trip passed with 16 articles, 19 versions, 88 sources,
including seven unpublished ready drafts. See docs/verification/site-migration-boundary.md.
This advances data portability but does not change the BLOCKED deployed acceptance result.
A read-only D1-shape reader fixture also passed legacy URL forms, five author pages,
and private reserve isolation. Its Worker packaging and live D1 binding are now deployed.

## Stage 08 — Operations doc, activation & delivery
Status: BLOCKED (2026-10-07)
Evidence: docs/verification/acceptance-report.md; docs/verification/site-migration-boundary.md.
Notes: Stage 07 is not fully green. The linked schedule stays inactive by the Stage 08 gate.



## Vercel progress, 2026-10-08 UTC

All recent work is synced to main/master; branch inventory contains only those
two branches. Owner sign-in has user-reported live success and the protected
read-only dashboard is deployed. Durable model budgets and scoped RPCs are
installed and verified with isolated hosted concurrency; caps remain zero.
GA4 read-only collector/private snapshot foundations now exist, disabled by
default. See verification/analytics-foundation-2026-10-08.md for tests and limits.
GA4 property 558035708 is configured, disabled, in Supabase and production
Vercel. Read-only Google token wiring and scoped analytics credential remain
missing. Property/stream matching and timezone verification remain pending. No live Google report/model calls or new cron ran.
Complete old Site export, content migration/commit/readback, worker credentials,
MFA, restore/recovery and full deployed acceptance remain pending. Security
advisor still reports disabled leaked-password protection in Supabase Auth.
All autonomous production/publication/schedule switches remain false.


## Analytics evidence safeguards, 2026-10-08 UTC

Per-article evaluation now requires 100 views and 14 observed days, both
conservative heuristics. Stale/immature windows, malformed observations and
qualified reports remain observe-only. See verification/analytics-evidence-2026-10-08.md.
No live Google access or automatic content revision was enabled.

## Contact and contributor intake, 2026-10-08 UTC

About contact form and protected read-only owner inbox implemented. Bounded
private Blob writes, validation, same-origin checks, honeypot and storage-failure
handling are tested. See verification/contact-2026-10-08.md. No email delivery,
newsletter enrollment or publication controls are added. Google Cloud setup
is deferred at Noah’s request; all autonomous switches remain off.

## Owner inbox pagination, 2026-10-08 UTC

Protected cursor pagination now reaches messages beyond the first 20, with
first/next controls, per-page owner/session verification, cursor bounds and
stale-response suppression after sign-out. Full hosted authenticated paging
remains pending. See verification/contact-pagination-2026-10-08.md.

## Direct editorial wording, 2026-10-08 UTC

Recorded Noah’s preference in platform/EDITORIAL-STYLE.md, updated two public
paragraphs to remove “Folkly reads…” framing, and added the rule to the model
system prompt. Private reserve evidence is untouched. Mobile acceptance retry
remains under verification; publication/schedules remain off.

## Owner-authorized manual release, 2026-10-08 UTC

Noah requested publishing the seven reviewed extra articles. Seven Vercel public
routes and homepage/archive links are prepared from the hash-verified original
bundle. See verification/manual-seven-release-2026-10-08.md and the manual
release manifest. Original Site records remain unchanged, but these stories
are now designated public and no longer constitute an unpublished reserve for
a future migrated pipeline. All autonomous switches remain off.


## Public discovery and SEO, 2026-10-08 UTC

The 11 published stories now have descriptive search titles and contextual
related-story links. Homepage/archive cards, place/topic lists and counts,
and persona publication histories derive from the published catalog. Seven
missing place routes are generated, with active discovery pages in the sitemap;
empty topic pages stay accessible but noindex. Article metadata credits Folkly
editorial as an Organization and preserves persona credits without claiming
human authors. See verification/seo-discovery-progress-2026-10-08.md and
seo/audit-2026-10-08.md. Build and full tests pass. Article H1s and researched
bodies/source lists remain unchanged. Search Console, responsive image work,
mobile measurements, duplicate-host redirects, and source-checked editorial
revisions remain pending. No autonomous switches or acceptance gates changed.


## Responsive public images, 2026-10-08 UTC

All ten illustrated public stories now have verified smaller JPEG candidates,
srcset/sizes selection, and reserved dimensions across hero/cards/article images.
Oaxaca's EXIF portrait dimensions are corrected; originals, credits, article text,
and private boundaries remain intact. Build and full tests pass; see
verification/responsive-images-2026-10-08.md for download-byte evidence and limits.
No model calls, migrations, credentials, releases, or autonomous switches changed.
Measured mobile performance and the separate deployed Stage 7 gates remain pending.

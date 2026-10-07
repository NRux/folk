# Stage 07 — Acceptance report

## Current Vercel acceptance, 2026-10-07

Latest Stage 7 progress: the Folkly Supabase project is now connected and three
migrations are applied. Hosted RLS/client denial, rolled-back server write/readback,
active-session RPC permissions, and paused scoped publisher claims pass. Owner OTP
and model/lease foundations are locally tested. No content or owner imported.
Lossless old Site export, owner provisioning, provider/worker credentials and an
isolated hosted recovery database still block completion. See
docs/verification/stage-7-progress-2026-10-07.md for current evidence; earlier
connection-blocker text below describes the previous state.

Reader follow-up: the shared public build adds the supplied AdSense loader once
inside every HTML head, including Subscribe and 404. Photo captions are shortened
while retaining attribution/license links and crop metadata. All three music
stories include verified artist/label/archive listening examples. Local build
and focused reader/subscription/Supabase suites pass. Stage 7 implementation order
and hosted failure cases are documented in docs/platform/STAGE-7-PLAN.md; these
presentation changes do not satisfy the pending hosted editorial gates.

Result: **BLOCKED**. Vercel is the required host, superseding the old Sites hosting
requirement. The historical results below are retained as evidence, not current
Vercel backend acceptance. The public reader and subscriber endpoint are deployed;
the autonomous editorial backend has not been migrated to Vercel.

Supabase follow-up: Vercel now lists Supabase connection variables for production
and preview. A pinned SDK, server-only client, verified owner-membership helper,
and 19-table PostgreSQL migration are prepared. Local PGlite checks verify RLS,
client-role denials, server write/readback, identity IDs, foreign keys, unique
daily slots, and disabled switches. These are local Postgres checks, not hosted
acceptance. The Supabase MCP currently exposes a different older application's
project; it has not been modified. Authorize the Folkly project's Supabase
connection before applying the migration and importing the private reserve.
See docs/platform/SUPABASE.md.

| Case | Current Vercel result | Evidence / next prerequisite |
|---|---|---|
| 1. Existing URLs and credits | PASS deployed Vercel | `npm run test:hosted` passed 38 checks covering both URL forms and exact built article HTML, including source and rights credits. |
| 2. Five editable author profiles and distinct voices | Public profiles restored; editing BLOCKED | Five public profiles and linked topic archives are included in the reader build. Protected editable profiles and versioned briefs need the Vercel editorial backend. |
| 3. Researched article through gates | Historical reserve retained; Vercel BLOCKED | Seven reviewed reserve stories remain private in the existing store. Vercel pipeline and editorial evidence storage are absent. |
| 4. Unattended article write and independent readback | BLOCKED | Subscriber Blob writes do not satisfy this gate. Need scoped editorial writer credentials and durable article storage. |
| 5. 07:00 Pacific across DST | Local calculation evidence retained | No Vercel article schedule configured or enabled. |
| 6. Simultaneous publishers | Hosted DB component PASS; full gate BLOCKED | Private synthetic schema: five simultaneous claims yielded one lease, four busy, and one slot. Vercel trigger and article commit still pending. |
| 7. Timeout/retry deduplication | Hosted DB component PASS; full gate BLOCKED | Committed-claim retry kept its lease; expiry recovered with a new token; synthetic published state reconciled its hash. Vercel timeout/served-content readback remains pending. |
| 8. Claim/image hard gates | Focused local fixture passes | `node web/site-runtime/hosted/scripts/test-publication-gates.mjs`; port and exercise these checks in the Vercel publisher. |
| 9. Failure recovery | BLOCKED hosted | Need deployed owner controls, provider, unattended authorization, and isolated failure fixtures. |
| 10. Private reads/writes | Anonymous reader checks PASS; owner BLOCKED | Hosted regression confirms admin/MCP and all seven reserve slugs return 404. No Vercel owner write endpoints exist. |
| 11. Mobile, restore, edits, corrections | BLOCKED | Mobile runner added for 375/390/768 px; Chromium download failed with truncated archive. Cloud browser has no viewport control. Restore/edit/correction backend is absent on Vercel. |

Changes in this pass: removed the requested reading-lens comment boxes from all
rendered stories, preserved source citations and credits, restored five public
author profiles and 38 linked topic archives, and added repeatable hosted/mobile
reader checks. Build and local reader/subscription checks pass for 59 public routes.
The user's requested removal of the repeated article disclaimer is an explicit
presentation override; no evidence, claim, media-rights, or publication gate was disabled.

Hosted verification: Vercel deployment dpl_5LAYJ2YnVM8NDwxVVhaaZiKhZ3gz reached
READY for source d571ab35943850644abaf13e9edea2d7877be169. The public custom domain
passed 38 live reader checks. All four articles matched the tested build byte for
byte, both URL forms resolved, five authors and signup navigation worked, lens
boxes were absent, and private routes returned 404. Build/local checks passed
twice; publication evidence fixture passed; npm production audit found zero
vulnerabilities. Mobile runner failed to launch because Chromium was unavailable,
and its attempted official download returned a truncated archive. No mobile PASS
is claimed. This evidence closes reader prerequisites only, not Stage 7 overall.

To unblock: connect a Vercel-compatible durable SQL database (for example Neon or
Turso), an owner authentication provider with verified owner authorization, and a
server-side model/research provider. Implement the Vercel editorial adapters and
scoped unattended publisher, then verify writes/readback, concurrency/retry, owner
mutations, provider/auth failure recovery, and mobile behavior. Blob stores the
subscriber list; it is not the required transactional editorial database. Do not
publish the private reserve, activate article production/publication, or add a cron
until all gates pass. No new real article or publication slot was created here.

## Historical Sites and local acceptance

Date: 2026-10-07
Result: **BLOCKED**. The public Worker/D1 reader and owner-gated publisher are deployed, but
the authenticated unattended connection, production provider, hosted publication/readback,
mobile verification, and complete failure suite are not accepted. No hosted article was published.

Site version 5, deployed on 2026-10-07 from source
`b61561338efa18c49759b4d5fb35b44fa89ac5ea`, closes a post-review evidence-mutation
gap. Each reserve story is now attested to its source, claim, check, and applicable
image-rights records, and the Worker repeats those gates atomically when claiming a slot.
The focused fixture passed twice; all seven live reserve evidence digests matched before
deployment. The deployed database still has four published stories, seven private ready
stories, zero publication slots, and false production, publication, and schedule switches.
This improves cases 3, 6, 7, 8, and 10 but does not clear the remaining authenticated,
provider, failure-recovery, or mobile gates. See
`docs/audits/2026-10-07-site-evidence-attestation.md`.

The 2026-10-07 local scheduler review closed a publication-gate bypass in the
Node/SQLite runner: missing deterministic checks, missing or adverse independent
review, and dangling cited source IDs now hold a candidate. The scheduler
regression passed with four new negative fixtures. This repository change is
not yet deployed to the Worker/D1 Site and does not alter the blocked result.
See `docs/audits/2026-10-07-scheduler-publication-gate.md`.

## Acceptance matrix

| Case | Result | Method and evidence |
|---|---|---|
| 1. Existing URLs and credits | PASS deployed | Four published stories retain both URL forms, main content and figure credits. `node web/scripts/verify-hosted-reader.js` passed twice against the deployed Site, 60 checks per pass. Stage 02 and the local reader fixture provide the original baseline. |
| 2. Five author profiles and distinct voices | PASS locally; profiles deployed | A fresh `verify-stage03.js` run against an isolated server on port 18787 passed 26/26 checks, including voice distinctions. All five author URLs return 200 on the deployed Site. See `docs/verification/stage-03-personas.md`. |
| 3. Real researched article through gates | PASS locally; hosted evidence view deployed | `node web/scripts/verify-reserve.js web/folkly.db` reports seven eligible articles, each with a version hash, at least five retrieved sources, linked claims, deterministic checks, and an independent pass without major or critical findings. Tokushima was revised to 1,222 words after removing a duplicated source list; its six sources, 24 claims, typographic treatment, and disclosure remain. Site version 4 adds a private owner view of version, sources, claims, checks, disclosure and image rights. Its local auth fixture passed, but real hosted owner viewing remains unverified. See `docs/verification/reserve-fill.md` and `docs/verification/site-migration-boundary.md`. |
| 4. Unattended production credentials and independent readback | BLOCKED | A local Ollama model produced the reserve at zero metered provider cost. The deployed Site declares `/mcp` with `folkly_publish_today`, but its connection and a hosted production model are unavailable. A local D1 publisher fixture read back a single article/version/hash; no authenticated hosted write/readback occurred. |
| 5. 07:00 Pacific across DST | PASS (time-resolution logic) | `node web/scripts/test-stage06-scheduler.js` verifies 2026-03-07/09 and 2026-10-31/11-02 at 07:00 Pacific with the expected GMT-8/GMT-7 offsets. This verifies the scheduler calculation, not an active platform schedule. |
| 6. Two simultaneous publishers | PASS in isolated fixtures; hosted BLOCKED | Two Node worker threads and independent SQLite connections yield one slot. A local Worker/D1 fixture also gave one published Kimjang article under two concurrent calls. Hosted concurrency was not exercised. See `docs/verification/stage-06-scheduling.md`. |
| 7. Timeout after publication | PASS in isolated fixtures; hosted BLOCKED | A simulated post-commit timeout followed by retry returns `already-published` in SQLite. The local Worker/D1 fixture retry returned the same slot after publication and readback. Hosted timeout/retry remains untested. |
| 8. Unsupported claims and uncleared images | PASS | The Stage 04 verifier confirms both fixtures stop at `needs-review`, fail their intended gates, and select a ready reserve candidate. |
| 9. Pause, budget, provider failure, empty reserve, expired authorization, missed schedule | BLOCKED as a complete case | Local Stage 05/06 failure fixtures pass. A synthetic owner request paused the hosted-style admin fixture; budget input validation and cross-origin rejection passed. Deployed anonymous access passed, but authenticated hosted owner, expired OAuth, provider failures, and platform-triggered missed schedule remain untested. |
| 10. Private reads/writes and draft-leak prevention | PASS for anonymous deployed reads; owner BLOCKED | The hosted reader check confirms all seven ready slugs return 404, do not appear on the home page, and use no-store. `/admin`, `/admin/story`, `/api/admin`, and MCP calls reject anonymous requests; the removed bootstrap route returns 404. Forged owner headers were rejected by the Sites boundary. The story evidence view passed local sign-in, non-owner denial, and draft-isolation tests. Authenticated hosted owner access and mutations remain untested. |
| 11. Mobile, restore, edit, correction | BLOCKED as a complete case | Stage 05 tests restore, versioned edits, and correction notes. No mobile viewport/browser acceptance test was available or run. |

The reader fixture is repeatable from a clean checkout and does not alter the operational database.
The full eleven-case integration suite cannot pass yet: hosted owner identity and publisher,
provider, schedule, failure recovery and mobile verification remain release gates.

On 2026-10-07, two consecutive local debug/security passes ran `test-stage04-security.js`,
`test-stage05-admin.js`, `test-stage06-scheduler.js`, and `test-stage07-reader.js`; all four
passed in both rounds after the reserve pipeline changes.
These checks exercise owner authorization, stored-content sanitization, publication concurrency
and retry, and draft isolation. Two later hosted reader/access passes each passed 60 checks,
covering public content and anonymous access. These do not constitute two clean production
security audits: authenticated writes and the production pipeline remain unverified.

## Post-seed snapshot

The local development database contains **7 eligible ready articles out of the 7-article target**:
Tokushima, Kimjang, Castells, Xochimilco chinampas, Nowruz/sumanak, Bonwire kente, and
Matariki/Puanga. They cover seven countries and four personas (Mira 1, Lena 2, Rowan 2,
Sasha 2; Ellis 0). The three other researched candidates, Gnaoua, Havana rumba, and
T'nalak, remain held for review and are excluded. The independent reviews still note
minor editorial issues; there are no unresolved major or critical findings in the ready set.
See `docs/verification/reserve-fill.md` for each source and claim count.

There are 32 open local slots (30 dated 2026-10-07 or later), with no newly published
article. The earliest not-past local slot is 2026-10-07, but it is not an activated
first publication date. No article is assigned to an upcoming slot, so a 30-day theme
or persona sequence cannot yet be measured. The local model's metered cost was $0;
budget reservations were released. The SQLite database is ignored by git; a
credential-free, unpublished content bundle is tracked at `web/data/reserve-seed.json`.
The seven reviewed stories are also private records in hosted D1. None is publicly released.

## Required to unblock

Connect and verify the deployed Site's scoped MCP publisher under the real owner identity,
configure a supported server-side model provider, and port the Node research/replenishment
pipeline and remaining owner editorial controls into the hosted runtime. Then run the eleven
cases against the deployed Site, including a controlled authenticated write and independent
production readback, OAuth expiry, failure recovery, and mobile viewport checks. The Site
connection and model-provider plugin were surfaced for connection; a suggestion is not a
connection. Keep both autonomous switches and the recurring schedule inactive until accepted.


# Stage 07 — Acceptance report

## Remembered owner sign-in and explicit delivery test, 2026-10-10 UTC

Implemented a checked Keep me signed in choice, short secure HttpOnly access
cookies and a rotating, host-only 30-day renewal cookie. Private API preflight
restores the session without sending an OTP email; owner identity, private
membership and native active-session/revocation checks still run. Same-origin
refresh, no-store responses, serialized renewals and logout races fail closed.
Private writes and paid actions are never replayed automatically. Sign-out clears
both cookies and retains existing global session revocation. One new code sign-in
is necessary because older sign-ins never stored a refresh token. Unchecking the
choice retains the short-lived behavior; account policies can end access earlier.

The next newsletter gate now has an owner-only, explicit consent test in Subscribers:
one message to the configured owner email per UTC day, immutable private claim and
verified provider receipt, then a separate I received the test email attestation.
Startup/status reads send nothing. Ambiguous attempts remain held; neither automatic
retry nor subscriber enumeration is possible. Both article switches and weekly
mailing must remain paused. This transactional test does not replace newsletter
signed-unsubscribe or hosted publisher/recovery acceptance.

Build is 73 pages/11 stories; all 41 regression commands pass. Security fixtures
cover cookies/rotation/revocation/outages, GET-only recovery, no POST replay,
explicit mail consent, fixed recipient, concurrency/ambiguous outcomes, secret
redaction and stale/logout response isolation. Native inventory is 11 articles,
15 versions/references and all three autonomous switches false. No actual email,
paid provider call, subscriber mutation or publication occurred in these checks.
Authenticated remembered-session and actual provider/mailbox acceptance remain
OPEN until the owner performs the new controls. See
verification/owner-remembered-session-2026-10-10.md and
verification/owner-newsletter-delivery-test-2026-10-10.md.

Deployment follow-up: c46c392 is live, with 45 reader and eleven new public safety
checks PASS. Actual owner browser shows the checked remembered-sign-in control;
no live authenticated session was available. Provider/mailbox and real renewal
acceptance remain open; no email sent. See
verification/owner-session-newsletter-public-2026-10-10.json.

## Isolated hosted newsletter storage recovery, 2026-10-10 UTC

Implemented an administrative single-use, ten-minute, deployed-code-bound recovery
check. It reuses the existing private Vercel Blob store, maps every path under a
separate acceptance/newsletter grant namespace, accepts no subscriber/path/provider
input, and imports no mail adapter. Eleven checks cover five competing claims,
immutable claims/separate receipts, lost-write replies, interrupted claims,
receipt-only and complete restored copies, first-timestamp suppression, corrupt
suppression denial, synthetic subscriber enumeration and independent inventory
readback. No evidence is deleted or overwritten, and no email can be sent.

The new private grant migration is applied in existing Supabase. Administrative
issuance only, private RLS/client denial, single-use/expiry/lease and paused-state
fences, rollback-only hosted claim/completion, zero leftover fixture grants and all
three production switches false pass. Build is 73 pages/11 public stories; all 39
regression commands pass. Concurrent translation drafts stay unapproved. Actual
Vercel execution PASS at 02:11:55 UTC: all eleven checks/ten isolated objects,
independent exact receipt/retired-grant verification and actual replay 401/no-store.
All 45 deployed reader checks pass. Full provider/mailbox/owner and publisher
recovery gates remain open. Newsletter delivery and
autonomous publishing stay off. See verification/newsletter-hosted-storage-recovery-2026-10-10.md.

## Signing-secret runtime prerequisite and owner newsletter preview, 2026-10-10 UTC

PASS signing-secret presence prerequisite: after Noah saved the production value,
invalid-token GET returns 400/no-store instead of 503. This proves the configured
signing guard passes, not signed-link verification, persistence or mailbox delivery.
No actual token, subscriber write or outgoing email was used.

PASS implementation/local checks: protected read-only readiness and upcoming-digest
preview, shared worker configuration/catalog, public-only bounded fields, exact
next-Friday/date-only/DST windows, safe preview text and logout/late-response privacy.
Build and all 38 regression commands pass. All three hosted autonomous switches
remain false. Existing public content and concurrent unreviewed translations are
preserved; no approval, locale release, provider job, subscriber mutation or cron
change occurred. Evidence: owner-newsletter-preview-2026-10-10.md.

Actual owner browser inspection still shows an expired session. Fresh secure
sign-in and isolated provider/mailbox/persistence/restore acceptance remain OPEN.
No further NEWSLETTER_SECRET action is currently required. Configuration presence
is not verified credentials or accepted delivery; all activation remains off.

Feature commit bd0c482 deployed successfully; 45 reader checks, anonymous protected
preview/cron 401/no-store and invalid unsubscribe 400/no-store pass. Late deferred
script startup is explicitly fixed/tested. Actual authenticated viewing and full
provider/mailbox/restore gates remain open. See owner-newsletter-public-2026-10-10.json.

## Newsletter persistence/recovery prerequisite, 2026-10-10 UTC

PASS implementation/local evidence: verified create-only claims, separate immutable
terminal receipts, first-timestamp suppression, legacy/partial-restore resend guards
and complete bounded subscriber validation before delivery. Private stream reads
are size/time bounded and strict UTF-8; corrupt suppression makes the owner inbox
unavailable. Error and denial responses are no-store. Build and all 37 regressions
pass, including actual adapter concurrency and simulated persistence/transport loss.
Read-only hosted Supabase confirms all three autonomous switches remain false.

Full hosted newsletter/provider/restore acceptance remains OPEN. No mail or actual
subscriber mutation was used to test this change; fixtures do not establish hosted
delivery. Noah reported secrets configured, so no new credential setup is requested.
Vercel connector inspection remains deferred. A fresh secure owner session is still
needed for authenticated readback; isolated consented-recipient acceptance must
precede any weekly delivery activation. See newsletter-persistence-recovery-2026-10-10.md
and ../platform/NEWSLETTER.md. No article, schema, cron or activation switch changed.

Deployed code fd7ccf5 is successful; 45 reader checks and anonymous 401/no-store
newsletter/owner denial pass. Unsubscribe runtime prerequisite remains BLOCKED:
live invalid-token GET returns 503 because production NEWSLETTER_SECRET is missing
or shorter than 32 characters. Verify the existing signing value in Production
and redeploy without rotating valid links. No credential value is requested in
chat. Evidence: newsletter-public-denial-2026-10-10.json.

## Saved-version UI prerequisite and design handoff, 2026-10-10 UTC

Protected metadata-only history and exact article/version body selection now support
latest and older saved-version previews, including already-published stories. The
UI has verified-content loading, safe text rendering, keyboard focus and stale/late
response rejection. Dashboard source-import status comes from the private verified
aggregate receipt. All 36 regressions and the 73-page build pass; hosted inventory
remains 11 articles/15 versions/references with all three switches false.

Actual authenticated draft viewing remains BLOCKED by the expired browser owner
session. No source export or new provider secret is required: use secure owner
sign-in to establish a fresh session, then inspect latest and historical versions.
Full isolated publisher/newsletter/provider outage/restore and reviewed-language
acceptance remain pending. Design brief: ../design/OWNER-PANEL-REDESIGN-HANDOFF.md.
Evidence: owner-version-browser-2026-10-10.md. No paid call, publication, delivery
or publisher/schedule activation occurred.

## Actual editorial transfer and hosted readback PASS, 2026-10-09 UTC

The complete source was transferred inside existing Vercel using existing server
secrets. All eleven metadata/evidence tables, 11 already-public articles and 15
private version bodies are imported; two exact-field database sweeps, byte-exact
Blob reads and immutable original backup passed. Separate administrative field
digest/count/reference checks also passed. The import grant is verified/retired,
its aggregate receipt persisted, and actual replay plus anonymous requests return
401/no-store. All three autonomous switches remain false; no new publication,
paid model/translation call or outgoing newsletter occurred. Build/all 36 regression
commands and 45 deployed reader checks pass, with additional private CLI guards.

Source export, actual transfer and exact hosted readback are PASS, superseding
older missing-source/empty-destination/credential-access claims below. No new source
export or provider-secret setup is needed from Noah for this prerequisite. Full
Stage 7 remains BLOCKED for authenticated owner draft readback and complete hosted
isolated publisher/newsletter/provider outage/restore acceptance. Historical source
versions do not replace later public revisions or validate their evidence.
See [live transfer report](hosted-editorial-import-2026-10-09.md) and
[aggregate receipt](editorial-import-live-2026-10-09.json).

## Vercel-resident import checkpoint, 2026-10-09 UTC

The private transfer can now run inside Vercel using existing provider environment
credentials and a short-lived administrative grant bound to the exact independent
source receipt and deployed contract. Migration, service-only invoker RPC/role
checks and rolled-back hosted guard fixtures pass. Build and all 36 regressions
pass, including late transaction rollback, append-only object retries, stale/used
claims, installed SDK serialization and HTTP input/auth/redaction boundaries.

This checkpoint is implementation evidence; actual source upload, import and
hosted exact readback are not yet claimed. No publisher switch or article content
changes. See [transfer evidence](hosted-editorial-import-2026-10-09.md). Any later
actual-transfer addendum in that report supersedes this pending checkpoint.

## Original source export gate completed, 2026-10-09 UTC

PASS for complete source extraction: Codex recovered the original ChatGPT Site
source, deployed a bounded read-only authenticated export and captured two matching
live D1 snapshots with a source-generated checksum/count receipt. All 11 editorial
tables and 15 full version bodies pass the current import compiler; all 11 articles
are already public under the release manifest. Temporary export access was revoked
and redeployed; anonymous/former-token requests receive 404/no-store. The verified
private archive is saved outside Git. Noah has no source-export action remaining.
See [source export evidence](original-site-export-2026-10-09.md).

Stage 7 remains BLOCKED for actual private Blob upload, metadata commit, independent
hosted readback, owner draft/recovery and remaining provider/newsletter/language
acceptance. This run did not import content or enable any autonomous switch. Existing
provider secrets need access from the trusted import runner, rather than being
recreated or shared in chat; Vercel connector work remains deferred as requested.
This addendum supersedes all older missing-source-export requirements below.

## Current owner and transfer verification, 2026-10-09 UTC

The latest owner-hosted-acceptance report supersedes older editor/idea-save
availability blockers: a real editor reply persisted and independent idea-save
readback passed. Translation spending controls are deployed; the owner supplies
the actual numeric limit/expiry separately. Saving alone starts no paid job.

The next content-transfer prerequisite now has a repeatable independent read-only
verifier for all eleven metadata/evidence tables, exact private version bodies,
immutable snapshot backup, complete ordered pages and observed concurrent drift.
Build/all 35 regressions pass, including actual SDK read serialization and
isolated interrupted-import/Blob-corruption checks. Live metadata readback still
shows zero imported rows/references; all three article switches remain false.
No full source export, transfer, restored private draft, live recovery run, mail
or translation was produced here. Stage 7 remains BLOCKED pending those actual
hosted gates; this is supporting tooling, not a hosted transfer PASS. See
[readback evidence](editorial-import-readback-2026-10-09.md).

## Latest translation/runtime follow-up, 2026-10-09 UTC

Translation job/usage/recovery code and reviewed shared discovery/form/privacy
rendering are implemented and deployed. Pilot/model approval, reviewer provision,
GA4 settings/DebugView work and provider secrets are completed per the owner;
these are no longer owner setup requests. Full Stage 7 activation remains BLOCKED:
original lossless content export, Vercel project visibility, authenticated runtime
provider/newsletter recovery and actual reviewed language output are still needed.
The 31-command regression, rolled-back hosted SQL ledger tests and 60 public
readback checks pass. All article switches are false; no paid call, locale release
or outgoing newsletter occurred. See [current evidence](translation-pilot-runtime-2026-10-09.md).
This follow-up supersedes older setup/implementation blockers below. Google Cloud
reporting remains deferred. Local/provider mocks do not establish full hosted gates.

## Current addendum, 2026-10-09 UTC

Result remains **BLOCKED** for autonomous activation. This addendum supersedes
historical account/connection assumptions in dated sections below. Owner Auth
provisioning, Supabase migrations, private Blob storage foundations and protected
owner workspace exist; the owner has reported successful login. Independent
hosted private readback/provider/content/recovery acceptance is still distinct
from that report and from passing local fixtures. The catalog contains eleven
public stories, including seven already manually released; they are not reserve.

| Gate | Current evidence / remaining requirement |
| --- | --- |
| Public reader, credits and discovery | Existing deployed foundation; new locale/event code passes local regression. See translation-reader-events-2026-10-09.md for deployment readback status. |
| Translation source/review boundary | PASS local and isolated build fixtures; stale/unreviewed/tampered/private denial, complete coverage and immutable credits. Empty production manifest. |
| Real translation launch | BLOCKED pending paid pilot authorization, translation job adapter, competent six-language review, localized discovery/shared UI and actual browser/hosted checks. |
| Consent-aware reader events | PASS offline event-wiring/privacy/signup timing tests. Live GA property/stream/dimension/DebugView and enhanced-measurement settings are not verified. |
| Editorial content import | PASS complete source export, actual private Blob upload/transactional metadata import, exact two-sweep readback and independent administrative comparison (2026-10-09). Owner draft/recovery remains a separate gate. |
| Funded unattended generation | BLOCKED pending scoped provider/worker credentials, approved budget/pricing and live usage/redaction/persona evidence. Local paused/budget/ledger tests pass. |
| Hosted recovery and publication | Earlier scoped hosted component fixtures exist; full Vercel commit/readback/backup/failure recovery gates remain pending. |
| Resend newsletter acceptance | Signing-secret runtime guard now passes (400/no-store on invalid token); read-only owner readiness/preview and immutable persistence pass local checks. Fresh authenticated owner and isolated provider/mailbox/persistence/restore evidence remain pending; delivery stays off. |
| Vercel protected inspection | Connector inspection deferred at Noah's request. Existing project and GitHub deployment remain in use; public checks do not establish protected runtime/provider gates. |

Production/autonomous publication/article scheduling stay disabled. Google Cloud
remains deferred. No new public story, translated story or outgoing email was
created by this implementation. Full regression and two focused debug/security
passes are recorded in translation-reader-events-2026-10-09.md. A missing local
Chromium executable prevents actual viewport acceptance; synthetic event tests
are not substituted for native-language or visual review.

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


# GA4 editorial feedback implementation prompts

Status: partial foundations implemented; live reporting and editorial automation remain gated. Tracking stream: G-RQJD3XG35C; property: 558035708.
Run prompts in order. Each prompt inherits the shared constraints below.

## Shared instructions for every prompt

Work in the existing NRux/folk repository, Vercel folk project and Folkly
Supabase project vxmyggasjgsiohqzzwzh. Read AGENTS.md if present, current
BUILD-STATE, Stage 7 plan, acceptance report and latest verification reports.
Inspect actual code before changing it; previous documentation may be stale.
Preserve the current eleven public stories and any remaining private reserve, persona styles,
source/evidence hashes, photo credits, licenses and music examples.
Use the current manual-release manifest: the seven manually released stories are
already public and must not be counted as remaining reserve.
Keep production.autonomous_enabled, publication.autonomous_enabled and
schedule.enabled false. Do not create or enable a publication cron. Analytics
collection needs a separate disabled-by-default switch and explicit activation.
Do not enable any external schedule as part of these prompts.
Never place secrets in client code, repository files, logs or model prompts.
Do not ask for secrets in chat. Configure credentials through secure provider
settings. A measurement ID is not a numeric GA4 property ID or API credential.
Use pinned dependencies, migrations, private RLS tables and narrow RPC grants.
Review current official Google/Supabase/Vercel docs before implementation.
Test meaningful failures and privacy boundaries, document evidence and concrete
blockers, then commit verified changes and sync main/master without overwriting
concurrent work. Do not claim a deployed gate passed from mocks or local tests.

## Prompt 1: Read-only connection and configuration

Implement a server-only GA4 Data API adapter and configuration validation.
Use GA4 measurement ID G-RQJD3XG35C only for existing client tracking. Require
GA4_PROPERTY_ID as a numeric ID for reporting, verify the expected production
web stream/property relationship during setup, and document that prerequisite.
Use a dedicated service account with Viewer access to only the Folkly property
and analytics.readonly scope. Prefer supported short-lived/federated credentials;
if a service-account key is necessary, store it securely server-side. Never
reuse owner sessions or broad Google account credentials for unattended work.
Add empty configuration examples and a secure connection guide. Do not change
Google permissions automatically or invent property IDs. Missing access must
fail closed with a useful redacted error. Test invalid IDs, wrong property,
missing credentials, denied access and redaction with injected API fixtures.
Acceptance: private adapter can issue a bounded report request; no client bundle
contains credentials; live connection remains explicitly blocked until granted.

## Prompt 2: Article identity and event instrumentation

Inspect existing GA4 injection and subscription flow to prevent duplicate tags
or page views. Define stable article IDs and immutable content-version IDs.
Canonicalize /story and /story.html into the same reporting identity. Strip
query strings/fragments; exclude owner/private/preview routes and test traffic.
Add once-per-page-version article_read_depth milestones at 25/50/75/90 percent,
related_story_click and music_example_click events, plus subscribe_success only
after the private subscription record is successfully stored. Do not report
failed forms or button clicks as successful subscriptions. Document repeated
subscription semantics; never imply unique new subscribers from raw event count.
Register/document low-cardinality event parameters and any necessary GA4 custom
dimensions. Avoid high-cardinality free text and article-version dimensions in
routine aggregate reporting; use a release registry for version/time mapping.
Send no email, OTP, owner identity, user-entered text or arbitrary full URLs.
Apply the site's consent behavior; do not bypass it to increase tracking coverage.
Acceptance: event payload/browser tests verify correct success timing, consent,
no duplicates/PII and article identity. Record DebugView/Realtime evidence only
when authorized live GA4 access exists. Scroll depth is a proxy, not comprehension.

## Prompt 3: Durable daily metrics collection

Create private Supabase records for analytics sync runs and article metric
snapshots. Store property, canonical article identity, date window, property
timezone, retrieval time, report/query version, release mapping, completeness
flags and source response hash. Unique keys/upserts make retries idempotent.
Create a server-only collector with separate scoped access. No publisher/owner
administration permission. Plan a daily collection cadence but leave scheduling
disabled. Support manual protected execution with bounded reporting requests,
quota awareness, timeouts, backoff and persisted checkpoints.
Fetch compatible report groups for page views/active users/engagement duration,
landing-page sessions/channel/device and custom event counts. Validate metric
and dimension compatibility through current API metadata/checkCompatibility.
Do not mix event-, session- and user-scoped denominators as if interchangeable.
Filter verified production hostnames. Do not include full URLs in AI briefs.
Exclude the newest two days from decision windows; refresh the last 14 days for
late/modelled data. Compare trailing 7/28 days with preceding equivalent windows.
Store additive daily measures; request distinct users for each complete window
rather than summing daily unique users. Preserve thresholding, sampling and
(other) row metadata. Missing rows are not automatically zero observations.
Acceptance: synthetic fixtures prove pagination, aggregation, late corrections,
idempotency, quota/outage recovery, privacy, RLS and no production switch changes.

## Prompt 4: Deterministic evidence and confidence checks

Implement a metrics evaluator before adding AI recommendations. Map analytics
only to existing public articles and release history. Compare articles within
appropriate age/topic/channel/device cohorts rather than raw popularity alone.
Separate acquisition, reading engagement, exploration and subscription events.
Define explicit denominators and uncertainty. Event/view ratios are descriptive,
not user conversion probabilities. Record consent coverage and traffic changes.
Require configurable minimum exposure and observation windows; start with a
conservative heuristic such as 100 eligible views across at least 14 days, and
label that threshold as a heuristic, not statistical significance. If traffic
is insufficient, return observe_only. Exclude stale, thresholded, sampled or
poorly mapped data from automatic decisions unless explicitly qualified.
Produce bounded structured briefs: measurements, windows, sample sizes,
comparisons, confidence limitations and eligible hypotheses. No causal claims
from pre/post correlations. Flag instrumentation failures separately from content.
Acceptance: tests cover tiny samples, launch spikes, bot/test contamination,
late data, duplicate URLs, missing denominators and channel mix changes.

## Prompt 5: AI proposal generation with budget controls

Create private editorial proposal storage. Integrate with generateBudgetedDraft
and the scoped durable model ledger; one immutable attempt UUID per model call.
Use the configured latest ChatGPT model and approved expiring price ceilings.
No call when generation is paused or spending configuration is unapproved.
Analytics collector operation must not implicitly authorize model spending.
Provide the model only the bounded evidence brief, article version, persona,
editorial rules and vetted sources. Treat analytics values and source text as
untrusted data. Analytics cannot support factual claims about culture/history.
Require strict structured output: evidence snapshot IDs, observed pattern,
hypothesis, proposed content diff, expected metric, uncertainty, risk, source
citations, evaluation window and rollback conditions. Validate supplied source
IDs and music links. Every factual addition needs editorial evidence.
Initially permit drafts for clearer introductions, headings, internal links,
listening cues and subscription placement. Flag factual/citation/persona changes
for explicit review. Reject unsupported claims, clickbait and fabricated findings.
Acceptance: mock model tests cover malformed outputs, invented evidence,
injection, provider timeout/429, budget denial and failed usage persistence.
Live persona evaluation requires approved budget and authenticated access.

## Prompt 6: Private owner review and versioned release integration

Add an authenticated owner view of evidence, uncertainty and proposed diffs.
Show Observe, Draft and Apply as separate states. Start in Observe; draft mode
requires bounded model authorization. Apply remains unavailable until all
existing deployed Stage 7 gates pass. Retain server-side membership/session,
origin checks and MFA for publishing/configuration actions.
Connect accepted proposals to immutable article versions and the existing
publication lease/fencing, editorial gates and independent served hash readback.
No analytics worker can approve, publish or modify private reserve records.
Preserve original versions and attribution; never overwrite public content
without a recoverable release. Every release records proposal/evidence/version
IDs, actor, checks and rollback target. Idempotent retries reconcile a completed
release rather than publishing twice. If content commit/readback infrastructure
is still missing, implement it with synthetic isolated fixtures first.
Acceptance: non-owner/revoked-session denial, MFA, stale version rejection,
competing revisions, timeout after commit, readback mismatch and rollback tests.

## Prompt 7: Evaluation and editorial diversity

Store revision evaluations with baseline/post-release windows and immutable
version history. Evaluate hypotheses after sufficient delayed GA4 data arrives.
Use controlled experiments where practical; otherwise label results observational.
Define one primary outcome per proposal plus guardrails for engagement,
subscriptions and editorial quality. Check channel/device changes and concurrent
site releases before interpreting movement. Do not optimize solely for views.
Cap revision frequency and simultaneous experiments. Require evidence before
promoting a change; ambiguous results return to observation, not repeated edits.
Reserve a configurable portion of future assignments for underrepresented
cities, traditions and personas. Analytics can guide assignments but must not
eliminate cultural breadth or change reserve approval rules.
Automatic rollback only executes a preapproved safe policy through publication
controls; otherwise create an owner review task. Keep Apply and schedule off.
Acceptance: fixtures cover noisy gains, regressions, multiple comparisons,
insufficient samples, cohort changes and diversity constraints.

## Prompt 8: Hosted acceptance and documentation

Run the whole flow in an isolated hosted environment with synthetic analytics
responses and synthetic articles, followed by read-only live property verification
when credentials are available. Record commit/deployment IDs, timestamps,
query windows, fixture IDs, content hashes, ACL results and cleanup evidence.
Prove: collection retry does not duplicate data; interrupted model call does not
reuse reserved spend; wrong property/credential fails closed; small samples do
not produce automatic changes; analytics worker cannot publish; consent/PII
boundaries hold; concurrent release produces one version; rollback restores
verified content; original public stories/private reserve remain preserved.
Run focused debug/security checks twice, document unresolved findings honestly,
and update BUILD-STATE, acceptance report and this prompt checklist.
Completion does not authorize activating autonomous publication or any cron.
Report exact connection/credential actions still required from Noah.

## Reference starting points

Recheck current documentation before coding:
- https://developers.google.com/analytics/devguides/reporting/data/v1/property-id
- https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart
- https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema
- https://support.google.com/analytics/answer/11198161
- https://support.google.com/analytics/answer/9216061

## Progress

- [ ] 1. Read-only connection
- [ ] 2. Article identity/events
- [ ] 3. Durable collector
- [ ] 4. Evidence/confidence checks
- [ ] 5. Budgeted AI proposals
- [ ] 6. Owner review/versioned releases
- [ ] 7. Evaluation/diversity
- [ ] 8. Hosted acceptance

### Foundation progress, 2026-10-08 UTC

A bounded read-only Data API collector and disabled scoped snapshot RPC now exist.
See docs/verification/analytics-foundation-2026-10-08.md and
docs/platform/GA4-CONNECTION.md. Prompt 1/3/4 foundations are partial; do not
mark the complete prompts or live acceptance passed. Google token wiring,
property verification, sync-run checkpoints and substantive confidence checks
are still required. No collector cron, model call or publication was enabled.

### Evidence safeguard progress, 2026-10-08 UTC

Prompt 4 has per-article exposure/day thresholds, verified-property matching,
window freshness and malformed/qualified-data holds. Full cohorts, release
mapping, consent coverage and baseline comparisons remain pending; keep the
complete prompt unchecked. See verification/analytics-evidence-2026-10-08.md.

### Article instrumentation progress, 2026-10-09 UTC

Prompt 2 code and synthetic browser-event checks are implemented: source-version
IDs, public release registry, once-per-page 25/50/75/90 reading milestones,
related/music clicks and durable-acknowledgement subscription success. The
consent bridge denies events before consent, after withdrawal and on preview
hosts, drops pre-consent milestones rather than replaying them, and accepts only
bounded event fields. Query/hash values and user-entered form data are excluded.
The existing GA tag remains single and consent-controlled. Raw successful
subscription requests can include repeats; they are not new unique subscribers.
No live DebugView/property verification or custom-dimension registration is
claimed. Keep full Prompt 2 acceptance unchecked until those account checks pass.
See platform/READER-ANALYTICS-EVENTS.md and
verification/translation-reader-events-2026-10-09.md. Prompts 5–8 remain open;
this release does not authorize analytics-driven edits or model spending.

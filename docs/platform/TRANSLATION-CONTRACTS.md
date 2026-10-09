# Public translation contracts

Implemented 2026-10-09 UTC. Existing English URLs and public stories remain the
source. The current manifest is empty; no translations are released or generated
by a paid provider. There is no request-time translation or new hosting service.

## Extract and review

Run `npm run build`, then
`node scripts/extract-translations.mjs /absolute/private/output-directory`.
The command exports eleven current published story contracts and seven allowlisted shared UI contracts into a new directory;
it rejects overwriting existing files. The public build produces source contracts
under `build/translation-contracts`, outside `dist`. Rebuild before extracting.
Do not commit either directory or any original private export.

Each contract binds a story slug, SHA-256 of its generated English source, glossary
hash and prompt version. Ordered text segments are source-version scoped; their
IDs are stable for an unchanged template. Titles, descriptions, captions, alt
text and reader UI are plain strings. Markup, script bodies, source bibliographies,
numeric citation anchors, bylines and creator/license attribution stay in the
trusted template. Models never supply URLs or markup. Source links and image IDs
are recorded separately. Preserve source meaning, culturally specific names,
numbers, qualifiers and first-use context; automated coverage checks cannot
establish faithful meaning or replace competent language review.

Validate output against `web/vercel/translation.schema.json` and
`validateTranslation` in `scripts/translations.mjs`. The latter additionally
rejects blank/control/HTML text, excess UTF-8 bytes, mismatched versions and any
missing, reordered, duplicate or extra segment IDs. Locale IDs are an explicit
own-property allowlist, including protection against inherited names such as
`toString`. Text is escaped during rendering; assets and credited URLs are reused.

Store a reviewed payload at `web/vercel/translations/<locale>/<slug>.json`.
It requires format `folkly-translation-v1`, slug, locale, sourceHash,
glossaryHash, promptVersion, fallbackLabel and exact ordered `{id,text}` segments.
The fallbackLabel is a reviewed translation of the notice that a destination
is available in English. A manifest entry has exactly:

```json
{
  "slug": "lisbon-fado",
  "locale": "fr",
  "status": "approved",
  "sourceHash": "<64-hex source hash>",
  "glossaryHash": "<64-hex glossary hash>",
  "promptVersion": "faithful-public-segments-v1",
  "translationHash": "<SHA-256 of JSON.stringify(parsed payload)>",
  "review": {
    "reviewer": "<actual competent reviewer>",
    "reviewedAt": "<ISO timestamp>",
    "competentLanguageReview": true
  }
}
```

This is a structural example, not a valid approval. Obtain actual review and
owner release authorization before adding an approved entry. Compute
translationHash with the exported `hash` helper on the parsed payload. Changing
payload content or key ordering requires a new recorded review hash; source,
glossary or prompt changes invalidate earlier approval. A review record cannot
be inferred from synthetic tests or a successful model response.

## Build and recovery behavior

Builds validate all identities before opening paths. Unknown/private slugs,
duplicate identities, invalid reviews and a payload changed after review fail
closed. Draft/stale entries and approved entries with outdated source/glossary/
prompt versions produce no locale route, alternate or sitemap entry. Locale pages
are static, self-canonical and include reciprocal reviewed alternates plus English
x-default. Related destinations use the same locale when approved; other internal
destinations retain English links with the reviewed fallback notice. URL preference
storage never redirects readers or changes a shared URL. Arabic uses RTL and script
font fallbacks; citation/credit links are directionally isolated.

The ordinary build clears dist first. Roll back translation publication by reverting
the manifest and rebuilding; unavailable translations cannot survive as stale files.
No approval means byte-identical English article content except independently
implemented reader telemetry metadata. The scripts do not make provider calls,
change publication settings or inspect private storage.

## Paid drafts, usage and recovery

The independent translation pilot is implemented in `server/translation-jobs.js`
and the owner-only `/api/owner-translations` endpoint. Use the Translations section
of `/owner` to generate/view private drafts and inspect attempts. A model call never
edits the public translation manifest, publishes an article, or enables an article
switch. Contracts are loaded from the generated allowlisted build registry; the
browser cannot supply source text, prompts or private reserve IDs.

Existing Supabase holds a separate pilot budget and job ledger. Migration
`20261009025742_translation_pilot_ledger.sql` starts closed with zero caps. The owner
has already authorized the pilot and supplied reviewers; provision these approved
values after secure configuration becomes inspectable, without seeking approval
again. Set `FOLKLY_TRANSLATION_MODEL_ID` to the reviewed provider/model identifier
and `FOLKLY_TRANSLATION_MAX_JOB_DOLLARS` in the existing Vercel project. Use the
existing server-only OpenAI key for an OpenAI model or existing AI Gateway/OIDC
credentials for gateway routing. No key belongs in Git, browser configuration, or
chat. Preserve the article-generation model setting unchanged.

Set the singleton `folkly_translation_budget` row through an audited trusted
operator: exact matching reviewed model, approved total/per-attempt caps, current
input/output USD-per-million rates, and pricing expiry. Hard ceilings are $50 total
and $5 per attempt; narrower approved limits apply. Enable only this pilot budget
when configuration has been verified. All three autonomous article switches and
newsletter delivery stay off. Defaults never infer a paid cap or model from a
credential's presence.

One synchronous reservation or one bulk batch runs at a time. Source/locale/glossary/prompt identity and UUID are
unique. Input JSON is bounded to 90 KB; conservative pricing reserves for 200,000
input tokens and at most 24,000 output tokens. Calls have no automatic retries and
a 45-second timeout. A job reserves its entire maximum cost, even after failure.
Frozen rates produce a usage estimate when actual token counts exist; unknown
usage remains null, not zero. Reported spend above a reservation closes the pilot.
These are local estimates; provider billing remains authoritative.

Draft objects are create-only, private, SHA-256 addressed under
`editorial/translations/`, at most 200 KB, and independently read/validated before
recording generated status. SQL evidence is terminal and immutable through the
RPC, with reservation token fencing. Anonymous/authenticated/publisher roles have
no table/RPC rights; only the authorized owner server uses service authority.

If SQL persistence fails after a verified upload, the authorized response contains
a private receipt (job ID, checksum and byte size). Use the owner recovery form
with that receipt. Recovery verifies current source identity, locale, checksum and
size, then completes persistence using the existing reservation token. It makes
no model call and refunds no budget. Source-stale, wrong-prefix, corrupt, unknown
or terminal attempts cannot be recovered this way. With no verified object,
retain the hold for operator reconciliation; never automatically clear it or create
a second paid attempt. Unknown recovered usage is explicitly labelled. The owner
UI clears private bodies/receipts on logout and rejects late responses.

## OpenAI Batch and bulk drafts

The owner form queues OpenAI Batch by default. Select one or more public sources
and languages, up to 12 source–language pairs per batch. A single JSONL upload
contains separate structured requests with unique job IDs. OpenAI processes the
batch asynchronously within its 24-hour completion window; readers never make
translation calls. Use **Check batch** to import completed results and then choose
the individual draft for preview. Imports do not release translations.

Use `FOLKLY_TRANSLATION_MODEL_ID=gpt-6-luna` (the equivalent
`openai/gpt-6-luna` identifier is also accepted). The exact configured identifier
must match the approved SQL budget model. Batch uses the server-only
`OPENAI_API_KEY` directly; there is no gateway or synchronous paid fallback.
`FOLKLY_TRANSLATION_MAX_JOB_DOLLARS` is the reservation for EACH translation,
not the whole batch. All pairs must fit the remaining total pilot budget.

Install migration `20261009194655_translation_batch_queue.sql`. Keep approved
STANDARD input/output prices in `folkly_translation_budget`; batch jobs snapshot
50% of those prices and calculate actual-usage estimates at those frozen rates.
For Luna, prices checked 2026-10-09 are 0.10 input and 0.50 output USD per million
standard tokens, or 0.05 and 0.25 for Batch. Do not halve SQL approval prices again.
At the conservative 200,000-input / 24,000-output ceiling, a Luna Batch reservation
must cover at least $0.016 per translation. An example $0.02 reservation is not an
authorization to enable spending. Approved total caps and expiry remain required.

Claims reserve all member jobs atomically. A durable `submitting` fence is written
before provider access. Lost creation responses are reconciled using the batch ID,
manifest checksum and provider metadata, never resubmitted. Uncertain submission,
unknown provider receipt, duplicate output IDs or bounded reconciliation failures
remain held for operator inspection. No automatic generation retry or refund.

Result import matches IDs rather than line order. Partial, failed, expired and
cancelled batches retain all reservations; complete valid results can be saved
while invalid/truncated/stale members fail. Blob or SQL persistence faults keep
the remaining jobs reserved. A later **Check batch** reuses the existing provider
output and attempts persistence only. A 90-second SQL lease prevents concurrent
imports; an interrupted lease expires. Provider files have a 30-day output
retention request, so inspect/import before expiry. Preserve source versions,
credits, placeholder integrity and competent language review before release.

Provider reference: https://developers.openai.com/api/docs/guides/batch
Model pricing: https://developers.openai.com/api/docs/models/gpt-6-luna

## Owner budget controls, 2026-10-09 UTC

Use **Translations → Translation spending limit** in the existing owner panel.
Enter the total USD cap (0–50) and an expiry within the next 30 days. The form
shows existing reserved spend, remaining headroom, model and per-translation
reservation. The latter comes from FOLKLY_TRANSLATION_MAX_JOB_DOLLARS and is not
a caller-supplied price. The exact configured model must match the prepared SQL
model; pricing remains the previously verified STANDARD rates.

**Allow translation batches within these limits** is an explicit owner choice.
Saving writes the independent pilot's enabled state, total cap, job cap and expiry
and requires separate private readback. It never starts a batch, calls a model,
releases translations, changes newsletter delivery or changes any article switch.
Default loaded values reflect the persisted budget; no positive cap or activation
is preselected for the current paused pilot.

Existing failed/reserved jobs remain charged against the total commitment.
The server rejects a cap below retained reservations, an enabled cap that cannot
fund one translation, incompatible model/prices/token ceilings, malformed amounts
and stale edits. Changing limits never refunds or deletes earlier jobs. Existing
in-flight paid batches can still be checked/imported after pausing or expiry.

Migration 20261009214800_translation_budget_controls.sql adds private server-only
read/save RPCs. Saves lock the same singleton budget row used by claims, compare
the entire expected snapshot, and append before/after metadata to the existing
private audit table in one transaction. PUBLIC, anon, authenticated and publisher
roles cannot call either RPC. The owner endpoint additionally checks membership,
session and origin on every save; responses use no-store caching. Unknown client
model/rate fields are rejected. Unsaved inputs survive ordinary refresh; **Reload
saved budget** explicitly discards them. Logout clears values and rejects late
save responses. An unverified save asks for refresh, without automatic retry.

## Shared pages and review

`ui-home`, `ui-archive`, `ui-about`, `ui-subscribe`, `ui-privacy`, and
`ui-image-credits` use the same source/glossary/prompt/payload review hashes as
articles. Their localized routes are `/fr`, `/fr/archive`, `/fr/about`, etc.
`ui-messages` is a reviewed catalog for filter counts and confirmed form/GPC status;
it emits no route or sitemap entry. Preserve `{shown}`, `{total}`, and `{noun}`
placeholders exactly. The browser loads approved embedded plain JSON and updates
textContent; it never contacts a translation provider. API destinations and consent
field/version names stay fixed. Localize discovery card titles and sort metadata;
links to unreviewed stories/subarchives retain English destinations with an
accessible visible fallback notice. Release complete reviewed shared-page/message
sets alongside the reviewed pilot story so forms and legal choices are coherent.

## Public author and archive routes, 2026-10-09 UTC

The registry derives topic/place routes only from the published catalog and author
profiles from the existing public route map. Legacy topics without published
stories, owner routes and private reserve pages are not translation sources.
Stable identities such as `ui-author-mira-sol` and `ui-archive-topic-music`
map to `/fr/author/mira-sol` and `/fr/archive/topic/music`; provider payloads
cannot supply paths. The current registry contains 11 stories, six shared pages,
five author profiles, 34 topic/place archives and the message catalog (57 sources).
Export via `scripts/extract-translations.mjs` includes exactly that registry.
Nested output directories, self canonicals, reciprocal alternates, language
selectors and sitemap entries use the same trusted map. Reviews remain bound
to complete source and payload hashes. Empty/draft/stale approval creates no
locale page; English output stays byte-identical with an empty manifest.
See verification/localized-reader-archives-2026-10-09.md for fixtures and limits.

## Outstanding deployed evidence

Owner reports pilot approval/model review, reviewers, GA4 setup and provider secrets
completed on 2026-10-09. These reports resolve the corresponding owner setup tasks;
they do not substitute for actual translated-payload review or live runtime receipts.
Vercel project inspection currently returns 404 for the existing project/team, so
configured model/caps, real paid usage, private Blob/provider recovery, actual
viewport/keyboard checks and reviewed locale release are not verified. Do not
repeat the deferred Google Cloud setup request. See the current verification report.

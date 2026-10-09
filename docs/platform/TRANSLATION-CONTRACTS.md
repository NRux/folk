# Public translation contracts

Implemented 2026-10-09 UTC. Existing English URLs and public stories remain the
source. The current manifest is empty; no translations are released or generated
by a paid provider. There is no request-time translation or new hosting service.

## Extract and review

Run `npm run build`, then
`node scripts/extract-translations.mjs /absolute/private/output-directory`.
The command exports only current published catalog entries into a new directory;
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

## Outstanding gates

Translation-specific paid job claims, cost reservations, provider failure/recovery
and usage evidence remain open. Use a separate explicit pilot budget and approved
model; keep article-generation configuration unchanged. Six competent language
reviews, localized discovery pages/shared UI, real viewport/keyboard inspection
and hosted locale/recovery acceptance are still required. The current tests use
ephemeral synthetic AR/FR strings solely to verify structure and security. No
synthetic payload or purported reviewer is saved in the production manifest.

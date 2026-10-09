# Seven-language implementation prompts

Run these in order in NRux/folk. Follow docs/platform/MULTILINGUAL.md and the latest BUILD-STATE, manual-release manifest and acceptance reports. Reuse Vercel. Keep private reserve out of all public outputs. Preserve credits, licenses, sources and approved stories. Keep autonomous generation, publication and article scheduling disabled. Google Cloud remains deferred. Do not run paid translation calls or release translations before the budget and review steps below.

## Current implementation, 2026-10-09 UTC

| Prompt | Status and next gate |
| --- | --- |
| 1 | DONE: public-only contracts, glossary, strict payload schema and source-version validation. |
| 2 | DONE for code/isolated fixtures: approved-only static renderer and review-bound translation hashes. No real translations released. |
| 3 | PARTIAL: article language links, explicit English fallback, self canonicals, reciprocal alternates, sitemap and translated article/UI segments implemented. Standalone localized home/archive/filter pages and shared UI catalogs remain open. |
| 4 | PARTIAL: script fonts, logical layout, RTL direction and link isolation implemented. Browser viewport/keyboard checks and competent language review remain pending. |
| 5 | BLOCKED for funded pilot: explicit model/budget authorization and access required. Translation-specific paid job adapter/ledger integration is still open; do not treat the article-generation adapter as a completed translation adapter. |
| 6 | BLOCKED: six competent language reviews and approved pilot evidence required before backfill. |
| 7 | PARTIAL: isolated reproducible-build, stale omission, payload tamper denial and manifest rollback checks pass. Real localized hosted/recovery acceptance remains pending. |

Commands and limitations: `docs/platform/TRANSLATION-CONTRACTS.md` and
`docs/verification/translation-reader-events-2026-10-09.md`. The production
translation manifest stays empty. Synthetic AR/FR payloads are test data only,
not translations or language approval.

## 1. Extract a versioned public translation contract

Implement a public-only extraction command using the current manual-release manifest. Extract stable segment IDs for titles, decks, narrative paragraphs, section headings, alt text, captions and reader UI. Preserve citation destinations, creator/license names and media IDs separately as immutable fields. Define locales en, zh-Hans, es, hi, ar, fr and ja. Hash source content, glossary and prompt versions. Add a strict JSON schema that rejects missing/extra segments, invalid locale IDs and supplied HTML. Create a glossary for culturally specific terms; retain local spellings and give lyrical but accurate context at first mention. Test private/draft exclusion, escaping, deterministic hashes and malformed translations. Document the command and evidence; commit verified changes.

## 2. Build static locale pages with reviewed fixtures

Implement cached translations keyed by article ID, locale, source hash, glossary hash and prompt version. Use fixtures first, with no provider calls. Keep existing English URLs unchanged; use /zh-Hans/, /es/, /hi/, /ar/, /fr/ and /ja/ for reviewed localized pages. Render translated segments through the existing escaped renderer and reuse credited responsive image assets. Preserve image placement every two narrative paragraphs and the English source's complete meaning; do not apply English word-count thresholds mechanically to other scripts. Add a manifest with draft, approved and stale states. Emit only approved current-source versions. Test missing/stale/unapproved/private translations, reproducible builds and unchanged English routes.

## 3. Implement reader switching and multilingual SEO

Add an accessible language selector with English, 简体中文, Español, हिन्दी, العربية, Français and 日本語. Keep the current article when a reviewed counterpart exists; otherwise explain the English fallback. Persist preference without overriding shared URLs. Do not redirect by IP or send visitors to unfinished routes. Add locale-specific lang attributes, self canonicals, reciprocal hreflang entries only for available counterparts, x-default English and translated sitemap entries. Translate metadata, tags, filters, grids and related-story labels. Test keyboard controls, URL behavior, missing counterparts, crawler output and no public draft leakage.

## 4. Verify script typography and Arabic direction

Use logical CSS properties, appropriate system-font fallbacks and dir=rtl for Arabic. Isolate URLs, numbers and mixed-script proper names with bdi where appropriate. Check header navigation, subscription forms, filters, captions and four related cards at 375, 390, 768, 1024 and 1440 pixels. Preserve reading order and accessible names. Add meaningful layout checks and capture browser evidence when available; identify any unverified visual behavior. Do not claim native-language editorial approval from automated checks.

## 5. Add a budgeted translation adapter and one-story pilot

Use the existing funded provider only after confirming credentials, a reviewed model choice and an explicit pilot budget. Keep the latest-model editorial generation default unchanged. Compare economical available translation models against one representative cultural passage before choosing. Implement bounded input/output, strict schema validation, atomic per-job claims, concurrency limits, cost reservations and no automatic retry of ambiguous paid attempts. Translate one approved public story into six languages once; record actual tokens, estimated cost, hashes and failures. Reject unsupported claims or missing text. Never translate on each reader visit. Test the adapter with mocks before any paid call.

## 6. Review and backfill the public catalog

Arrange competent review for each pilot language: cultural nuance, unfamiliar-word context, place names, regional qualifiers, numbers, negation and source fidelity. Record reviewer and source-version evidence. Fix glossary/prompt issues before backfilling the remaining approved public stories within an agreed total budget. Keep unreviewed output private. Regenerate only changed source versions and mark prior translations stale. Never overwrite an approved translation silently. Test approval transitions, source edits and preservation of citations/licenses.

## 7. Verify deployed acceptance and recovery

Deploy approved locales through the existing GitHub/Vercel project. Verify HTML, metadata, language selection, RTL, forms, images, sitemap, reciprocal alternate links and English fallback on public URLs. Test rollback to the previous translation manifest, interruption recovery, duplicate-job denial and credential/provider failure. Document exact checks, cost and remaining review limitations. Sync verified work to main and master using current-head leases. Translation release must not enable autonomous production, publication or the article schedule; those retain their separate deployed acceptance gates.

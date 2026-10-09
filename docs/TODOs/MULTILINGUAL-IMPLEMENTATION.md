# Multilingual reader implementation tasks

Follow `docs/platform/MULTILINGUAL.md`. No funded calls or locale release occurred.

- [x] Extract public-only narrative/metadata segments with stable source-version IDs, hashes and glossary.
- [x] Add strict translation JSON schema and review/stale manifest, including translation-payload review hash.
- [x] Implement static locale generation for zh-Hans, es, hi, ar, fr and ja with isolated AR/FR approval fixtures. English remains the source; no real language review claimed.
- [x] Add native-name article language links and URL switching; preference storage never overrides a URL.
- [x] Generate self canonicals, reciprocal hreflang and translated sitemap entries only for reviewed current counterparts.
- Translate UI, grid/filter labels, related stories, metadata, captions and alt text.
  Preserve creator/license names, citation URLs and all credited image assets.
- Add logical CSS/RTL direction, bdi isolation and script fonts; test widths 375,
  390, 768, 1024 and 1440 plus keyboard focus and expanded labels.
- Pilot six translations of one story with a capped existing-provider budget.
  Native-reader review must verify cultural nuance, regional qualifiers, numbers,
  negation and glossary fidelity. Keep the article generation model unchanged.
- Only backfill/release approved current-source translations; avoid public missing,
  unreviewed, stale or private reserve routes. Record actual token cost and hashes.
- Do not enable unattended generation/publication/article scheduling before gates.

Implementation and precise partial statuses: `MULTILINGUAL-IMPLEMENTATION-PROMPTS.md`.
The manifest contains no approved locales. Browser viewport checks cannot run
until a Chromium executable is available; layout is not claimed verified.

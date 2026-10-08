# Multilingual reader implementation tasks

Follow `docs/platform/MULTILINGUAL.md`. No funded calls or locale release occurred.

- Extract public-only narrative/metadata segments with stable hashes and glossary.
- Add strict translation JSON schema and review/stale manifest.
- Implement static locales en, zh-Hans, es, hi, ar, fr and ja using reviewed fixtures.
- Add accessible native-name language selector and source-preserving URL switching.
- Generate self canonicals, reciprocal hreflang and translated sitemap entries.
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

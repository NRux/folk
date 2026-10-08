# Responsive image implementation: October 8, 2026

## Implemented

All ten existing illustrated stories now have responsive candidates and HTML srcset/sizes rules. This applies to the homepage hero, homepage/archive/discovery cards, and article lead images. Original src fallbacks, photo selections, captions, attribution/license links, high-resolution social/Article metadata, and private publication boundaries are retained.

Wikimedia's own provided image sizes are used. Twenty-nine candidate URLs were downloaded successfully, decoded as JPEGs, checked for actual dimensions, and hashed. No documentary photograph was generated or locally transformed. The public build remains offline; image retrieval occurs only during this verification step, and readers request the chosen CDN image normally. Original local JPEGs remain available as fallbacks.

The sizing rules match the existing 700/1000-pixel layout breakpoints, shell margins, two-column grid gap, hero proportions, and article width cap. Width/height attributes reserve image geometry, cards stay lazy, and the hero keeps its high fetch priority. Tokushima's 854-pixel original is retained; no upscale is invented.

A debug check found that Oaxaca's original JPEG uses EXIF orientation 8. The catalog's previously stored landscape dimensions did not match its portrait display. The catalog now uses displayed dimensions 2592 by 3872, consistent with the source-provided, already oriented thumbnails. The original file and credits are unchanged.

## Download-byte evidence

These are measured file sizes, not a measured page-speed or Core Web Vitals result. The browser selects a candidate according to its viewport, pixel density, and other conditions; the table compares the existing source with the verified 960-pixel candidate when available. Higher-density screens may choose a larger version.

| Article | Existing source bytes | Candidate width | Candidate bytes | Reduction |
| --- | ---: | ---: | ---: | ---: |
| new-orleans-second-line | 1305156 | 960 | 168134 | 87.1% |
| lisbon-fado | 2002620 | 960 | 163814 | 91.8% |
| oaxaca-living-color | 4524198 | 960 | 359047 | 92.1% |
| bonwire-kente | 695042 | 960 | 213922 | 69.2% |
| castells-tarragona | 1897769 | 960 | 571759 | 69.9% |
| kimjang-seoul | 780269 | 960 | 238219 | 69.5% |
| matariki-puanga | 688380 | 960 | 295788 | 57.0% |
| nowruz-tajikistan | 654502 | 960 | 214643 | 67.2% |
| tokushima-aizome | 93781 | 854 | 93781 | 0.0% |
| xochimilco-chinampas | 1414171 | 960 | 181163 | 87.2% |

## Checks

- `npm run build` passed for the 73 public routes.
- `npm test` passed the full regression suite, including new responsive-image checks and the existing private-access, publisher/no-spend, ledger, analytics, contact, and logout-race tests.
- Responsive checks cover all ten photos and 29 candidate URLs, retained original fallbacks, eager hero/lazy cards, oriented Oaxaca dimensions, unsupported/private/credential-bearing URL rejection, duplicate widths, invalid dimensions/aspect ratios, evidence requirements, and idempotent HTML decoration.
- Existing checks confirm the seven approved article bodies/source lists are unchanged and no private reserve/editorial code is copied into the public output.
- Actual candidate URLs returned successful image downloads and hashes are recorded in [download evidence](responsive-image-downloads-2026-10-08.json).
- Post-deployment public verification is recorded separately. No mobile-rendering, field performance, ranking improvement, or full Stage 7 acceptance is claimed.

No database migrations, model calls, credential changes, article releases, or autonomous switch changes were made. Google Cloud remains deferred. Stage 7 activation remains blocked on its existing deployed acceptance gates.

## Remaining prerequisites

Responsive JPEG selection is implemented; owned-hosting/modern-format variants, a relevant licensed Detroit photograph, a better-resolution Tokushima process photograph, measured mobile performance, Search Console indexing evidence, and source-checked editorial corrections remain separate tasks. No credential action is required for this image update. Search Console evidence needs authorized property access; Vercel build-log inspection needs access to the existing Folkly project through its connector.

## References

- [Google image SEO: responsive images and src fallback](https://developers.google.com/search/docs/appearance/google-images)
- [HTML img element: srcset, sizes, and intrinsic dimensions](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img)

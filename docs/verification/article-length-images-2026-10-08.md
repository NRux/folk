# Article length and inline images, October 8, 2026

Owner-requested public revisions use **The Weight of Blue: Indigo, Labor, and the
Living Economy of Tokushima** as the length reference. The minimum is **1,187
narrative words**, excluding headings, citation numbers, captions, and source
lists. Seven shorter stories were expanded; longer narratives were retained.

| Published story | Narrative words | Body paragraphs | Inline images |
|---|---:|---:|---:|
| New Orleans second lines | 1,218 | 21 | 10 |
| Lisbon fado | 1,260 | 22 | 11 |
| Oaxaca weaving | 1,258 | 21 | 10 |
| Detroit techno | 1,297 | 23 | 11 |
| Bonwire kente | 1,226 | 17 | 8 |
| Tarragona castells | 1,525 | 11 | 5 |
| Seoul kimjang | 1,630 | 17 | 8 |
| Matariki and Puanga | 1,275 | 18 | 9 |
| Tajikistan Nowruz | 1,204 | 14 | 7 |
| Tokushima aizome | 1,187 | 16 | 8 |
| Xochimilco chinampas | 1,257 | 12 | 6 |

These **93 distinct inline images** follow every second narrative paragraph,
in addition to existing lead images. An odd final paragraph remains unmatched.
Standalone bold headings were converted to headings and duplicate inline
bibliography summaries removed; every linked Sources section remains identical
to base commit `9f565c37c28dce3b7a79170298604fb721682044`. No original narrative
was removed, except the already suppressed reading-lens presentation boxes.
The same export retains concise source/license captions, correct intrinsic
sizes, descriptive alt text, complete proportional frames, and lazy loading.
The image credits index now includes the inline images. Reading times and
Article wordCount/dateModified metadata reflect the revisions.

## Editorial evidence

Expansion adds context and interpretation using the existing linked primary
sources. It does not invent interviews or claim firsthand attendance. Sources
checked during preparation include:

- [NPS jazz history](https://www.nps.gov/jazz/learn/historyculture/history_early.htm),
  [Original Big 7](https://www.originalbig7.org/), and
  [Historic New Orleans Collection exhibition](https://hnoc.org/exhibitions/dancing-streets-social-aid-and-pleasure-clubs-new-orleans).
- [Museu do Fado history](https://www.museudofado.pt/en/fado-history-en) and
  [UNESCO fado](https://ich.unesco.org/en/RL/fado-urban-popular-song-of-portugal-00563).
- [Textile Museum of Canada interview](https://textilemuseum.ca/collection/gabriel-mendoza-in-conversation-with-julie-mcisaac/)
  and [Porfirio Gutiérrez dye practice](https://www.porfiriogutierrez.com/natural-dyes).
- Detroit Historical Society accounts of Juan Atkins and the Electrifying Mojo,
  already linked in that story's Sources section.
- UNESCO's kente account, Te Papa's account of regional Matariki/Puanga differences,
  and UNESCO's multinational Nowruz account, linked in their respective stories.

Music-example links are retained. Context images identify their actual place:
indigo photographs from other Japanese locations are not presented as Tokushima
workshops, the Kyrgyzstan sumalak scene is not labeled Dushanbe, and astronomy
photographs are not represented as Māori community ceremonies. A historical
indigo illustration uses “Image” credit rather than “Photo”.

## Debug and security evidence

- `npm run build`: PASS, 73 public pages, 11 published stories, public-only output.
- `npm test`: PASS, full reader, private-boundary, authentication, storage,
  owner-response-race, model/publisher/spend, analytics, contact, discovery,
  responsive lead image, and new article-layout suites. Failure-path messages
  are expected mock diagnostics; no paid provider or Google calls ran.
- New tests verify the reference count, minimum words on every story, exact image
  cadence across subsections, odd endings, source/caption exclusion, credits,
  dimensions/lazy attributes, structured metadata, and duplicate/unsafe media
  rejection. Missing images or a shorter future export fail the build.
- HTML escaping applies to captions, authors, alt text and URLs. Only HTTPS
  Wikimedia image/file URLs and Creative Commons license hosts are accepted.
- Separate public revision hashes are recorded in
  `article-length-image-revisions-2026-10-08.json`; historical manual-release
  hashes and private reserve snapshots are unchanged.

## Limits and remaining verification

Wikimedia Commons API supplied attribution, license, source and preview dimensions
for all 93 images. **36 selected downloads** were decoded and SHA-256/byte evidence
recorded; their images were visually inspected. The other **57 records** are
explicitly metadata-only because direct download requests timed out. They are
not labeled download-verified. A tiny 171-pixel portrait was replaced with a
larger contextual photograph. Remote image-byte availability, full visual review
of the remaining previews, and browser performance still need verification.
External URLs are not pinned by a runtime integrity mechanism.

Playwright cannot launch because its Chromium executable is absent. Consequently
mobile rendering, visual overflow and Core Web Vitals are not claimed as passed.
Public probes of `/tokushima-aizome` and `/new-orleans-second-line` via the
web retrieval service on October 8 returned “URL is not accessible via this
tool”; no HTTP status or served revision could be established.
Public deployed readback remains a separate gate; a commit/build pass alone does
not establish which revision the custom domain serves. The existing Vercel
connection still needs access to Noah's **folkly** project to inspect deployment
and domain attachment; the old project name in historical reports is not a new
project request. No additional credentials are needed for these source changes.

Stage 7 still requires authenticated deployed write/readback, evidence-bound
content migration and commit, scoped worker authorization, provider evaluation,
MFA/session acceptance and isolated recovery/restore exercises. Google Cloud
setup remains deferred. Autonomous production/publication/schedule switches,
private content, database migrations and release records were not changed.

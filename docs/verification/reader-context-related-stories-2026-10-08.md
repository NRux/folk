# Reader context, related stories and shared footer

Owner-authorized revisions of all eleven already-published stories, based on
`9fd95df35e95b3478020b7d0ee8fa57c9b537d9d`. No new reserve release.

## Changes

First-use explanations now introduce cultural practices, local vocabulary,
geography and technical terms within the prose. Examples include fado, Zapotec,
kente, kimjang, pinya/tronc, sukumo, chinamperos and soil pH. The Māori essay now
introduces Aotearoa, maunga, iwi, Matariki, Puanga/Rigel and regional locations;
subsequent passages explain tohunga, whakataukī, whānau, karakia, mātauranga and
whenua. Local names and diacritics remain. Definitions are brief and are not
repeated at every mention. The Puanga opening no longer presents a universal
one-week rising interval or blanket northern visibility claim. Te Papa's
astronomers and Te Aka dictionary sources are added to that article's source list.
Existing source lists and photo licenses remain intact.

Every article has four distinct related stories selected from the published
catalog. Curated recommendations come first, followed by deterministic shared-topic
and place ranking. Draft/private/unknown and self links are excluded. Cards have
lazy images, meaningful alt text and responsive desktop/tablet/mobile columns.
Detroit uses its existing credited inline Juan Atkins portrait as its preview;
other cards use their cover images. Existing responsive cover variants apply to
related cards. Image/source/license metadata is escaped; no new asset was added.

Shared public footers read “Stories about the intersection of Culture and Place.”
and “A Then Media inc. project.”. This is applied in the build, including archive
and author pages from the compressed template export.

## Evidence

`npm run build` and the full regression suite pass after fixing a context check
that caught an explanation in the Nowruz deck but not its narrative opening.
Reader-context tests cover all eleven stories and cultural/geographic/technical
introductions. Related-story tests require exactly four distinct image cards,
exclude self/private links, and check the footer wording. Existing security tests
cover escaped metadata, unsafe image URLs, public/private export boundaries,
fail-closed authentication/storage and paused model/publisher guards.

All stories are at least 1,228 narrative words, the revised Tokushima length.
The frozen baseline guard remains 1,187 words. All 93 credited inline images still
follow every two narrative paragraphs; captions and source lists are excluded
from word counts. Template hashes, counts and paragraph totals are in the adjacent
JSON report. Historical manual-release hashes are preserved as original release
evidence, rather than rewritten to describe this public revision.

A public pre-deployment HEAD check of `/matariki-puanga` returned HTTP 200 with
Vercel headers. Post-deployment body readback is a separate check; browser visual
acceptance is not claimed. Existing hosted Stage 7 gates and image-download
verification backlog are not satisfied by this presentation change. Autonomous
production, publication and the article schedule remain disabled. No credentials,
SMTP messages, paid model calls or database writes were used.

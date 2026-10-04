# Stage 01 Notes

## Capture method

Public HTTP GET only. `scripts/stage01_capture.py` fetched all 13 routes (both URL forms)
plus every referenced asset. Raw HTML in `raw/`, extracted text in `pages/`, machine-readable
`inventory.json`.

## Sites tooling availability

**ChatGPT Sites tools are NOT available in this build environment.** The baseline is from
public HTTP capture only. The Sites project ID
(`appgprj_6abfc9a424f881918070e39a237ecc83`) is recorded from the master spec; its
authoritative source structure could not be inspected from here. Stage 02 therefore builds
the durable architecture against this HTTP baseline and documents the deployment path to
the real Sites project.

## Divergences and observations

1. **Canonical URLs point at a different subdomain.** Every page declares
   `rel="canonical"` to `https://folkly-journal.grassy-lark-3382.chatgpt.site/...`
   (e.g. `.../new-orleans-second-line.html`), while the serving domain is
   `folkly-journal.nrapp.chatgpt.site` and its canonicals use the `.html` form. The master
   spec requires canonicals "based on the actual live domain." Stage 03 must set canonicals
   to the actual serving domain. Which subdomain is the authoritative live domain is an
   owner question — both currently serve content; the nrapp host is the one in the spec.
2. **URL forms.** `/<slug>.html` serves with HTTP 200 and a `final_url` of `/<slug>`
   (server-side redirect/canonicalization to the extensionless form). Both forms must keep
   resolving post-migration (acceptance case 1).
3. **No JSON-LD** on any page and no meta author tags currently. Stage 03 adds Article
   structured data per spec.
4. **Bylines are historical "Folkly editorial" bylines** (e.g. "Folkly editorial ·
   October 2026 · 3 min read"). Per spec these must be preserved during migration — no
   persona back-attribution of existing articles.
5. **Detroit article has no lead image** (typographic header with an "In this story"
   table of contents in the aside) — an existing example of the spec's "deliberately
   designed without a photograph" path. The other three articles each have one lead image.
6. **Single shared stylesheet** `style.css` (11,630 bytes, captured in `raw/style.css`);
   no external fonts, no JS on the article/home pages. The design system (typography,
   eyebrow labels, article-layout/aside grid, cover story) is fully defined there.
7. **Assets:** `assets/new-orleans.jpg` (1.3 MB), `assets/lisbon.jpg` (2.0 MB),
   `assets/oaxaca.jpg` (4.5 MB). Alt text present on all images; no visible credit lines
   on pages (credit metadata may exist only in the source project).
8. **Homepage composition:** cover story (New Orleans) → "Elsewhere in the journal"
   (Lisbon, Oaxaca, Detroit) → "Start with a place" index (01–04 with country + short
   descriptor) → perspective teaser → footer. Issue branding: "Issue 01 — The things we
   carry."
9. Article anatomy (consistent): header (eyebrow `Place, Country · Category`, h1, deck,
   byline) → aside "In this story" TOC → body sections with numbered source footnotes
   [1]..[n] → "Sources & further reading" list → approach disclosure linking /about.

## Preservation checklist for later stages

- [ ] All 4 articles + perspective + about + homepage keep rendering with identical visible
      text, credits, alt text, and disclosure (acceptance case 1).
- [ ] Both URL forms (`/<slug>`, `/<slug>.html`) resolve on every route.
- [ ] `style.css` design preserved: strong typography, large photography, restrained color,
      generous reading layouts, mobile behavior.
- [ ] Historical "Folkly editorial" bylines preserved (no persona back-attribution).
- [ ] Existing image alt text and any license data preserved; no new images replace existing
      ones.
- [ ] Audience, tone, and editorial direction (Creative Cities / Adaptive Identity
      framework, as a working lens, never a forced conclusion) unchanged.
- [ ] Private-site access posture preserved: no new public feeds/indexing beyond what the
      owner's access settings allow.

## Open questions (non-blocking)

- Confirm the authoritative live domain for canonicals (nrapp vs grassy-lark-3382).
- Whether image license metadata exists in the Sites project source (not visible via HTTP).

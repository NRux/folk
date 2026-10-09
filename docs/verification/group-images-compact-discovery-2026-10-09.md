# Group photography, merged About and compact discovery

## Reader changes

Detroit's eleven inline figures now alternate performances, crowds, dancing,
festival entrances and grounds, with one TR-909 equipment image. Eight figures
show groups, two show venues, and one shows an instrument. No close-up solo
portrait remains in that sequence. Commons photographs document Detroit events
in 2002 and 2007, Berlin's Love Parade in July 1999, and the continuing Detroit
festival in 2026. They are captioned with their actual place/date rather than
presented as photographs of the original 1980s scene. The entrance image has
conflicting date metadata, so its caption makes no year claim.

Tarragona's final bus photograph (Commons page 123700534) is replaced by an
inspected arena-interior photograph (127039993) showing groups and spectators.
The preceding street musicians retain their photograph with a corrected street
procession caption. Source, creator and exact license links are retained on all
selected photographs. Source-derived preview dimensions, download hashes and
visual notes for the new/recaptioned selections are in
group-image-source-review-2026-10-09.json. The compiler's license allowlist now
includes the precise CC BY 3.0 DE license used by three Berlin photographs.

The editorial guidelines, writing prompts and draft-only provider instructions
now prioritize groups and the social life of a practice, vary adjacent scenes,
limit music equipment details to one, require visual inspection, and label later
or elsewhere photographs accurately. Detroit has deterministic sequence checks;
those checks support, and cannot replace, human scene/rights review. Other
existing galleries are preserved; this release does not claim a complete visual
reaudit of every photograph in the journal.

About and Our Perspective are consolidated at /about, with the perspective at
/about#perspective. Editorial copy before the unchanged contributor form is 361
words, down from 759 across the two original pages: 52.4% shorter. The named
framework, five connected moments, limits of the framework, editorial approach
and contributor invitation remain. Legacy /perspective and /perspective.html
have permanent redirects; duplicate navigation and sitemap entries are removed.
About's title and social description describe the combined page.

The Place filter now offers countries and world regions, with no city options.
N. America, C. America, S. America, Africa, Asia and Europe are included, plus
Oceania so the New Zealand story is correctly classified. Mexico is in North
America; empty regions give the existing zero-result state. Cities remain in
story headings and their established archive URLs. Tags are collapsed into a
native disclosure, with Place, Sort, Tags, Clear and result count in a compact
row that wraps on small screens. Mobile controls retain 44px touch targets.

## Verification

Story: an existing published catalog and verified media manifest compile into
public HTML; readers choose a country/region and tags in the browser, and the
local controller updates visible cards and the URL without an API or data write.

- Build: 72 public pages, eleven unchanged published story records; no new release.
- Full regression: npm test, including merged-page, media/layout, filter, provider,
  authentication, storage, privacy, newsletter and translation fixtures.
- Focused checks: group/subject composition constraints; two equipment pictures,
  repeated adjacent subjects, insufficient groups and close-up portraits reject.
  The bus ID is absent; selected venue ID and download verification are required.
- Filtering: country and region counts, combined tags, sorting, URL/history/clear,
  unknown and city-value rejection, zero results, scoped public-only options and
  escaped markup. Missing/malformed country values cannot become filter options.
- About: exact word count, retained framework and contact fields, one contact form,
  no legacy navigation/sitemap entry and permanent legacy redirects.
- Security/preservation: no article body, linked research, approved release manifest,
  private reserve, credentials, provider budget or activation switch changed.
  Owner authorization and consent gates remain under regression coverage.

Deployment readback is recorded below after the code reaches Vercel. Local
Playwright has no installed Chromium executable; this report does not equate
CSS assertions with a completed mobile viewport test. npm run test:mobile stopped
at browser launch. A Chromium installation attempt returned a truncated/non-ZIP
download and was stopped; no viewport test ran. Changed JavaScript syntax checks
and the complete non-browser regression suite passed.

## Operational boundary

Autonomous production/publication/article scheduling and newsletter delivery stay
off. Google Cloud remains deferred. No owner connection or credential change is
needed for these public reader edits. Existing Stage 7 private import, scoped
provider and hosted recovery gates remain separately blocked as described in the
acceptance report; this release does not claim those gates passed.

## Live acceptance, 2026-10-09 UTC

Code commit 98e4f03e7f96bf557e71a2ec09e66b682cc21eb0 was synchronized to
main/master with expected-head checks; Vercel reported `Deployment has completed`
for the existing folk project. npm run test:hosted passed 45 checks, including
exact readback of all eleven published stories in both URL forms and private-route
denial. Nine additional pages/assets matched the local build byte for byte:
homepage, About, Archive, image credits, sitemap, filter controller/styles and the
two changed article pages. No ignored-build status was used as deployment proof.

HTTP /perspective returns 308 to /about#perspective. Vercel cleanUrls sends the
.html form first to /perspective with 308, then to the same About section; the
browser confirmed that final URL and the combined page's contributor form.

At a 1363×936 browser viewport, the collapsed filter panel measures 58px high,
with no horizontal page overflow. Europe produces two cards; Europe plus Music
produces one; Clear resets both controls and restores all eleven cards. The tag
menu opens/closes and the region selection is reflected in the URL. Option values
contain countries and the seven world regions only. No data/API write is needed
for filtering. Existing city archive links remain available.

The browser confirmed the new arena-interior image loads at 960px intrinsic
width with its source/license caption. Detroit's wide performance image loaded
at 960px and its Berlin group-dancing image at 512px, with the actual 1999 place/
date caption. All eleven Detroit captions match the curated gallery. No Folkly
application console error was observed; browser-extension metadata errors were
excluded from application findings. Actual mobile viewport testing remains
blocked as noted above. No contact/signup submission, model call, newsletter or
private read occurred during these browser checks.

Public response hashes, redirect chain and browser observations are recorded in
group-images-compact-live-2026-10-09.json. The source-review JSON records the
separate rights/visual checks; neither file claims original 1980s photo coverage.

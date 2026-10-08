# Low-cost multilingual reader architecture

Decision proposal, 2026-10-08. Requested languages: English, Mandarin, Spanish,
Hindi, Arabic, French and Japanese. This is architecture, not a translation launch.

## Recommended approach

Translate each approved public article once per revision, keep those translations
as versioned JSON in this repository, then generate static localized HTML in the
existing Vercel build. Readers pay no translation API cost per visit. Reuse the
same image files, responsive variants, sources, image credits and licenses across
languages. There is no new database, translation subscription, live translation
proxy or Google Cloud dependency. Existing hosting traffic/build charges still
apply. This is the lowest recurring-cost architecture for a small public catalog,
not a guarantee that the cheapest model produces acceptable literary translation.

Browser translation is the absolute zero-infrastructure option, but it cannot
provide reliably maintained translated pages, editorial review or language-specific
search entry points. The old Google Website Translator widget is not a supported
solution: Google's notice says support ended October 1, 2026. Paid per-visitor
translation and subscription middleware add recurring costs that this reader does
not need. Google Cloud setup remains deferred.

## Routes and language selector

| Language | Locale | Example article URL | Direction |
|---|---|---|---|
| English | en | /tokushima-aizome | ltr |
| Mandarin, written in Simplified Chinese | zh-Hans | /zh-Hans/tokushima-aizome | ltr |
| Spanish | es | /es/tokushima-aizome | ltr |
| Hindi | hi | /hi/tokushima-aizome | ltr |
| Arabic | ar | /ar/tokushima-aizome | rtl |
| French | fr | /fr/tokushima-aizome | ltr |
| Japanese | ja | /ja/tokushima-aizome | ltr |

Keep all existing English URLs. Locale routes preserve the same immutable story
slug; translated titles do not change identity. A native accessible language
selector uses self-names (English, 简体中文, Español, हिन्दी, العربية, Français,
日本語), switches the current article where its reviewed translation exists, and
remembers an explicit choice locally. Do not redirect visitors based on IP or
browser language, and do not advertise unavailable translations. Keep URLs
shareable and useful without JavaScript. Traditional Chinese can be added later;
Mandarin itself is a spoken variety, whereas zh-Hans specifies written script.

Generate reciprocal hreflang alternates only for available approved translations,
plus en and x-default pointing to the current English page. Each translated page
has its own canonical, localized title/description, visible navigation, summary,
image alt text, related-story cards, reading information and Article inLanguage.
Use an equivalent page's own locale in internal links, with explicit English
fallback when unavailable. Include translated routes in the sitemap. Google
recommends separate URLs and reciprocal alternates; templated language alone is
not a translated article.

Set html lang and Arabic dir=rtl. Use CSS logical properties, mixed-text bdi
isolation, accessible focus order, flexible header wrapping and 44px actions.
Test Arabic alongside Latin proper names/URLs and short/long navigation labels.
Use existing system fonts and script-capable fallbacks; no paid font or separate
image inventory. Keep licenses/creator names and citation destinations intact.

## Data and workflow

Proposed files: `web/vercel/locales/<locale>.json` for approved shared UI strings;
`web/vercel/translations/<locale>/<slug>.json` for per-story translated blocks;
`web/vercel/translation-manifest.json` for approval/hash/version metadata.

Each article record stores source narrative hash, source metadata hash, glossary
version, locale, ordered segment IDs, translated title/deck/headings/paragraphs,
caption/alt strings, translator/model version, review status, and usage evidence.
The source HTML is parsed into structural segments: models never emit runnable
HTML, links or arbitrary tags. Only a safe renderer inserts escaped text into the
existing template. Heading IDs, paragraph order and image-after-two-paragraph
positions remain stable. References, source URLs, proper names and licenses are
immutable fields, not model-authored data. No private drafts, subscriber records,
owner configuration or secrets enter the translation job.

Content-key cache: `(source hash, locale, glossary version, prompt version)`.
Reuse approved translations on ordinary builds. Retranslate only changed segments
and affected metadata; freeze a manifest for each deployment. If English changes,
mark the old translation stale and omit its route/alternate until updated and
reviewed rather than silently serving a mismatched version. Keep the last English
reader available. Rollback uses the existing Git history and static deployment.

For the initial eleven public articles, six target languages require 66
translations plus shared UI. Pilot one culturally dense story in all six languages.
Use the existing OpenAI provider with a separate budgeted translation model, initially
`gpt-6-luna` if accessible and if it passes the pilot. Keep the owner's latest-model
article generation default unchanged. Compare the pilot with a stronger model and
native-reader review; escalate only passages that fail accuracy/style checks.
Batch where supported and useful; it need not block a new English revision.
Never run translation inside the public reader request or unbounded build retries.

The translation prompt requires faithful meaning, the original lyrical register,
first-use reader context and regional specificity. It forbids adding claims,
shortening the article, inventing etymology or normalizing Indigenous names.
A multilingual glossary preserves Māori/Zapotec/Japanese terms with appropriate
local-language context. Preserve meaningful quotation status and music examples.
Compare segment coverage, numbers/dates/negation, named entities and all URLs;
check cultural nuance with native readers before claiming editorial acceptance.
Use source coverage and paragraph parity for Chinese/Japanese, not an English
space-delimited minimum word-count test. Unreviewed translations stay private.

## Cost model

Prices checked October 8, 2026 at the official OpenAI API pricing page. Standard
short-context gpt-6-luna is $0.10 per million input tokens and $0.50 per million
output tokens. A deliberately conservative illustrative workload of 6,000 input
and 12,000 output tokens per translation costs $0.0066; all 66 would cost about
$0.44 for one pass. These are assumptions, not measured tokenizer counts or a
quality guarantee. Multilingual token counts, reasoning, retry/review calls and
provider access can increase cost. Budget $1–$5 for the initial API pilot/backfill,
then inspect actual usage before scaling. Human review is separate and can dominate
cost. Set an explicit token/dollar cap before any funded run. No API calls were
made for this proposal. Per-view translation cost is zero after static generation;
ordinary Vercel traffic charges remain.

## Implementation stages and acceptance

1. Extract stable public segments, create glossary/schema and untranslated manifest.
   Test source/hash stability, draft exclusion, escaping and unchanged English URLs.
2. Add locale UI and static route generator with approved test fixtures. Test
   canonical/hreflang reciprocity, missing/stale fallback, links and image credits.
3. Run the one-story/six-language capped pilot once provider funding is available.
   Obtain accuracy review, measure cost and approve the model/prompt.
4. Backfill the remaining public stories, then manually release reviewed locales.
   Test locale grids/tags/related stories, metadata, sources, forms and RTL/mobile.
5. Connect translation after source approval and before localized release once
   Stage 7 acceptance permits unattended work. Existing autonomous production,
   publication and article scheduling switches remain off throughout this design.

Subscriber language preferences and multilingual newsletter delivery are a separate
later change requiring explicit consent/preference handling; this proposal does
not alter the private email list or current newsletter language.

## Primary references

- https://developers.openai.com/api/docs/pricing (pricing checked 2026-10-08)
- https://developers.google.com/search/docs/specialty/international/localized-versions
- https://developers.google.com/search/docs/advanced/crawling/managing-multi-regional-sites
- https://developers.google.com/search/blog/2020/05/google-translates-website-translator

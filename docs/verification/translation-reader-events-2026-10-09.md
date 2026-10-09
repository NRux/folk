# Translation foundation and reader-event verification

Date: 2026-10-09 UTC. Baseline: ec6ca6356e5ea75d7b82a99c45ec4885135a94a0
on both main/master. Scope: existing eleven public stories and public reader
infrastructure; no new publication, paid calls, outgoing emails or private import.
The manual-release manifest still classifies the original seven releases as public.

## Changes

- Public-only ordered text contracts, SHA-256 source/glossary/prompt identity,
  strict payload schema and cultural-name glossary. Extraction is outside dist.
- Reviewed-only static locale output and exact source/translation review hashes.
  Missing/changed/stale/unsafe/private payloads fail closed or are omitted according
  to their status. Empty approval leaves existing English navigation unchanged.
- Article language links with native names, English fallback notices, self
  canonicals, reciprocal available-only hreflang, x-default and locale sitemap.
  Original citations, credits, images and paragraph placement are preserved.
- RTL/system-script CSS and directional link isolation. Actual visual acceptance
  is pending; competent language approval is never inferred from fixtures.
- Stable story IDs, article-source version hashes and public current-release
  registry with an exact field allowlist. No private export or translation contract
  becomes a public artifact.
- Consent-aware 25/50/75/90 article-body milestones, related/music clicks and
  durable subscription acknowledgements. No pre-consent replay, preview events,
  user-entered fields or arbitrary URLs; withdrawal blocks emission immediately.

## Debug/security findings resolved

1. Manifest paths must be validated before reading payloads. Separate identity/
   review validation now rejects traversal, duplicate identities and unknown/private
   stories before filesystem access; stale versions need no payload read.
2. Locale membership must use own properties. Inherited object names such as
   toString are rejected, alongside unknown locales and malformed IDs.
3. Numeric citations and creator/license text must not become model segments.
   Citation anchors, bibliography, bylines, caption credits and related-image
   attribution remain immutable trusted-template content.
4. Locale directories must not break source-relative images. Original assets
   become root-relative on localized output; image IDs and positions are unchanged.
5. Approval must bind translated output, not just English input. Manifest
   translationHash denies edits after review, even when source identity is unchanged.
6. The old public-artifact test rejected every JSON file. It now allows exactly
   the intentional current-release registry and validates all four per-story fields,
   public IDs/version hashes and four related cards; private JSON remains denied.
7. Consent cannot buffer older reading activity. Observed pre-consent milestones
   are discarded, rather than emitted after later permission. Preview GA loading
   is also blocked; page/referrer query and hash values are stripped.

## Checks and evidence

| Check | Result |
| --- | --- |
| npm run build | PASS: 73 existing public routes, eleven stories, no approved locales |
| npm test | PASS: full regression, including new translation and reader-event suites; storage/auth/provider failure logs are intentional fixture outputs |
| Focused pass 1: translation, reader-event, Vercel/privacy checks | PASS after resolving the explicit public-registry allowlist |
| Focused pass 2: translation, reader-event, Vercel/privacy checks | PASS, including isolated approved/stale/rollback builds, changed-after-review denial and browser-event wiring |
| Public extraction CLI | PASS: eleven public-only contracts written outside dist; existing output cannot be overwritten |
| Translation review/escaping/path security | PASS: missing/extra/reordered/duplicate text, unsupported/inherited locale, stale source/glossary/prompt, HTML/control/oversize, duplicate/private/traversal, missing/false review and payload tampering denied |
| Media and SEO fixtures | PASS: synthetic AR/FR reciprocal links, canonical/direction, all image IDs/two-paragraph positions and source/rights citations retained; only reviewed counterparts included |
| Reader events | PASS: once-per-page milestone behavior, no consent replay, correct article-body scope, hidden-tab exclusion, canonical IDs and related target allowlist |
| Subscriber timing | PASS: API failure emits nothing; acknowledged storage success emits only after form reset, with no email parameter |
| Actual viewport/keyboard visual checks | NOT RUN: Playwright Chromium executable is absent; no layout or native-language approval claimed |
| Vercel protected project inspection | BLOCKED: exact project prj_d93TLitMYu8uYjqfgvgANuwsRJVK in team_QufgodCsuoarDSEhOJyWbUJF returns 404/not_found |

The AR/FR fixtures are synthetic strings and reviewer metadata used only inside
temporary test directories. They are removed after testing and never committed
as translations. Rebuilding the same approved fixture produces identical bytes;
rebuilding with stale/no approval removes the locale and preserves English.

## Remaining gates and exact owner action

- Reauthorize the Vercel plugin for **optagens-projects** and the existing project
  **prj_d93TLitMYu8uYjqfgvgANuwsRJVK**, so protected deployment logs/environment
  setup can be inspected. The public site/GitHub deployment path still works.
- Authorize a separate capped translation pilot and a reviewed provider/model,
  then supply competent reviewers for zh-Hans/es/hi/ar/fr/ja. Translation-specific
  paid job/usage/recovery code and localized discovery/shared UI are still open.
- Verify GA4 property 558035708 / stream G-RQJD3XG35C in the existing Analytics
  account, register the documented bounded dimensions, inspect/disable unbounded
  enhanced form/search collection and obtain authorized consent-aware DebugView
  evidence. Google Cloud/reporting credentials stay deferred.
- Complete original source export, secure Resend/model/worker configuration and
  full hosted editorial/newsletter/recovery acceptance remain existing Stage 7
  requirements. Configure secrets in provider settings, never chat or Git.

No production/autonomous publication/article schedule or newsletter switch was
enabled. The implementation does not authorize automated editorial changes or
translation release.

## Deployed readback

Implementation commit `49e98ea838eeb5482c5299931cfe1afa7f6f22f4` was synced to
main and master with expected-head leases. GitHub's Vercel status confirms
"Deployment has completed" at 2026-10-09T01:49:35Z, with deployment dashboard
https://vercel.com/optagens-projects/folk/75Kka87vq8eVd2rwVfGLRHXpwN56.
An earlier status was "Canceled by Ignored Build Step"; that was not accepted as
deployment proof. An initial registry request during rollout returned 404; after
the actual completed deployment, the independent checks passed.

`npm run test:hosted` passed **45** checks: both URL forms, all eleven articles
byte-identical to the verified build (including credits), author pages,
subscription navigation and private-route exclusion. The new read-only
`node scripts/verify-reader-foundation.mjs 49e98ea838eeb5482c5299931cfe1afa7f6f22f4`
passed **13** more checks: the release registry and five scripts/styles return
200 with exact build bytes; unapproved AR/FR routes and nonpublic manifest/glossary/
source-contract paths return 404; anonymous subscriber/contact owner views return
401. The check timestamp and per-path results are in
`translation-reader-events-live-2026-10-09.json`. No subscriber records, owner
sessions, outgoing messages or real Google analytics events were created.
These 58 public response checks do not replace actual browser viewport/native
language, authenticated storage or live Analytics property acceptance.

# Reviewed public archive localization: 2026-10-09 UTC

## Implementation

Continued the next unblocked multilingual task while Vercel connector inspection
is deferred at the owner's request. Existing public author profiles and generated
published topic/place archives now participate in the reviewed translation build.
The source registry has 57 contracts: 11 stories, six shared reader pages, five
author profiles, 34 archive pages and one message catalog. Legacy topics with no
published stories, owner pages and private reserve are excluded. Stable flat
source identities map to trusted nested reader URLs, not provider-supplied paths.
The build creates nested directories, self canonicals, reciprocal alternates,
reviewed language links and localized sitemap entries. Unknown/unreviewed/stale
destinations keep accessible English fallback. Source extraction exports the
same complete public registry. Existing English URLs and content are preserved.

## Evidence

- `npm run build`: PASS, 72 public pages, 11 published stories, publisher disabled.
- `npm run test:translations`: PASS, source/review/hash, HTML/path/private denial,
  immutable citations/media and synthetic Arabic/French story fixtures.
- `npm run test:translation-ui`: PASS, 72 synthetic approved payloads across six
  languages (six shared pages, five author pages, one message catalog), nested
  author output, internal localized author links, sitemap/reciprocal links,
  reproducibility, stale review, empty-manifest rollback and owner logout isolation.
  Also renders all 34 public archives in all six languages (204 fixtures), checking
  nested canonicals, English alternates, direction/language and credit links.
  Rejects author path traversal and excludes legacy unpublished topic sources.
- `npm test`: PASS, all 31 regression commands, including auth/CSRF, private Blob,
  subscription/newsletter privacy, import/recovery, independent translation budgets
  and paused-switch guards. Provider/Blob/translation fixtures remain synthetic.
- `node scripts/extract-translations.mjs /tmp/folkly-archive-contract-export`: PASS,
  exactly 11 stories and 46 shared UI contracts outside public output.

- `npm run test:hosted`: PASS, all 45 public English reader, credit, privacy,
  metadata, image and private-output boundary checks against https://www.folkly.com.
  This is pre-update readback; the empty manifest introduces no public locale pages.

## Release limits

The production translation manifest remains empty. No paid provider call, human
language review, localized release, outgoing newsletter or new article publication
occurred. Public deployed English readback is tracked below; it cannot establish
actual locale/mobile review or authenticated owner/provider recovery acceptance.
All autonomous article switches remain disabled. This code task needs no new Noah
credential or connection action. Original lossless source import and full hosted
editorial/newsletter/recovery acceptance remain separate Stage 7 gates; the owner
has already reported provider secrets and pilot/reviewer/GA4 setup complete.
Google Cloud and Vercel connector work remain deferred.

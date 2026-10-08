# Images, discovery, and SEO verification: October 8, 2026

Verified implementation commit: `c13bc600042eef0c4bec027a13386be44a3542fc` on main and master.

- `npm run build` passed with the existing public-only offline build.
- `npm test` passed all regression suites, including authentication, private storage, publication/spend guards, analytics evidence, and owner response races. Expected failure-path diagnostics are exercised by mocks; no paid model calls or Google API calls were made.
- After the final legacy-image and CSS adjustments, `node scripts/test-public-articles.mjs` and `node scripts/test-vercel.mjs` passed again. Ten stories have images; Detroit retains a text card pending a suitably licensed image.
- All 11 published stories have exactly one grid card. A future approved catalog entry automatically appears; a private draft canary stays out. Duplicate/unsafe routes and unsupported image hosts are rejected.
- All seven approved article bodies and source lists remain unchanged. Image credits, completed summaries/decks, extensionless canonicals, preview metadata, and image schema were added during the public build.
- Live homepage, all 11 articles, CSS, image credits, sitemap, and robots.txt returned HTTP 200 and matched the local build byte for byte. All seven external image URLs returned HTTP 200. Anonymous `/api/owner` returned 401; `/admin` returned 404.
- GitHub's Vercel commit status reports success. The Vercel connector returned 403 for deployment listing for the existing team/project, and the CLI is unavailable here. Direct public checks establish the served content; build-log inspection requires project access through the Vercel connection.
- No private reserve was exported, and no production/publication/schedule settings or worker credentials were changed. Automated publishing remains off.

The [SEO audit](../seo/audit-2026-10-08.md) contains site priorities and recommendations for all 11 articles. The [article inventory](../seo/article-inventory-2026-10-08.json) records the generated metadata. [Live HTTP evidence](images-grid-seo-live-2026-10-08.json) records individual responses.

Search Console indexing, duplicate-host behavior, Rich Results validation, real mobile rendering, Core Web Vitals, and the wider Stage 7 deployed acceptance gates remain separate checks. No ranking or measured performance improvement is claimed.

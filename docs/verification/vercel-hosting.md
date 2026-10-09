# Vercel hosting verification, 2026-10-07

Root cause: commit 3eef05e had no root build entry or declared public output.
Vercel marked an empty build READY, yielding 404.

Added root package.json, explicit Vercel dist configuration, offline public-only
build, and 16 current public page captures. Assets are copied from the existing
web/static paths. Updated the existing folk project's root, build, and output
settings through Vercel. No new project or database was created.

Local build and focused test passed: four articles retain sources and JSON-LD;
internal page links resolve; all seven reserve slugs are excluded; output has no
database, JSON snapshot, editorial executable, admin route, or cron. Canonical
URLs use www.folkly.com rather than the previous Sites origin.

The static Vercel reader is independent of Sites at runtime. Full autonomous
backend migration is pending durable SQL storage and owner authentication;
existing reserve remains in its current store and publication stays disabled.
Deployed acceptance must be rerun on Vercel before activation.

## Hosted reader result

Source commit f93f20c was synchronized to main and master. Vercel deployment
dpl_2pfxJ5zWSQLy1itaqBcuBRcqJoPD reached READY for that exact source.
On https://www.folkly.com, home and all four published stories returned 200;
style.css and assets/lisbon.jpg returned 200; /admin and /bonwire-kente returned
404. Homepage SHA-256 matched the local built output exactly:
ffa98bdffc1ddd1066237f44ae9174e6b3d9f7cf9afd78ceee7db9d8372de2df.
Build and focused checks passed twice; the existing publisher evidence fixture
also passed. Protected preview verification was denied at the Vercel connection
permission boundary (403); protection was retained. Mobile UI and the editorial
backend acceptance remain pending. No activation switch was changed.

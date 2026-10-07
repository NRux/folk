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

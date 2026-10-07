# Folkly Site migration

This directory contains the portable D1 data transfer boundary. The live Site is still
static; these files do not activate publishing or expose the unpublished reserve.

`schema.sql` is a schema-only snapshot of the current, upgraded SQLite model. It includes
the late Stage 04 columns and spend ledger. A future Site source migration must append
this schema through its supported migration system before importing any data. Once a
migration has been applied to D1, do not edit it in place.

For a private migration rehearsal, from the repository root:

```text
node web/site-runtime/test-import.mjs
node web/site-runtime/test-reader.mjs
node web/site-runtime/export-snapshot.cjs web/folkly.db <private path outside the Site and Git>
```

The exporter excludes local jobs, spend, audit history, and old publication slots. It
transfers personas, public pages and articles, unpublished drafts and the reviewed
reserve, their versions, sources, claims, media metadata, and checks. It requires the
three local autonomous switches to be off. The SHA-256 checksum is checked before
import. `importSnapshot(db, snapshot)` accepts a D1 binding in a protected setup
context, inserts in foreign-key order, tolerates retry of interrupted chunks, and
compares counts, article hashes/states, and immutable version content. It never
exposes an HTTP import route. Keep this snapshot out of Site static assets, logs,
public routes, Git, and browser bundles; delete the private export after a verified
production import. Site settings, credentials, owner identity, schedules, and current
spend must be configured and verified independently after migration.

The D1 data transfer is one part of the port. The Node HTTP renderer, admin actions,
pipeline, and scheduler still use synchronous `node:sqlite`. `reader.mjs` is a read-only
Worker/D1 fetch boundary reusing the existing HTML renderer. An isolated D1-shape
adapter checks legacy URLs, author pages, and unpublished reserve isolation, but this
is not a deployed Worker test. The Site source still needs to package this module,
ship its assets, and bind D1. Admin and the publisher need their own authenticated
Worker/D1 implementations. Preserve the Site ID and its public audience, verify all
old URLs and credits in the deployed Site, enforce owner/job authorization, and test
private draft isolation and production readback before enabling publication.

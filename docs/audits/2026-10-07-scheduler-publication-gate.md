# Scheduler publication gate review — 2026-10-07

## Finding

The local Stage 06 publisher accepted an article marked `ready` when its latest
version had no deterministic check rows or independent review record. It also
accepted claim citations that named source IDs absent from the version's source
ledger. Its existing eligibility check rejected failed checks and empty claim
lists, but did not reject these missing or dangling records. If the local
publisher were activated against such a record, the editorial acceptance gate
could be bypassed.

## Fix and verification

`web/lib/scheduler.js` now rejects a candidate with missing deterministic
checks, a missing or non-passing independent review, major or critical review
findings, malformed content JSON, or a claim citation to an unknown source ID.
The checks run during publication eligibility, including the second check while
the publication transaction holds the write lock.

`node web/scripts/test-stage06-scheduler.js` passed with four new negative
fixtures. Each fixture remained unpublished and produced a retryable failure:
missing checks, missing review, a major review finding, and an unknown cited
source. Existing DST, concurrent publisher, timeout retry, provider failure,
empty reserve, backoff, and readback cases also passed.

## Boundary

This changes the repository's Node/SQLite publisher only. It has not changed
the deployed Worker/D1 Site. The Site source checkout failed because its Git
host was unreachable from this run's environment; the GitHub Git transport was
also unreachable. The live schedule and publication switches remain off.
Hosted owner access, authenticated publication and independent readback,
production model credentials, and mobile acceptance remain open.

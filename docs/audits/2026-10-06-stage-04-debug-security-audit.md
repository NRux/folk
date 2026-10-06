# Stage 04 debug and security audit

Date: 2026-10-06  
Scope: code review of the Stage 04 research, editorial, image, budget, runner, and HTTP server paths, followed by integration verification against a disposable copy of the local development SQLite database.

## Findings and changes

| Finding | Change |
|---|---|
| DNS validation was vulnerable to DNS rebinding between lookup and connection, and IPv6 address parsing could misclassify private or mapped addresses. | Validate all resolved addresses, reject private/reserved ranges, and pin the validated address for the request. |
| Image downloads accepted unsafe redirects and had weak response limits/type checks. | Use an allowlisted HTTPS downloader; validate every redirect, cap response size, check MIME and dimensions, and require compatible license/creator metadata. |
| Concurrent budget checks could oversubscribe; absent cost and malformed cap settings could undercount or disable limits. | Make reservations transactional, release exact reservation IDs, charge the estimate when provider cost is absent, and fail closed on invalid caps. |
| Older claim records stored ordinals instead of stable source IDs. | Add a one-time, transactional schema migration to convert valid legacy ordinals; map stable IDs back to source positions when resuming. |
| Retryable failures did not permit every intended image/editorial retry transition. | Allow retryable transitions to and from editorial revision and image clearance, and resume from durable checkpoints. |
| Disclosure enforcement and its verifier were incomplete. | Require AI persona, linked-sources, and no-firsthand-experience language at the publication gate; verify all three persisted disclosure elements. |
| The Stage 04 verifier queried a nonexistent source column, counted authors rather than independent publisher domains, and accepted any hold reason for both gate fixtures. | Query by schema ordinals, compare normalized publisher domains, and assert each fixture reached its intended gate and selected a ready reserve candidate. |
| Per-run budget usage was not associated with runner jobs. | Pass the pipeline job ID through research, drafting, and verification reservations/settlements. |
| Publisher classification treated Wikipedia as scholarly and some general publishers as institutional/primary. | Restrict classes to explicit public-record, local, institutional, scholarly, and practitioner domain patterns. |
| Failure paths only logged that a reserve would be selected. | Select an eligible ready article, then record the selection in the audit trail and job steps for the scheduler. |
| `/admin` returned a public “under construction” page without authentication. | Return 404 until the protected control room is implemented. |
| ShareAlike obligations were not carried into media records. | Preserve required license notes in the stored asset metadata. |

## Verification

The focused security checks pass with `node web/scripts/test-stage04-security.js`. The Stage 04 integration verifier completed **29/29 checks** against a disposable copy of the local development database. The report is in `docs/verification/stage-04-pipeline-run.md`.

The Tokushima seed in that database is a real completed pitch-to-ready run with six retrieved sources, 24 linked claims, typographic image treatment, and disclosure. The unsupported-claim fixture resumed from its saved verification checkpoint and reached needs-review. The image-rights fixture copied the verified seed dossier into an isolated editorial-revision checkpoint, then exercised image-clearance through the needs-review hold. Both fixtures selected a ready reserve candidate and had no publication slot. This setup tests the image gate without claiming a second full pitch-to-ready run.

The verification used the local database and ignored logs only as a read-only source; all migrations and test runs were performed on a disposable copy. No database or console log was committed. JavaScript syntax checks passed for all changed runtime and script files.

## Remaining operational constraints

- The live build currently has one verified ready article; the seven-article operating reserve must be populated before activating the daily schedule.
- Publisher independence uses a conservative hostname heuristic rather than a maintained public-suffix database.
- Application accounting cannot guarantee a cap against upstream charges that are not reported; provider-side limits should also be configured.
- Human review of cultural nuance, source quality, image attribution, and the final article remains part of editorial acceptance.

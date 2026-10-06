# Stage 04 debug and security audit

Date: 2026-10-06  
Scope: static review of the Stage 04 research, editorial, image, budget, runner, and HTTP server paths in the `main` branch. This is a code audit; no local database, provider credentials, ignored runtime logs, or executable checkout were available through the repository connection.

## Findings and changes

| Finding | Change |
|---|---|
| DNS validation was vulnerable to DNS rebinding between lookup and connection, and IPv6 address parsing could misclassify private/mapped addresses. | Validate all resolved addresses, reject private/reserved ranges and pin the validated address for the request. |
| Image download accepted unsafe redirects and had weak response limits/type checks. | Use an allowlisted HTTPS downloader, validate every redirect target, cap response size, check MIME and image dimensions, and require compatible license/creator metadata before saving. |
| Concurrent model steps could pass a budget check before either wrote its reservation; missing provider cost data could release a reservation as zero spend; malformed caps could disable comparisons. | Make reservation check/insert transactional with a unique reservation ID, release the exact reservation on errors, charge the estimate when provider cost is absent, and fail closed on invalid cap settings. |
| Claim citations were stored as transient source ordinals, then read back as database IDs. | Persist references as stable source IDs and map IDs back to ordinals when rebuilding the dossier. Invalid references are discarded and then rejected by source gates. |
| Retryable failures were treated as terminal; image-clearance retry transitions were still disallowed. | Resume from the last durable checkpoint and allow retryable transitions both to and from image-clearance/editorial-revision. |
| The mandatory disclosure gate was a comment rather than a check. | Require the AI persona, linked-sources, and no-firsthand-experience disclosure in the draft content before it can pass. |
| `/admin` returned a public “under construction” page despite no authentication or admin implementation. | Return 404 until a protected control room is implemented. |
| Image ShareAlike obligations were not carried into the media record. | Preserve license notes in the stored asset metadata. |

## Verification

A focused security test script is included at `web/scripts/test-stage04-security.js`. Run it with `node web/scripts/test-stage04-security.js`; the full acceptance command remains `node web/scripts/verify-stage04.js <path-to-folkly.db>`.

These checks could not be executed in this repository-only session. No stage-04 runtime report is present, so the build state remains **IN PROGRESS**. Do not treat static review or the presence of scripts as a passing end-to-end result.

## Remaining operational constraints

- Provider reservations coordinate local application spend accounting. They cannot guarantee a hard ceiling if an upstream provider charges more than reported; configure provider-side limits as well.
- Publisher independence still uses a conservative hostname heuristic rather than a maintained public-suffix database.
- Reserve-pitch selection after a withdrawn pitch is still advisory in the current single-pitch runner. A queue/scheduler must select and start the next eligible pitch; this belongs with Stage 06 scheduling.
- Human review of cultural nuance, source quality, image attribution, and the final article remains part of Stage 04 acceptance.
- The connected repository view does not expose the local SQLite file or ignored logs. The local owner must run the verification command and commit its evidence before Stage 04 can be marked DONE.

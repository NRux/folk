# Stage 07 — Acceptance report

Date: 2026-10-07
Result: **BLOCKED**. The full acceptance suite cannot pass until the production provider and
Site publishing path are available. This report records both passing evidence and remaining
gaps without treating local transaction tests as a live Site publication.

## Acceptance matrix

| Case | Result | Method and evidence |
|---|---|---|
| 1. Existing URLs and credits | PASS locally | Stage 02 preserved the original content and credits. `node web/scripts/test-stage07-reader.js` creates a fresh migrated database and confirms both URL forms serve identical content for all four stories; see also `docs/verification/stage-02-url-check.md`. Live Site parity still needs a deployment check. |
| 2. Five author profiles and distinct voices | PASS locally | A fresh `verify-stage03.js` run against an isolated server on port 18787 passed 26/26 checks, including all five profiles and archives. The previous four failures came from the default port serving a different process, not this database. See `docs/verification/stage-03-personas.md`. |
| 3. Real researched article through gates | PASS | Re-ran `node web/scripts/verify-stage04.js` on the prepared audit database: all checks passed. The legitimate Tokushima feature is 1,607 words with six sources, 24 linked claims, a typographic image treatment, disclosure, and recorded deterministic checks. Gate fixtures also passed. See `docs/verification/stage-04-pipeline-run.md`. |
| 4. Unattended production credentials and independent readback | BLOCKED | The production Site runtime reports no environment-variable entries, the shell has no Folkly provider configuration, and the active Site has no declared MCP endpoint. The local runner is deliberately hard-disabled for live publishing. No production-authenticated write or Site readback was attempted. |
| 5. 07:00 Pacific across DST | PASS (time-resolution logic) | `node web/scripts/test-stage06-scheduler.js` verifies 2026-03-07/09 and 2026-10-31/11-02 at 07:00 Pacific with the expected GMT-8/GMT-7 offsets. This verifies the scheduler calculation, not an active platform schedule. |
| 6. Two simultaneous publishers | PASS (SQLite transaction fixture only) | Two Node worker threads and independent SQLite connections yield exactly one published slot. No live Site publisher is installed, so this is not a production endpoint test. See `docs/verification/stage-06-scheduling.md`. |
| 7. Timeout after publication | PASS (SQLite transaction fixture only) | A simulated post-commit timeout followed by retry returns `already-published`; separate readback confirms the same version/hash and no second slot article. No live Site publisher is installed. |
| 8. Unsupported claims and uncleared images | PASS | The Stage 04 verifier confirms both fixtures stop at `needs-review`, fail their intended gates, and select a ready reserve candidate. |
| 9. Pause, budget, provider failure, empty reserve, expired authorization, missed schedule | BLOCKED as a complete case | Stage 05 admin controls and Stage 06 provider-failure, empty-reserve, retry-backoff, and late same-day delay fixtures pass. Expired production authorization and a platform-triggered missed schedule cannot be verified without the Site publisher/scheduler connection. |
| 10. Private reads/writes and draft-leak prevention | PASS locally; BLOCKED deployed | `test-stage05-admin.js` covers anonymous/non-owner reads and writes, owner controls and sanitization. `test-stage07-reader.js` migrates a fresh isolated database, inserts a private draft canary, tests all current reader routes, metadata-bearing pages, absent feed/API endpoints and no-store cache headers. The deployed Site's auth, cache and draft isolation still require verification after its runtime migration. |
| 11. Mobile, restore, edit, correction | BLOCKED as a complete case | Stage 05 tests restore, versioned edits, and correction notes. No mobile viewport/browser acceptance test was available or run. |

The reader fixture is repeatable from a clean checkout and does not alter the operational database.
The full eleven-case integration suite cannot pass yet: live publisher, provider, schedule,
deployed authorization and mobile verification are still release gates.

On 2026-10-07, two consecutive local debug/security passes ran `test-stage05-admin.js`,
`test-stage06-scheduler.js`, and `test-stage07-reader.js`; all three passed in both rounds.
These checks exercise owner authorization, stored-content sanitization, publication concurrency
and retry, and draft isolation. They do not constitute two clean production security audits:
deployed Site auth, storage and publishing are still absent.

## Post-seed snapshot

The local development database contains **1 eligible ready article out of the 7-article target**:
Tokushima aizome, assigned to Mira Sol, category "indigo dyeing (aizome) and craft economies."
It has 31 open slots, no published new article and no meaningful 30-day persona/theme assignment
balance. The local database is ignored by git and is not a deployed production state; slot dates
from this snapshot must not be treated as a configured first publication date.

No additional reserve articles or calendar pitches were produced. The available Site runtime has
no configured provider variables, and there is no Site MCP writer. Proceeding to fill the reserve
would require production research credentials that are not available in this environment and
would contradict the requirement to use the real pipeline with real configured providers.

## Required to unblock

Port the Node HTTP/synchronous SQLite implementation to the existing Site's Worker/D1 runtime,
migrate its data, connect and verify a scoped unattended publisher, and configure the intended
research/model provider in supported server-side configuration. The current static Site does not
declare an MCP server; adding one is a possible authenticated invocation path, not a substitute
for the runtime/data migration. Then run the eleven cases against the deployed Site, produce six
additional validated evergreen features through the real pipeline within the $5/day and
$100/month caps, and verify an independent production readback.
Keep the recurring schedule inactive until those checks pass.

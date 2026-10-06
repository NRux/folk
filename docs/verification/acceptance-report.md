# Stage 07 — Acceptance report

Date: 2026-10-06  
Result: **BLOCKED**. The full acceptance suite cannot pass until the production provider and
Site publishing path are available. This report records both passing evidence and remaining
gaps without treating local transaction tests as a live Site publication.

## Acceptance matrix

| Case | Result | Method and evidence |
|---|---|---|
| 1. Existing URLs and credits | PASS (committed evidence) | Stage 02 recorded 14/14 route checks, including extensionless and `.html` forms, with exact migrated text. See `docs/verification/stage-02-url-check.md`. The available disposable Stage 04 audit copy lacks the preserved pages required to repeat that verifier. |
| 2. Five author profiles and distinct voices | BLOCKED for fresh rerun | The committed Stage 03 report records 26/26 checks. A rerun against the available `folk-audit` disposable copy failed four checks (place/topic archives and related links on Lisbon/Oaxaca). That copy is not a complete clean-checkout fixture; this stage cannot establish whether the failures reproduce against the canonical migrated database. See `docs/verification/stage-03-personas.md` and rerun output from `web/scripts/verify-stage03.js`. |
| 3. Real researched article through gates | PASS | Re-ran `node web/scripts/verify-stage04.js` on the prepared audit database: all checks passed. The legitimate Tokushima feature is 1,607 words with six sources, 24 linked claims, a typographic image treatment, disclosure, and recorded deterministic checks. Gate fixtures also passed. See `docs/verification/stage-04-pipeline-run.md`. |
| 4. Unattended production credentials and independent readback | BLOCKED | The production Site runtime reports no environment-variable entries, the shell has no Folkly provider configuration, and the active Site has no declared MCP endpoint. The local runner is deliberately hard-disabled for live publishing. No production-authenticated write or Site readback was attempted. |
| 5. 07:00 Pacific across DST | PASS (time-resolution logic) | `node web/scripts/test-stage06-scheduler.js` verifies 2026-03-07/09 and 2026-10-31/11-02 at 07:00 Pacific with the expected GMT-8/GMT-7 offsets. This verifies the scheduler calculation, not an active platform schedule. |
| 6. Two simultaneous publishers | PASS (SQLite transaction fixture only) | Two Node worker threads and independent SQLite connections yield exactly one published slot. No live Site publisher is installed, so this is not a production endpoint test. See `docs/verification/stage-06-scheduling.md`. |
| 7. Timeout after publication | PASS (SQLite transaction fixture only) | A simulated post-commit timeout followed by retry returns `already-published`; separate readback confirms the same version/hash and no second slot article. No live Site publisher is installed. |
| 8. Unsupported claims and uncleared images | PASS | The Stage 04 verifier confirms both fixtures stop at `needs-review`, fail their intended gates, and select a ready reserve candidate. |
| 9. Pause, budget, provider failure, empty reserve, expired authorization, missed schedule | BLOCKED as a complete case | Stage 05 admin controls and Stage 06 provider-failure, empty-reserve, retry-backoff, and late same-day delay fixtures pass. Expired production authorization and a platform-triggered missed schedule cannot be verified without the Site publisher/scheduler connection. |
| 10. Private reads/writes and draft-leak prevention | BLOCKED as a complete case | Re-ran `node web/scripts/test-stage05-admin.js`: anonymous/non-owner authorization, XSS sanitization, owner edits and protected controls pass. Draft leakage through every reader route, feed, metadata response, and cache was not exhaustively tested against the deployed Site. |
| 11. Mobile, restore, edit, correction | BLOCKED as a complete case | Stage 05 tests restore, versioned edits, and correction notes. No mobile viewport/browser acceptance test was available or run. |

The existing component tests cover much of the local behavior, but there is no single clean-checkout
Stage 07 integration runner that can pass all eleven cases with the current dependencies. Cases
marked blocked remain release gates.

## Post-seed snapshot

The prepared Stage 04 audit database contains **1 eligible ready article out of the 7-article
target**: Tokushima aizome, assigned to Mira Sol, category “indigo dyeing (aizome) and craft
economies.” Its next open Pacific calendar slot is **2026-10-06 at 7:00 a.m.** The snapshot has
31 open slots and no article-version assignments, so there is no meaningful 30-day persona/theme
assignment balance yet. Its spend ledger contains 37 rows totaling **$0.00**; this is a disposable
verification snapshot, not a production account balance.

No additional reserve articles or calendar pitches were produced. The available Site runtime has
no configured provider variables, and there is no Site MCP writer. Proceeding to fill the reserve
would require production research credentials that are not available in this environment and
would contradict the requirement to use the real pipeline with real configured providers.

## Required to unblock

Configure the intended research/model provider in supported server-side runtime configuration
and install/enable the Site MCP publishing endpoint on the existing Site. Then rerun the canonical
Stage 02/03/07 integration checks, produce six additional validated evergreen features through
the real pipeline within the $5/day and $100/month caps, and verify a separate Site readback.
Keep the recurring schedule inactive until those checks pass.

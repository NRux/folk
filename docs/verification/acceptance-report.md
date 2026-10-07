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
| 3. Real researched article through gates | PASS locally | `node web/scripts/verify-reserve.js web/folkly.db` reports seven eligible articles, each with a version hash, at least five retrieved sources, linked claims, deterministic checks, and an independent pass without major or critical findings. Tokushima was revised to 1,222 words after removing a duplicated source list; its six sources, 24 claims, typographic treatment, and disclosure remain. The earlier Stage 04 gate fixtures also passed. See `docs/verification/reserve-fill.md`. |
| 4. Unattended production credentials and independent readback | BLOCKED | A configured local Ollama model produced the reserve at zero metered provider cost. The production Site has no configured model access or declared MCP publisher and remains a separate static source. The local runner is hard-disabled for live publishing. No production-authenticated write or Site readback was attempted. |
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

On 2026-10-07, two consecutive local debug/security passes ran `test-stage04-security.js`,
`test-stage05-admin.js`, `test-stage06-scheduler.js`, and `test-stage07-reader.js`; all four
passed in both rounds after the reserve pipeline changes.
These checks exercise owner authorization, stored-content sanitization, publication concurrency
and retry, and draft isolation. They do not constitute two clean production security audits:
deployed Site auth, storage and publishing are still absent.

## Post-seed snapshot

The local development database contains **7 eligible ready articles out of the 7-article target**:
Tokushima, Kimjang, Castells, Xochimilco chinampas, Nowruz/sumanak, Bonwire kente, and
Matariki/Puanga. They cover seven countries and four personas (Mira 1, Lena 2, Rowan 2,
Sasha 2; Ellis 0). The three other researched candidates, Gnaoua, Havana rumba, and
T'nalak, remain held for review and are excluded. The independent reviews still note
minor editorial issues; there are no unresolved major or critical findings in the ready set.
See `docs/verification/reserve-fill.md` for each source and claim count.

There are 32 open local slots (30 dated 2026-10-07 or later), with no newly published
article. The earliest not-past local slot is 2026-10-07, but it is not an activated
first publication date. No article is assigned to an upcoming slot, so a 30-day theme
or persona sequence cannot yet be measured. The local model's metered cost was $0;
budget reservations were released. The SQLite database is ignored by git; a
credential-free, unpublished content bundle is tracked at `web/data/reserve-seed.json`
for the future Site data migration. Neither is deployed production state.

## Required to unblock

Port the Node HTTP/synchronous SQLite implementation to the existing Site's Worker/D1 runtime,
migrate the preserved site and unpublished reserve data, connect and verify a scoped unattended
publisher, and configure a supported server-side model provider. The current static Site does not
declare an MCP server; adding one is a possible authenticated invocation path, not a substitute
for the runtime/data migration. Then run the eleven cases against the deployed Site and verify
an independent production readback.
Keep the recurring schedule inactive until those checks pass.

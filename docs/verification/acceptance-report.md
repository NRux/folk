# Stage 07 — Acceptance report

Date: 2026-10-07
Result: **BLOCKED**. The public Worker/D1 reader and owner-gated publisher are deployed, but
the authenticated unattended connection, production provider, hosted publication/readback,
mobile verification, and complete failure suite are not accepted. No hosted article was published.

## Acceptance matrix

| Case | Result | Method and evidence |
|---|---|---|
| 1. Existing URLs and credits | PASS deployed | Four published stories retain both URL forms, main content and figure credits. `node web/scripts/verify-hosted-reader.js` passed twice against the deployed Site, 60 checks per pass. Stage 02 and the local reader fixture provide the original baseline. |
| 2. Five author profiles and distinct voices | PASS locally; profiles deployed | A fresh `verify-stage03.js` run against an isolated server on port 18787 passed 26/26 checks, including voice distinctions. All five author URLs return 200 on the deployed Site. See `docs/verification/stage-03-personas.md`. |
| 3. Real researched article through gates | PASS locally; hosted evidence view deployed | `node web/scripts/verify-reserve.js web/folkly.db` reports seven eligible articles, each with a version hash, at least five retrieved sources, linked claims, deterministic checks, and an independent pass without major or critical findings. Tokushima was revised to 1,222 words after removing a duplicated source list; its six sources, 24 claims, typographic treatment, and disclosure remain. Site version 4 adds a private owner view of version, sources, claims, checks, disclosure and image rights. Its local auth fixture passed, but real hosted owner viewing remains unverified. See `docs/verification/reserve-fill.md` and `docs/verification/site-migration-boundary.md`. |
| 4. Unattended production credentials and independent readback | BLOCKED | A local Ollama model produced the reserve at zero metered provider cost. The deployed Site declares `/mcp` with `folkly_publish_today`, but its connection and a hosted production model are unavailable. A local D1 publisher fixture read back a single article/version/hash; no authenticated hosted write/readback occurred. |
| 5. 07:00 Pacific across DST | PASS (time-resolution logic) | `node web/scripts/test-stage06-scheduler.js` verifies 2026-03-07/09 and 2026-10-31/11-02 at 07:00 Pacific with the expected GMT-8/GMT-7 offsets. This verifies the scheduler calculation, not an active platform schedule. |
| 6. Two simultaneous publishers | PASS in isolated fixtures; hosted BLOCKED | Two Node worker threads and independent SQLite connections yield one slot. A local Worker/D1 fixture also gave one published Kimjang article under two concurrent calls. Hosted concurrency was not exercised. See `docs/verification/stage-06-scheduling.md`. |
| 7. Timeout after publication | PASS in isolated fixtures; hosted BLOCKED | A simulated post-commit timeout followed by retry returns `already-published` in SQLite. The local Worker/D1 fixture retry returned the same slot after publication and readback. Hosted timeout/retry remains untested. |
| 8. Unsupported claims and uncleared images | PASS | The Stage 04 verifier confirms both fixtures stop at `needs-review`, fail their intended gates, and select a ready reserve candidate. |
| 9. Pause, budget, provider failure, empty reserve, expired authorization, missed schedule | BLOCKED as a complete case | Local Stage 05/06 failure fixtures pass. A synthetic owner request paused the hosted-style admin fixture; budget input validation and cross-origin rejection passed. Deployed anonymous access passed, but authenticated hosted owner, expired OAuth, provider failures, and platform-triggered missed schedule remain untested. |
| 10. Private reads/writes and draft-leak prevention | PASS for anonymous deployed reads; owner BLOCKED | The hosted reader check confirms all seven ready slugs return 404, do not appear on the home page, and use no-store. `/admin`, `/admin/story`, `/api/admin`, and MCP calls reject anonymous requests; the removed bootstrap route returns 404. Forged owner headers were rejected by the Sites boundary. The story evidence view passed local sign-in, non-owner denial, and draft-isolation tests. Authenticated hosted owner access and mutations remain untested. |
| 11. Mobile, restore, edit, correction | BLOCKED as a complete case | Stage 05 tests restore, versioned edits, and correction notes. No mobile viewport/browser acceptance test was available or run. |

The reader fixture is repeatable from a clean checkout and does not alter the operational database.
The full eleven-case integration suite cannot pass yet: hosted owner identity and publisher,
provider, schedule, failure recovery and mobile verification remain release gates.

On 2026-10-07, two consecutive local debug/security passes ran `test-stage04-security.js`,
`test-stage05-admin.js`, `test-stage06-scheduler.js`, and `test-stage07-reader.js`; all four
passed in both rounds after the reserve pipeline changes.
These checks exercise owner authorization, stored-content sanitization, publication concurrency
and retry, and draft isolation. Two later hosted reader/access passes each passed 60 checks,
covering public content and anonymous access. These do not constitute two clean production
security audits: authenticated writes and the production pipeline remain unverified.

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
credential-free, unpublished content bundle is tracked at `web/data/reserve-seed.json`.
The seven reviewed stories are also private records in hosted D1. None is publicly released.

## Required to unblock

Connect and verify the deployed Site's scoped MCP publisher under the real owner identity,
configure a supported server-side model provider, and port the Node research/replenishment
pipeline and remaining owner editorial controls into the hosted runtime. Then run the eleven
cases against the deployed Site, including a controlled authenticated write and independent
production readback, OAuth expiry, failure recovery, and mobile viewport checks. The Site
connection and model-provider plugin were surfaced for connection; a suggestion is not a
connection. Keep both autonomous switches and the recurring schedule inactive until accepted.

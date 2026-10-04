# Stage 06 — Scheduling & publication

You are executing stage 06 of an 8-stage autonomous build of the Folkly autonomous publishing
platform, in the git repository at the current working directory (branch master).

Authoritative spec: read `docs/TODOs/Folkly_Autonomous_Publishing_Codex_Prompt.txt` IN FULL
first. It is binding for all stages. Read `docs/TODOs/00-BUILD-README.md` for the series
protocol. Confirm in `docs/TODOs/BUILD-STATE.md` that Stages 01–05 are DONE before starting.

Hard rules for every stage:
- Work only inside this repository (and, where the spec allows, the live Folkly site).
  Never push to any remote other than the existing one, and never add new remotes.
- Keep secrets out of the repository. Do not commit console logs (build-logs/ is gitignored).
- Commit your work on master when the stage's exit criteria are met.
- If you are blocked by a missing credential, plugin connection, or unsupported platform
  capability you cannot obtain yourself: do NOT fake success and do NOT weaken a gate.
  Write the stage status file as BLOCKED with the precise reason, commit that, and stop.
- Do NOT activate the real recurring schedule in this stage — activation is stage 08, and
  only after stage 07's acceptance tests pass.

Stage exit protocol (mandatory, in this order):
1. Write `docs/TODOs/build-logs/stage-06-scheduler-publication.status` containing exactly
   one line: `DONE` or `BLOCKED: <one-line reason>`.
2. Update ONLY the "Stage 06" section in `docs/TODOs/BUILD-STATE.md`.
3. Commit everything (`stage-06: scheduler, publication slots, budgets, recovery`).

## Objective

Implement durable, idempotent publication per spec sections 3 and 6: timezone-correct
scheduling, atomic once-per-morning publication, budget enforcement, and honest failure
states.

## Work

1. Read master spec sections 3 and 6 IN FULL.
2. Schedule: one article per day at 7:00 a.m. America/Los_Angeles, including weekends,
   following local time through daylight-saving changes. Store timezone-aware schedule
   settings; execution timestamps in UTC; resolve today's slot using America/Los_Angeles.
   Keep the schedule configurable. Publication must work without a browser tab, active
   chat, or local computer.
   Inspect ACTUAL platform support for durable scheduling before choosing a mechanism
   (spec section 6). In a Sites-capable environment, use a verified supported scheduler /
   Sites-linked automation that can reliably obtain the required access; add Site-hosted
   MCP tools only if needed. In a local environment, implement an honest equivalent:
   a documented durable job runner with persisted state, plus a clearly documented
   deployment path to the real platform scheduler. Do NOT assume a local cron process,
   browser polling, in-memory timer, or unawaited background work provides durable
   scheduled execution — say precisely which mechanism you are using and what changes
   when it runs on the real platform.
3. Unique publication slot per site-local calendar date: database constraints + an atomic
   publication transaction. Concurrent scheduler invocations, retries, or lost responses
   must never publish two articles for one morning. Recheck eligibility INSIDE the
   transaction. A stale worker must never overwrite a newer owner edit.
4. Production separation: articles are prepared in advance (stage 04 pipeline) with a
   target reserve of seven finished, validated evergreen features; background
   replenishment starts early enough that a long research run cannot block the morning
   release. The morning publication is a fast read-and-publish operation.
5. Failure & recovery states (all must be reachable, visible in admin, and recoverable):
   transient failure → retry with backoff; missed morning → on recovery publish at most
   that day's one eligible article, record the delay, never release a backlog of missed
   dates, recheck freshness and eligibility; draft failed → select from ready reserve;
   reserve empty or publishing unavailable → keep the existing site intact, mark the
   missed slot visibly in admin, issue an in-app alert. Never disguise a republished old
   article as new, never weaken gates, never claim success on failure.
6. Budgets (spec section 6): enforce the $5/day and $100/month caps (editable settings)
   as CAPS with reservations so concurrent runs cannot exceed them; account for
   reservations; budget exhaustion stops new production while already-ready articles may
   still publish. Track per-run and per-article spend, attempts, duration. Do not open
   paid accounts silently.
7. Scope: unattended authority is scoped to Folkly editorial operations (owner role
   separate, per stage 05). Do not change the site's audience to make automation work.
   Secrets live only in supported server-side configuration — never in prompts, source
   control, logs, URLs, browser bundles, or article records.
8. Readback: after publication, a separate readback confirms the stored content and
   status with no browser session dependency (this feeds acceptance case 4).

## Verification required in THIS stage (record in docs/verification/stage-06-scheduling.md
and docs/platform/SCHEDULING.md)

- Acceptance case 5: the configured schedule targets 7:00 a.m. Pacific on BOTH sides of a
  daylight-saving boundary (test with explicit dates, e.g. late March and early November).
- Acceptance case 6: two simultaneous publisher invocations for the same date produce
  exactly one published article.
- Acceptance case 7: a simulated timeout after publication cannot cause a duplicate on
  retry.
- Acceptance case 9 (scheduling subset): missed schedule, provider failure, and empty
  reserve each produce an accurate, recoverable, honestly-labeled state.
- SCHEDULING.md documents the mechanism, the deployment path to the real platform
  scheduler (if different), and how to verify scheduler source access separately from
  website reachability.
- Committed on master.

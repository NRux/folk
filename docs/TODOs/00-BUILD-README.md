# Folkly Autonomous Build — Stage Prompt Series

Master spec: `Folkly_Autonomous_Publishing_Codex_Prompt.txt` (this directory). It is the
binding editorial and technical specification for the whole build. The stage prompts below are
an execution decomposition of that spec, not a replacement for it — every stage re-reads the
master spec first and defers to it on any conflict.

## Stage order

| # | Prompt file | Delivers |
|---|-------------|----------|
| 01 | `stage-01-inspect-preserve.md` | Authoritative baseline of the live site; preservation manifest. No changes to the live site. |
| 02 | `stage-02-platform-migration.md` | Server runtime + durable content layer; idempotent migration of all existing content; existing URLs keep resolving. |
| 03 | `stage-03-personas-rendering.md` | Five editorial personas (profiles, versioned briefs, disclosure), author pages, archives, related links, metadata. |
| 04 | `stage-04-research-pipeline.md` | Full staged workflow (pitch → … → ready), research rules, claim ledger, verification, hard gates, image clearance, calendar + reserve. |
| 05 | `stage-05-admin-control-room.md` | Protected /admin: authorization, dashboard, every control in spec §7, owner overrides, audit. |
| 06 | `stage-06-scheduler-publication.md` | Durable scheduling, atomic publication slots, dedup/idempotency, DST handling, reserve fallback, budgets, readback. |
| 07 | `stage-07-acceptance-verify.md` | All 11 acceptance cases as integration tests; real calendar seed + reserve fill through the real pipeline. |
| 08 | `stage-08-activate-ops-delivery.md` | Credential-free operations doc; schedule activation on the existing Site where supported; final delivery summary. |

## Execution protocol (each stage)

1. Read the master spec IN FULL, then `BUILD-STATE.md` (confirm the previous stage is DONE, or
   has a recorded BLOCKED that you were explicitly told to work around).
2. Do the stage's work; test its exit criteria; commit on `master` with a clear message
   (`stage-NN: <what landed>`).
3. Write `build-logs/<stage>.status` containing exactly one line — `DONE` or
   `BLOCKED: <one-line reason>` — and update ONLY your stage's section in `BUILD-STATE.md`
   (status, evidence paths, notes). Commit these too.
4. Never fake success. A missing credential, plugin connection, or unsupported platform
   capability is a BLOCKED status with the precise reason, not a workaround that claims success.

## Execution

The stages are executed directly by the Hermes agent (the user directed that the Codex CLI
not be used for this build). `build-driver.sh` is retained for reference only and is NOT the
active runner.

Per-stage protocol (unchanged): read the master spec in full; do the stage's work; verify its
exit criteria; write `build-logs/<stage>.status` (`DONE` or `BLOCKED: <reason>`); update only
the stage's section in `BUILD-STATE.md`; commit on master. Never fake success.

## State

- `BUILD-STATE.md` — single source of truth for progress (committed).
- `build-logs/` — ephemeral console logs + status markers (gitignored).
- `docs/preservation/` — stage 01 baseline captures.
- `docs/verification/` — per-stage verification evidence (stages 02+).
- `docs/platform/` — architecture + scheduling documentation (stages 02, 06).

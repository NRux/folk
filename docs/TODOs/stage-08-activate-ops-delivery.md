# Stage 08 — Operations doc, activation & delivery

You are executing stage 08 (final) of an 8-stage autonomous build of the Folkly autonomous
publishing platform, in the git repository at the current working directory (branch master).

Authoritative spec: read `docs/TODOs/Folkly_Autonomous_Publishing_Codex_Prompt.txt` IN FULL
first. It is binding for all stages. Read `docs/TODOs/00-BUILD-README.md` for the series
protocol. Confirm in `docs/TODOs/BUILD-STATE.md` that Stages 01–07 are DONE before starting.
If Stage 07 is not DONE (acceptance not fully green), do NOT activate the schedule —
write the status file BLOCKED, explain precisely what remains unverified, and stop.

Hard rules for every stage:
- Work only inside this repository (and, where the spec allows, the live Folkly site).
  Never push to any remote other than the existing one, and never add new remotes.
- Keep secrets out of the repository. Do not commit console logs (build-logs/ is gitignored).
- Commit your work on master when the stage's exit criteria are met.
- If you are blocked by a missing credential, plugin connection, or unsupported platform
  capability you cannot obtain yourself: do NOT fake success and do NOT weaken a gate.
  Write the stage status file as BLOCKED with the precise reason, commit that, and stop.
  (For this stage, that also means: do not claim the platform is autonomous until the
  scheduled path, authorization, writes, and readback actually work.)

Stage exit protocol (mandatory, in this order):
1. Write `docs/TODOs/build-logs/stage-08-activate-ops-delivery.status` containing exactly
   one line: `DONE` or `BLOCKED: <one-line reason>`.
2. Update ONLY the "Stage 08" section in `docs/TODOs/BUILD-STATE.md`.
3. Commit everything (`stage-08: operations doc, schedule activation, delivery`).

## Objective

Produce the credential-free operations document, activate the real recurring schedule only
where support and verification allow, and deliver the final summary.

## Work

1. Read master spec sections 6 and 8 IN FULL.
2. Write `docs/OPERATIONS.md` — a CREDENTIAL-FREE operations document describing:
   architecture (link ARCHITECTURE.md), setup, scheduling, job recovery, migrations,
   policy versions, costs, corrections, and how to pause the system. It must be
   retrievable by a fresh scheduled task if that execution model needs it — production
   must not depend on the temporary authoring checkout or credentials available only in
   a chat conversation. No secrets, no personal credentials, no account names that
   reveal access.
3. Activation decision:
   - If this environment has verified Sites scheduling support AND stages 01–07 are DONE:
     activate the real recurring schedule on the EXISTING Site project. Reuse an existing
     matching schedule instead of creating duplicates. Schedule the first regular morning
     slot AFTER activation (do not publish a launch batch). Clearly identify any
     one-time launch article separately — do not backdate it and do not disguise it as a
     routine article. Verify: the schedule exists, the first slot is set for 7:00 a.m.
     America/Los_Angeles, and (if a test run is supported) a successful test run is
     distinguished from an actual completed scheduled run in the delivery summary.
   - If scheduling support is not verifiable here: do NOT activate, do NOT claim
     autonomy. Keep the current site usable, record exactly what remains unverified,
     state the precise missing action (credential/plugin/capability) that would complete
     activation, and write status BLOCKED.
4. Budget and controls check: confirm the $5/day and $100/month caps, the pause control
   location, the separate production/publication switches, and in-app alerts are live and
   correct in the deployed state.
5. Write `docs/DELIVERY.md` with exactly the deliverables spec section 8 requires:
   the updated site link; the owner admin link; a concise change summary; verification
   results (link the acceptance report); the configured first publication date and
   Pacific time; the reserve count; the budget caps; and the location of the pause
   control. Distinguish explicitly: a saved schedule, a successful test run, and an
   actual completed scheduled run.

## Exit criteria

- `docs/OPERATIONS.md` complete, credential-free, fresh-task-retrievable.
- Schedule activated AND verified (status DONE) — or precise unverified-remainder
  recorded with the single missing action (status BLOCKED). No false autonomy claims.
- `docs/DELIVERY.md` contains every required deliverable with real values, not
  placeholders.
- Committed on master.

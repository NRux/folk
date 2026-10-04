# Stage 05 — Owner control room (/admin)

You are executing stage 05 of an 8-stage autonomous build of the Folkly autonomous publishing
platform, in the git repository at the current working directory (branch master).

Authoritative spec: read `docs/TODOs/Folkly_Autonomous_Publishing_Codex_Prompt.txt` IN FULL
first. It is binding for all stages. Read `docs/TODOs/00-BUILD-README.md` for the series
protocol. Confirm in `docs/TODOs/BUILD-STATE.md` that Stages 01–04 are DONE before starting.

Hard rules for every stage:
- Work only inside this repository (and, where the spec allows, the live Folkly site).
  Never push to any remote other than the existing one, and never add new remotes.
- Keep secrets out of the repository. Do not commit console logs (build-logs/ is gitignored).
- Commit your work on master when the stage's exit criteria are met.
- If you are blocked by a missing credential, plugin connection, or unsupported platform
  capability you cannot obtain yourself: do NOT fake success and do NOT weaken a gate.
  Write the stage status file as BLOCKED with the precise reason, commit that, and stop.

Stage exit protocol (mandatory, in this order):
1. Write `docs/TODOs/build-logs/stage-05-admin-control-room.status` containing exactly one
   line: `DONE` or `BLOCKED: <one-line reason>`.
2. Update ONLY the "Stage 05" section in `docs/TODOs/BUILD-STATE.md`.
3. Commit everything (`stage-05: admin control room, authorization, owner overrides`).

## Objective

Build the protected /admin area exactly per spec section 7. The editorial control room
belongs here, not on the reader-facing site.

## Work

1. Read master spec section 7 IN FULL.
2. Authorization: server-side authorization on EVERY relevant admin action. Preserve the
   platform's authentication and verify the owner role — a signed-in visitor is not
   automatically an administrator. Unattended jobs get narrowly scoped access DISTINCT
   from an interactive owner session (stage 06 uses the job scope; do not hand jobs the
   owner scope). Anonymous or non-owner callers cannot modify content or read private
   editorial records (this is acceptance case 10 — test it).
3. Dashboard must show: next publication in Pacific time; today's slot and outcome; the
   next article; reserve count; recent failures; spend; and whether each automation is
   truly enabled (reflect the real state of each scheduler/automation, never a fake
   indicator).
4. Implement every listed control (spec section 7):
   - Calendar and pipeline views, including the reason an article is blocked.
   - Draft preview, editing, source ledger, image credits, verification results.
   - Editable persona voice briefs, active status, subject balance, and history.
   - Manual topic input, exclusions, assignments, and scheduling overrides.
   - Pause/resume autonomous operation; retry a failed step; replace tomorrow's story;
     publish-now with explicit owner intent.
   - Separate switches for automatic production and automatic publication.
   - Article version comparison, restore, unpublish, and correction notes.
   - Schedule, model, budget, length, and editorial-policy settings.
5. Behavior rules: routine articles that pass all gates publish automatically — do NOT
   insert a mandatory daily human-approval step. Owner overrides are logged. Editing
   factual content triggers revalidation (an approval applies to one exact content
   version; later edits invalidate it until required checks run again). No fake
   operational indicators or successful notification messages. Alerts start IN-APP only;
   email/Slack only after explicit destination authorization by the owner (settings exist,
   off by default).
6. Keep the admin visually consistent with the magazine's design language (restrained
   color, clear hierarchy) but it is a control room, not reader UI.

## Verification required in THIS stage (record in docs/verification/stage-05-admin.md)

- Authorization matrix test: anonymous, signed-in non-owner, and owner attempts against
  representative actions (read private records, edit a draft, unpublish, change settings,
  publish-now) with results showing exactly who is allowed what.
- Dashboard reflects real state: reserve count matches the database; next-publication
  time is computed in America/Los_Angeles; automation-enabled flags read from real
  scheduler state.
- Owner override flow exercised: pause → resume, retry a step, replace tomorrow's story,
  and an owner edit triggering revalidation.
- Committed on master.

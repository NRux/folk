# Stage 02 — Platform & content migration

You are executing stage 02 of an 8-stage autonomous build of the Folkly autonomous publishing
platform, in the git repository at the current working directory (branch master).

Authoritative spec: read `docs/TODOs/Folkly_Autonomous_Publishing_Codex_Prompt.txt` IN FULL
first. It is binding for all stages. Read `docs/TODOs/00-BUILD-README.md` for the series
protocol. Read `docs/preservation/` (the stage 01 baseline) before touching content.
Confirm in `docs/TODOs/BUILD-STATE.md` that Stage 01 is DONE; if it is BLOCKED, stop and
report rather than proceeding on an unverified baseline.

Hard rules for every stage:
- Work only inside this repository (and, where the spec allows, the live Folkly site).
  Never push to any remote other than the existing one, and never add new remotes.
- Keep secrets out of the repository. Do not commit console logs (build-logs/ is gitignored).
- Commit your work on master when the stage's exit criteria are met.
- If you are blocked by a missing credential, plugin connection, or unsupported platform
  capability you cannot obtain yourself: do NOT fake success and do NOT weaken a gate.
  Write the stage status file as BLOCKED with the precise reason, commit that, and stop.

Stage exit protocol (mandatory, in this order):
1. Write `docs/TODOs/build-logs/stage-02-platform-migration.status` containing exactly one
   line: `DONE` or `BLOCKED: <one-line reason>`.
2. Update ONLY the "Stage 02" section in `docs/TODOs/BUILD-STATE.md`.
3. Commit everything (`stage-02: platform, content layer, idempotent migration`).

## Objective

Give Folkly a server runtime and a durable content layer, and migrate all existing content
into it idempotently, WITHOUT changing what readers see. Routine article publication must
eventually update content records without committing generated prose to git and redeploying
the whole site (spec section 6) — this stage builds that foundation.

## Work

1. Read master spec sections 2 and 6 carefully.
2. Choose the platform path based on what THIS environment actually supports — verify before
   assuming:
   - If ChatGPT Sites tools are available: use Sites-backed persistence (D1 for structured
     records, R2 for image assets, where supported) following the installed Sites building,
     hosting, and persistence instructions, on the SAME Sites project. Do not create a
     replacement Site.
   - Otherwise: build the equivalent architecture locally runnable: a server runtime
     (pick a lightweight one; justify it in `docs/platform/ARCHITECTURE.md`) + a SQLite
     content database as the D1 stand-in behind a thin adapter (so real D1/R2 bindings can
     be swapped in later without rewriting content code) + a local asset store as the R2
     stand-in. State precisely in ARCHITECTURE.md which components are real and which are
     stand-ins, and what would change when deploying to the real Sites project.
3. Define the durable entities per spec section 6: personas and persona versions; pitches;
   assignments; articles and immutable article versions; sources; claim citations; media
   assets and licenses; editorial checks; publication slots; jobs and step attempts;
   settings; append-only audit events. Stable identifiers, explicit relationships, retained
   old versions and correction history.
4. Migrate ALL existing content into the content layer: the four articles, the perspective
   page, the about page, the homepage composition, every image (stored asset + metadata),
   all credits, bylines, labels, and reading times. The migration must be idempotent —
   running it a second time must change nothing. Preserve existing historical bylines.
5. Serve the site from the new runtime so every baseline route renders content matching the
   stage 01 captures: `/`, `/perspective`, `/about`, each article as BOTH `/<slug>` and
   `/<slug>.html`, and every asset URL under `/assets/`. Compare rendered output against
   the captures and record the comparison.
6. Write `docs/platform/ARCHITECTURE.md`: text component diagram, data model, real-vs-stand-in
   table, how publication will update content without git redeploys, and the migration
   procedure (idempotent re-run).

## Exit criteria

- The server runs from a clean checkout (documented start command in ARCHITECTURE.md).
- Fetching every baseline route from the new runtime matches the stage 01 captures; the
  comparison (routes, content diffs, credits preserved) is recorded in
  `docs/verification/stage-02-url-check.md`.
- Migration re-run demonstrated idempotent (noted in the url-check file with evidence).
- Acceptance case 1 (spec section 8) satisfied against the new runtime.
- Committed on master.

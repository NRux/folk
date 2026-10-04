# Stage 07 — Acceptance verification & seeding

You are executing stage 07 of an 8-stage autonomous build of the Folkly autonomous publishing
platform, in the git repository at the current working directory (branch master).

Authoritative spec: read `docs/TODOs/Folkly_Autonomous_Publishing_Codex_Prompt.txt` IN FULL
first. It is binding for all stages. Read `docs/TODOs/00-BUILD-README.md` for the series
protocol. Confirm in `docs/TODOs/BUILD-STATE.md` that Stages 01–06 are DONE (a BLOCKED
stage must be reported in your report with the workaround or gap it leaves).

Hard rules for every stage:
- Work only inside this repository (and, where the spec allows, the live Folkly site).
  Never push to any remote other than the existing one, and never add new remotes.
- Keep secrets out of the repository. Do not commit console logs (build-logs/ is gitignored).
- Commit your work on master when the stage's exit criteria are met.
- If you are blocked by a missing credential, plugin connection, or unsupported platform
  capability you cannot obtain yourself: do NOT fake success and do NOT weaken a gate.
  Write the stage status file as BLOCKED with the precise reason, commit that, and stop.
- This stage runs tests — it must not depend on any human in the loop, and it must not
  publish real content beyond the seeded calendar/reserve.

Stage exit protocol (mandatory, in this order):
1. Write `docs/TODOs/build-logs/stage-07-acceptance-verify.status` containing exactly one
   line: `DONE` or `BLOCKED: <one-line reason>`.
2. Update ONLY the "Stage 07" section in `docs/TODOs/BUILD-STATE.md`.
3. Commit everything (`stage-07: acceptance test suite, calendar seed, reserve fill`).

## Objective

Turn spec section 8's acceptance cases into a meaningful, repeatable integration test
suite, run it, and seed the real editorial calendar and reserve through the real pipeline.

## Work

1. Read master spec section 8 IN FULL.
2. Build the integration test suite (automated, rerunnable, isolated from real
   publication slots for destructive tests) covering ALL eleven acceptance cases:
   1. Existing article URLs — both extensionless and .html forms — resolve or redirect
      correctly with content and credits preserved.
   2. All five authors have distinct editable profiles and materially different voice
      samples.
   3. A real researched article moves through the full pipeline with claim-linked
      sources, valid image permissions, and accurate disclosure.
   4. An unattended run writes using its intended production credentials; a separate
      readback confirms the stored content and status with no browser session dependency.
   5. The configured schedule targets 7:00 a.m. Pacific on both sides of
      daylight-saving changes.
   6. Two simultaneous publisher invocations produce only one article for the date.
   7. A timeout after publication cannot cause a duplicate on retry.
   8. Unsupported claims and uncleared images prevent publication and trigger reserve
      selection.
   9. Pause, budget exhaustion, provider failure, empty reserve, expired authorization,
      and missed schedules produce accurate recoverable states.
   10. Anonymous or non-owner callers cannot modify content or read private editorial
      records; preview drafts never leak through reader APIs, feeds, metadata, or caches.
   11. Mobile reading and navigation work; restored versions, owner edits, and
      correction notes behave correctly.
   Use fixtures for destructive failure tests. For initial verification, use a legitimate
   new article and REUSE it rather than creating duplicate test posts. Do not publish a
   batch of reserve articles, and do not backdate any article.
3. Run the full suite; record every case's result with evidence in
   `docs/verification/acceptance-report.md` (case, method, evidence path, result).
   Any failing case is a BLOCKED stage with the precise reason.
4. Seed the editorial calendar with researched pitches (via the real pipeline's pitch
   stage, meeting the diversity and scoring rules of spec section 3) and populate the
   reserve through the REAL pipeline to at least seven finished, validated evergreen
   features (stage 04's seed article is the first). Verify the seed article: legitimate
   new article, not a stub, not a duplicate of existing content.
5. Record the post-seed state (reserve count, next-eligible slot, persona/theme balance
   for the coming 30 days, spend) in the acceptance report.

## Exit criteria

- Test suite exists, is rerunnable from a clean checkout, and covers all 11 cases.
- `docs/verification/acceptance-report.md` shows all 11 cases PASS with evidence (or the
  stage is BLOCKED with the precise failing case(s)).
- Calendar seeded; reserve ≥ 7 through the real pipeline; no duplicate/backdated posts.
- Committed on master.

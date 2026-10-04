# Stage 01 — Inspect & preserve

You are executing stage 01 of an 8-stage autonomous build of the Folkly autonomous publishing
platform, in the git repository at the current working directory (branch master).

Authoritative spec: read `docs/TODOs/Folkly_Autonomous_Publishing_Codex_Prompt.txt` IN FULL
first. It is binding for all stages. Read `docs/TODOs/00-BUILD-README.md` for the series
protocol. The other stage prompts in docs/TODOs/ are your siblings — do not perform their work.

Hard rules for every stage:
- Work only inside this repository (and, where the spec allows, the live Folkly site).
  Never push to any remote other than the existing one, and never add new remotes.
- Keep secrets out of the repository. Do not commit console logs (build-logs/ is gitignored).
- Commit your work on master when the stage's exit criteria are met.
- If you are blocked by a missing credential, plugin connection, or unsupported platform
  capability you cannot obtain yourself: do NOT fake success and do NOT weaken a gate.
  Write the stage status file as BLOCKED with the precise reason, commit that, and stop.

Stage exit protocol (mandatory, in this order):
1. Write `docs/TODOs/build-logs/stage-01-inspect-preserve.status` containing exactly one line:
   `DONE` or `BLOCKED: <one-line reason>`.
2. Update ONLY the "Stage 01" section in `docs/TODOs/BUILD-STATE.md` (status, evidence paths, notes).
3. Commit everything (`stage-01: inspect & preserve baseline`).

## Objective

Establish the authoritative baseline of the existing Folkly site so every later stage can prove
it preserved the site. This stage changes NOTHING on the live site and ships no new features.

## Work

1. Read master spec sections 1 (project and editorial direction) and 8 (acceptance case 1)
   especially carefully.
2. Inspect the live site at https://folkly-journal.nrapp.chatgpt.site. For the homepage, the
   perspective page, the about page, and every article page, capture:
   - exact routes (note: live routes are extensionless with .html variants, e.g.
     /new-orleans-second-line and /new-orleans-second-line.html must be checked), title,
     meta description, canonical URL, and any structured data (JSON-LD);
   - the full visible text of each article including section headings, source footers, and
     disclosure text;
   - bylines, place/category labels, reading times, image URLs, image alt text and credit
     text, and any license information shown on the page;
   - the complete asset inventory (every referenced image and other asset);
   - the homepage layout structure (cover story, "Elsewhere in the journal", "Start with a
     place" index, perspective section).
3. If this execution environment has ChatGPT Sites tools (Sites read / hosting metadata):
   reopen Site project `appgprj_6abfc9a424f881918070e39a237ecc83`, record its current
   authoritative source structure, hosting configuration (e.g. .openai/hosting.json), and
   metadata, and note any divergence from the public HTTP capture. If Sites tools are NOT
   available in this environment, state that precisely and proceed with the HTTP capture as
   the baseline. Do not guess at Sites-side state you cannot see.
4. Write the baseline into the repository:
   - `docs/preservation/inventory.md` — every route (with .html variants), every asset, page
     structure, credits, observed metadata, and the known Sites project ID;
   - `docs/preservation/pages/<route-slug>.md` — full captured text of each live page
     (homepage, perspective, about, each article);
   - `docs/preservation/NOTES.md` — divergences found, open questions, and the preservation
     checklist for later stages (URLs, credits, image licenses, audience, tone, design,
     existing historical bylines).
5. Do NOT modify, rehost, redeploy, or take down anything on the live site.

## Exit criteria

- `docs/preservation/inventory.md` lists every live route (both forms) and every asset, and
  every page has a capture in `docs/preservation/pages/`.
- `docs/preservation/NOTES.md` states whether Sites tools were available in this environment.
- No changes made to the live site.
- Committed on master.

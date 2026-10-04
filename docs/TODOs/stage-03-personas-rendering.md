# Stage 03 — Editorial personas & rendering

You are executing stage 03 of an 8-stage autonomous build of the Folkly autonomous publishing
platform, in the git repository at the current working directory (branch master).

Authoritative spec: read `docs/TODOs/Folkly_Autonomous_Publishing_Codex_Prompt.txt` IN FULL
first. It is binding for all stages. Read `docs/TODOs/00-BUILD-README.md` for the series
protocol. Confirm in `docs/TODOs/BUILD-STATE.md` that Stages 01 and 02 are DONE before starting.

Hard rules for every stage:
- Work only inside this repository (and, where the spec allows, the live Folkly site).
  Never push to any remote other than the existing one, and never add new remotes.
- Keep secrets out of the repository. Do not commit console logs (build-logs/ is gitignored).
- Commit your work on master when the stage's exit criteria are met.
- If you are blocked by a missing credential, plugin connection, or unsupported platform
  capability you cannot obtain yourself: do NOT fake success and do NOT weaken a gate.
  Write the stage status file as BLOCKED with the precise reason, commit that, and stop.

Stage exit protocol (mandatory, in this order):
1. Write `docs/TODOs/build-logs/stage-03-personas-rendering.status` containing exactly one
   line: `DONE` or `BLOCKED: <one-line reason>`.
2. Update ONLY the "Stage 03" section in `docs/TODOs/BUILD-STATE.md`.
3. Commit everything (`stage-03: editorial personas, author pages, archives, metadata`).

## Objective

Implement the five editorial personas and the reader-facing magazine features around them,
exactly per spec sections 2 and 5.

## Work

1. Read master spec section 2 IN FULL. The persona definitions are binding: beat, central
   question, voice, story structure, research emphasis, blind spot to counter, style
   specimen, and illustrative pitches for each of the five personas (Mira Sol, Ellis Reed,
   Lena March, Rowan Pike, Sasha Wren). Do not paraphrase them loosely — encode them.
2. Data model + records: persistent author profiles for all five personas. Each has:
   a stable ID; a public bio (these are FICTIONAL AI editorial personas — do NOT invent
   degrees, employers, hometowns, ethnic identities, lived experience, awards, travels, or
   interviews for them); a versioned private writing brief (spec section 2 briefs are
   version 1); the style specimen (a voice specimen only — never a reported fact, and
   never to be recycled into published articles); subject tags; and recent assignment
   history.
3. Disclosure (mandatory, exact form): beside each author profile and on articles —
   "Written with AI using the [name] editorial persona; researched from the linked
   sources." Only claim human review when an authenticated person actually reviewed that
   version. No personal byline for the owner and no implied owner approval of unreviewed
   articles. Avatars: typographic initials or clearly illustrated avatars only — no
   fabricated headshots presented as real people.
4. Reader-facing features (spec section 5): author pages (persona's articles, bio,
   disclosure); archives by place and by topic; related-story links; new-article placement
   on the homepage; keep the current cover-story style while allowing a growing archive.
5. Metadata & SEO: proper metadata, canonical URLs based on the actual live domain, Article
   structured data without fake credentials or review claims, accurate reading time,
   publication date, place/category labels. Keep private-site access for every route,
   asset, feed, and API; only enable public indexing or feeds when compatible with the
   owner's access settings.
6. Preserve Folkly's magazine character (spec section 1): strong typography, large
   photography, clear editorial hierarchy, restrained color, generous reading layouts,
   accessible mobile behavior. The reader-facing site stays a magazine; the control room
   is stage 05.
7. Preserve existing historical bylines from the migrated content.

## Exit criteria

- All five author pages render with distinct, editable (data-model level; admin UI is
  stage 05) profiles, versioned briefs, materially different voice samples, subject tags,
  and assignment history.
- The exact AI disclosure string is present on author pages and on articles.
- Archives (place, topic) and related-story links work with the migrated content; homepage
  new-article placement works.
- Article structured data present and valid (no fabricated credentials/review claims).
- Acceptance case 2 (spec section 8) satisfied; evidence in
  `docs/verification/stage-03-personas.md`.
- Committed on master.

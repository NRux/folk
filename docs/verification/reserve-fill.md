# Stage 07 reserve fill and pipeline audit

Date: 2026-10-07. Scope: local Node/SQLite editorial pipeline, not the live Site.

## Result

`node web/scripts/verify-reserve.js web/folkly.db` reports **7/7** eligible,
unpublished ready articles with no hard failures. Each has a version hash, five or
more retrieved pages, a linked claim ledger, deterministic checks, and an
independent review verdict of pass with no major or critical findings. The local
Ollama model recorded $0 metered provider cost; the normal $5/day and $100/month
reservation checks remained in force. Minor reviewer notes remain attached to
the versions and are carried in the portable bundle.

| Article | Persona | Sources | Claims | Words | Minor notes |
|---|---|---:|---:|---:|---:|
| Tokushima aizome | Mira Sol | 6 | 24 | 1,222 | 2 |
| Seoul kimjang | Lena March | 6 | 17 | 1,757 | 1 |
| Tarragona castells | Sasha Wren | 6 | 22 | 1,650 | 2 |
| Xochimilco chinampas | Rowan Pike | 5 | 17 | 1,351 | 2 |
| Dushanbe sumanak / Nowruz | Sasha Wren | 6 | 20 | 1,090 | 3 |
| Bonwire kente | Lena March | 6 | 20 | 975 | 2 |
| Matariki / Puanga | Rowan Pike | 6 | 27 | 1,227 | 3 |

The output bundle `web/data/reserve-seed.json` contains these ready versions,
source metadata, claim links, and minor review notes without fetched source excerpts,
provider credentials, or private audit history. It is marked unpublished. The
operational database remains gitignored and must be migrated with the Site runtime.

## Findings and changes

- Search ranking initially surfaced thin and secondary travel pages. The research
  layer now tries curated public URLs, fetches the underlying pages, and applies
  the same source, voice, claim, and review gates. Inaccessible pages were dropped.
- A resumed source-research checkpoint could skip the source gate. It now rechecks
  the persisted dossier. An explicit refresh invalidates stale research before a
  new fetch. Exact original-script names are retained for source-voice matching.
- Reviewer responses sometimes exceeded the model's output limit or confused
  an omitted source detail with a contradiction. The prompt now returns a concise
  JSON verdict with calibrated severities; the runner retries one malformed
  response under a fresh budget reservation. An incomplete response never passes.
- The replenisher previously stopped after one held pitch. It now records the
  hold, skips terminal and demonstration pitches, and continues the queue.
  Pitch rows reconcile direct owner-run outcomes.
- Manual editorial repairs removed source-close wording, corrected chronology
  and attribution, and kept each changed article held until a new independent
  review. The three other researched candidates (Essaouira Gnaoua, Havana rumba,
  Lake Sebu T'nalak) remain in `needs-review`; no failed draft was promoted.
- Third-level headings are now rendered correctly in new drafts. A one-time
  heading normalization repaired two older ready versions and removed a duplicate
  source list where the resulting article stayed within the minimum length.

## Verification and boundary

Two consecutive local passes of `test-stage04-security.js`,
`test-stage05-admin.js`, `test-stage06-scheduler.js`, and
`test-stage07-reader.js` passed after the code changes. These cover source
fetch protections, owner authorization and sanitization, scheduler concurrency
and retries, and reader draft isolation. `verify-reserve.js` passed after the
editorial repairs and heading normalization.

The live Site is a separate static source. It has no D1-backed Worker publisher,
authenticated job endpoint, configured production model, or linked schedule.
There has been no live write/readback, deployed authorization audit, mobile
viewport acceptance, or automated publication. Stage 07 remains BLOCKED on those
cases; Stage 08 activation is pending. The earliest unexpired local slot is
2026-10-07, but it is not a configured launch date.

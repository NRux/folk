# Stage 04 Verification - Pipeline run, gates, calendar

Date: 2026-10-06T21:26:23.365Z

Execution notes: verified against a disposable copy of the local development database. The Tokushima seed is a real completed pitch-to-ready run. The unsupported-claim fixture resumes its saved verification checkpoint. The image-rights fixture reuses the verified seed dossier in an isolated editorial-revision checkpoint, then exercises image-clearance through the needs-review hold; neither fixture receives a publication slot.

Reproduction: seed pitches; run Tokushima to ready; prepare the image-rights fixture; run the two gate demos; run this verifier.

Total checks: 29, passed: 29, failed: 0

| Check | Result | Detail |
|---|---|---|
| A1 seed article exists | PASS | tokushima-aizome |
| A2 seed article reached 'ready' | PASS | state=ready |
| A3 >=5 substantive sources | PASS | 6 sources |
| A4 >=3 independent publishers | PASS | japan.travel, shikoku-tourism.com, jatravi.com, setouchi.travel, lg.jp, tokushima.jp |
| A5 >=2 primary/local/scholarly/institutional/practitioner | PASS | 3 strong |
| A6 retrieved-page evidence stored (excerpts) | PASS | 6/6 with excerpts |
| A7 claim ledger with source links | PASS | 24/24 claims linked to sources |
| A8 word count in band (900-2200) | PASS | 1607 words |
| A9 all citations resolve to listed sources | PASS | citations: 5,4,1,2,3,6 |
| A10 image clearance outcome valid | PASS | typographic treatment (no figure) |
| A15 mandatory AI, sourcing, and no-firsthand-experience disclosure | PASS | Every story is researched from the linked sources. The writing is done by an AI editorial persona in the journal's voice; it carries no firsthand experience of the place. |
| A15b claim citations resolve to persisted source IDs | PASS | 24 claim records / 6 sources |
| A16 deterministic checks recorded (schema/links/fields) | PASS | word_count, sources_present, citations_resolve, links_valid, required_fields, reading_time, no_em_dashes, numeric_claims_supported, mandatory_disclosure |
| B11 unsupported-claim gate fixture exists | PASS | kumasi-kente-fixture |
| B12 unsupported-claim gate: did NOT reach ready | PASS | state=needs-review |
| B13 unsupported-claim gate: held for the intended gate | PASS | state=needs-review hold_reason=gates failed [source-rules, unsupported-claim] attempts=0 |
| B14 unsupported-claim gate: ready reserve candidate selected | PASS | 1 reserve selections |
| B21 image-rights gate fixture exists | PASS | image-rights-aizome-fixture |
| B22 image-rights gate: did NOT reach ready | PASS | state=needs-review |
| B23 image-rights gate: held for the intended gate | PASS | state=needs-review hold_reason=unresolved image rights: FIXTURE (stage-04 gate demo): candidate image found but license could not be verified from its  |
| B24 image-rights gate: ready reserve candidate selected | PASS | 1 reserve selections |
| C1 every transition has actor + reason | PASS | 21 transitions |
| C2 fixture 1 trail has actor + reason on all transitions | PASS | 11 transitions |
| C3 fixture 2 trail has actor + reason on all transitions | PASS | 2 transitions |
| D1 spend ledger has entries | PASS | 37 entries, 0.0000 USD total |
| D2 per-article cost tracked | PASS | dakar-griot-fixture:4, image-rights-aizome-fixture:1, kumasi-kente-fixture:8, tokushima-aizome:24 |
| D3 per-run usage tracked | PASS | 5 runs |
| E1 pipeline jobs recorded | PASS | done,needs-review,needs-review,error,error,needs-review,error,error,withdrawn,error,error,withdrawn,error,needs-review,needs-review,withdrawn |
| E2 step records persisted (resumable checkpoints) | PASS | 73 steps |

Overall: ALL PASS


# Xochimilco physical-description clarification — October 8, 2026

The published article opening now calls chinampas raised fields surrounded by canals and explains that they are fixed plots, with edges secured by stakes and trees, rather than floating rafts. The exported deck and raw description use the same physical description. Build-generated search summaries already avoided the old wording.

## Source check

FAO's GIAHS overview uses “floating artificial islands,” but its detailed construction section describes wetland raised fields built from lake-bottom sediments, branches and vegetation, with a structure around stakes. The original wording followed that overview; this revision resolves its ambiguity rather than claiming FAO never used the term.

UNAM's *Anales del Instituto de Biología* discussion, *Chinampas y almácigos flotantes*, explicitly distinguishes secured cultivation fields from floating seedbeds. It appears in the 1937 journal issue; the online record is dated 2017. This reference is added as source 6 and linked from the revised opening. No translation is presented as a direct quotation.

- [FAO: Chinampas Agricultural System](https://www.fao.org/giahs/giahs-around-the-world/mexico-chinampas-agricultural-system/en)
- [UNAM: Chinampas y almácigos flotantes](https://anales.ib.unam.mx/index.php/anales/es_MX/article/view/335)

## Preservation and scope

A before/after comparison confirms every paragraph from “A Heritage of Resilience” onward and all five existing source entries are unchanged, apart from appending source 6. Photos, credits, licenses, routes, publication dates, and bylines remain intact. The manual-release manifest retains the original approved content/evidence hashes; [revision hashes](xochimilco-editorial-revision-2026-10-08.json) record the revised public export separately. Private source records and reserve bundles are not rewritten. A later migration must reconcile this public revision against the historical source version instead of overwriting it with that older version.

Other claims about soil degradation, farmer counts, restoration outcomes, economic conditions, and dates remain separate review tasks. This is a physical-description correction, not a completed fact check of the entire essay. No new article, model call, database operation, hosting configuration, or autonomous switch change is included.

## Verification

Focused checks verified that generated HTML no longer contains “floating artificial islands,” the revised opening links to its unique source-6 anchor, the new external reference has safe link attributes, and the responsive image and seven-entry historical release manifest are retained. The later body/source comparison passed. Deployed readback is pending; this report does not claim the live site already serves the correction.

`npm run build` passed for 73 public routes. `npm test` passed the full regression suite, including private-output exclusion, authentication, scoped publisher/no-spend guards, RLS fixtures, public article preservation, discovery, and responsive images. Mocked failure diagnostics are expected; no hosted database/model/Google calls ran.

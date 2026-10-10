# Owner saved-version browsing — 2026-10-10 UTC

## Story and finding

An authenticated owner selects an editorial article, opens its latest saved body,
and selects an older private version through the owner workspace. The existing
reader always selected only the latest version, while the dashboard hard-coded
migration as pending despite the verified transfer. The available browser owner
session has expired, so the full authenticated hosted viewing gate is still open.

## Implementation

- The existing protected workspace GET accepts an optional positive version number
  with an article ID. Missing article selection, invalid/duplicate parameters and
  unknown draft query fields return 400 after authorization. Missing article/version
  returns a fixed 404; storage/corrupt-content errors return a fixed 503.
- History reads only metadata, capped at 100 rows with an overflow sentinel. Duplicate
  identity/version numbers, invalid dates and malformed metadata fail closed. One
  selected body is bound to the same article/version ID and stable version metadata;
  a private reference resolves through the existing hash/size/path-checking Blob store.
  Compatibility SQL JSON remains supported. No body from another version is returned.
- Protected responses carry no-store; anonymous/non-owner/revoked access is checked
  before selection or private storage. Private SDK messages are not returned.
- Preview now has a saved-version selector, loading state, article status and private
  historical-content note. Bodies use textContent, not innerHTML. A selection token
  discards late cross-article/version responses. Logout/expiry clears the preview and
  controls; keyboard focus returns to the version selector after changing it.
- Dashboard reads a bounded verified import receipt and returns only validated
  aggregate status text. Absent receipt and unavailable/malformed receipt differ.
  Private extra fields and raw errors do not reach the dashboard. Publication remains
  locked regardless of this import status. Updated shell copy reflects saved versions.

## Evidence

All 36 regression commands and the 73-page/11-story build passed. Focused checks
cover latest/older published-story history, exact selection, single-body reads,
missing/corrupt content, metadata overflow/duplicates, malformed/duplicate inputs,
owner-first denial, no-store and sanitized errors. Client fixtures cover actual
selection/progress, text-only payload rendering, retained keyboard focus, out-of-order
responses and logout clearing. Actual-shell integration checks all owner controls.
Dashboard fixtures cover verified/absent/unavailable receipt states and redaction.

Read-only hosted Supabase inventory confirms 11 articles, 15 versions/references,
zero unpublished articles and all three switches false. Source-import byte-exact
hosted evidence remains in hosted-editorial-import-2026-10-09.md. The native browser
shows “Your owner session expired or is no longer active,” not a signed-in preview.
These fixtures and private inventory checks do not establish actual authenticated
API/Blob/UI viewing. No source body, credential or subscriber was exported here.

## Designer handoff and remaining gate

The requested redesign brief is docs/design/OWNER-PANEL-REDESIGN-HANDOFF.md. It maps
navigation and workflows to current functionality, covers responsive/accessibility
and error/unsaved/spending states, and separates future controls from existing APIs.
Repository references resolve. No redesign is implied by this functional change.

Next acceptance requires a fresh owner session through secure browser authentication
and visible private latest/older-version readback. No new source export, provider
secret or Vercel connector is required for that step. Full isolated hosted
publisher/newsletter/provider outage/restore and language acceptance remain separate.
No schema, source data, public story, credits, model budget, paid provider job,
newsletter or autonomous production/publication/article schedule setting changed.

## Deployed shell and private-route readback

Implementation and designer brief commit [a9b2920](https://github.com/NRux/folk/commit/a9b2920fd19e8b22d7319450b7f15b6a6cd3febb) synced to main/master.
[Vercel deployment](https://vercel.com/optagens-projects/folk/3YNuJVe57zx9JUpxgkH4q1myH56Y)
reported success. Fresh production `/owner` and `/owner-workspace.js` returned 200;
the shell has the new version navigation/preview copy and the script matches the
verified source exactly. Anonymous workspace GET and article/version GET both
returned 401/no-store. A final independent SQL check confirms all three article
switches false. These checks establish deployed assets/private denial, not a
signed-in version read. The session-expiry limitation above remains.

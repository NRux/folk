# Owner newsletter readiness and upcoming digest

Date: 2026-10-10 UTC. Existing NRux/folk repository, Vercel project and storage.
No outgoing email, paid provider call, subscriber/private record write, schema
change, translation approval/release or activation.

## Resolved signing-secret prerequisite

After Noah configured `NEWSLETTER_SECRET` in the existing production environment,
live GET `/api/unsubscribe?token=invalid` returned **400**, `Cache-Control: no-store`
and `Invalid unsubscribe link`. Previously it returned 503 before token validation.
The configured signing guard now passes; no value was inspected or exposed. No
valid/signed link or unsubscribe POST was exercised. Anonymous newsletter GET
remains 401/no-store. This is configuration-prerequisite evidence, not proof of
signed-link verification, persistence, provider acceptance or mailbox delivery.

## Implementation

- Added GET-only `/api/owner-newsletter`, reusing the existing verified identity,
  private owner membership and live-session checks. No authorization bypass,
  service grant, send action, arbitrary preview date or mutation endpoint exists.
- Shared delivery/preview configuration returns only fixed missing-variable names
  to the owner. Actual sender, mailing address, key, connection and signing values
  never enter its response. `deliveryEnabled` reports the setting truthfully;
  configured settings do not imply hosted acceptance or verified credentials.
- Shared catalog loader bounds entries/file size and validates unique public
  routed slugs, exact article route targets, calendar dates, titles and summaries.
  It selects only allowed public fields; drafts, unregistered routes, private
  evidence and subscriber records never reach the preview.
- Upcoming preview uses the strictly next Friday 16:00 UTC run and the worker's
  completed UTC calendar-day selection. Friday stories wait until the next digest.
  Links and subject/body can be inspected without real recipient/signing/address
  data; the body uses explicit placeholders. Empty weeks remain unsent.
- Added Weekly newsletter controls inside Subscribers: readiness, refresh,
  upcoming run/window, story links, empty/unavailable states and expandable plain
  email text. Text renders with `textContent`; links use the fixed public origin.
  Each refresh replaces the prior request, and old responses cannot overwrite
  newer selection or restore private UI after sign-out/expiry. An already-rendered
  session also loads immediately when the deferred script starts after sign-in; a
  separate startup regression covers the missed-event timing case.
- Explicit Vercel function catalog inclusion and static client asset copying ensure
  deployment contains the API inputs and actual UI script. The existing weekly
  cron is unchanged. No delivery/autonomous setting is altered.

## Checks

`npm run build` PASS: 73 public pages/11 existing published stories. All **38**
`npm test` commands pass with the concurrent translation drafts present. The new
suite exercises actual protected-handler and client code using injected fixtures,
without provider, private Blob or live subscriber calls.

| Check | Evidence |
| --- | --- |
| Missing/invalid configuration | Fixed field names, newline sender denial and short signing-key guard; no environment value returned. |
| Anonymous, non-owner, revoked session, wrong method/query, auth outage | Denied before public catalog reads; every result is no-store with sanitized messages. |
| Next Friday before/at/after boundary and DST week | Exact UTC run/date range; Friday date-only stories deferred consistently with delivery. |
| Public/routed selection | Private drafts, unrouted stories and extra private fields excluded; corrupt/duplicate/date/route input fails closed. |
| Empty week / catalog outage | Empty unsent preview; catalog failure does not falsely erase or validate configuration. |
| Real HTML and client assets | Control IDs, copied script and explicit function input inclusion pass. |
| Client rendering / progress / links | Safe literal text, fixed public links, refresh progress and subject/body preview pass. |
| Response ordering / sign-out / expiry / startup | Earlier response cannot replace later preview; sign-out clears content; 401 invokes secure reauthentication; a late-starting script detects an already-rendered session. |
| Regression | Existing auth/RLS, private versions/import, subscriber suppression/claims, translation/batch budgets, public stories/credits and consent checks pass. |

Read-only native Supabase check confirms `production.autonomous_enabled`,
`publication.autonomous_enabled` and `schedule.enabled` remain `false`.
The actual owner browser was inspected and still displays an expired-session
notice. No authenticated browser flow is claimed passed or replaced by mocks.
Concurrent translation draft files/manifest were retained; this work approves
none and includes no translation file in its commit scope.

## Deployment and remaining gates

Feature commit `bd0c4827c6f7f668326ce11316a4f7fd367ad1b6` was synced to main/master
with expected-SHA leases on top of concurrent translation drafts. Vercel reported
success for https://vercel.com/optagens-projects/folk/7LyxYpLaUUbhC67GGS4gsCH5Boxw.
Anonymous preview GET, including a caller-supplied run date, returns 401/no-store
before exposing readiness; invalid unsubscribe is 400/no-store; unauthenticated
cron is 401/no-store. All 45 deployed public reader checks pass, including exact
article bodies/credits. Aggregate GET evidence: [public checks](owner-newsletter-public-2026-10-10.json).
The final startup-timing fix passes build and the expanded owner-newsletter suite;
its deployed asset readback is checked separately after sync. Existing source
recovery, import and signing-secret setup do not need to be repeated.
Vercel connector inspection and Google Cloud setup remain deferred.

Fresh secure owner sign-in is needed to inspect actual private readiness and
preview. An explicitly isolated consenting recipient must then establish hosted
subscriber/suppression/claim/receipt readback, provider/mailbox acceptance, retry
denial and interruption/restore evidence without mailing the production list.
Configuration presence is not provider credential validation. Full deployed
acceptance and applicable owner authorization precede delivery or autonomous
production/publication/article schedule activation. See the
[newsletter runbook](../platform/NEWSLETTER.md).

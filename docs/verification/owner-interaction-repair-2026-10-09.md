# Owner interaction initialization repair

## Cause

The deployed owner script registered subscriber paging handlers against
`owner-subscriber-next` and `owner-subscriber-first`, but the owner HTML omitted
the entire subscriber panel. The first null-element access aborted script
initialization before sign-in, sign-out, refresh and the initial session read.
Workspace controls depended on that session event and consequently stayed
inactive. This was a frontend integration defect, not the publication lock.

The earlier test DOM invented an element for every requested ID. It concealed
the mismatch between the delivered HTML and JavaScript.

## Repair

- Added the private subscriber panel, list, paging buttons and navigation link
  expected by the existing script and authenticated paging API.
- Changed the owner client regression to derive elements from the actual HTML
  and return null for missing elements. All three owner scripts are checked
  against that shell.
- Verified attached sign-in, refresh, sign-out and subscriber handlers, successful
  authenticated rendering, subscriber read completion and logout clearing.

## Evidence and limits

The new regression failed before the repair with
`owner.js requires missing HTML element owner-subscriber-next` and passed after.
Offline build passed with 72 public pages. Focused owner authentication,
dashboard, response-race, workspace server/client, subscriber inbox, translation
UI and Vercel route/security checks passed. These cover anonymous/revoked denial,
same-origin writes, bounded data, replay/conflict protection and private state
clearing; they used fixtures and did not send email or call a paid model.

The public owner shell and scripts matched GitHub main before the repair.
An authenticated hosted chat, idea write or private draft read is not claimed:
the available browser had no owner session. Provider activation and content
migration remain separate runtime dependencies. No credentials were changed,
no private records were written, and autonomous production/publication/schedule
controls remain off.

# Runtime log investigation: 2026-10-09 UTC

## Supplied evidence

Reviewed all 98 supplied JSONL records for 2026-10-08T04:51:00Z through
2026-10-09T04:51:00Z from the existing Folkly project. No secret/request bodies,
raw customer data or full log dump is copied into the public repository.

| Status | Count | Interpretation |
| --- | ---: | --- |
| 200 | 75 | Successful requests: 63 owner status reads, 10 owner POSTs, one contact submission, one subscription. |
| 401 | 21 | Sign-in required: 14 owner status reads, three workspace reads, two translation reads, one translation POST, one newsletter read. |
| 403 | 1 | Translation POST origin rejection. |
| 400 | 1 | Contact input rejection; supplied log does not identify the invalid field. |
| 429 / 5xx | 0 | No rate-limit or server-failure record in this export. |

The translation origin/auth denials and newsletter 401 at approximately
2026-10-09T03:34Z match the intentionally negative checks already recorded in
translation-pilot-runtime-live-2026-10-09.json. The most recent anonymous
translation GET matches the public boundary check in the archive-localization
report. These are successful access-control checks, not evidence of a broken
provider or missing secret. Do not replace denial statuses with 200 or weaken
owner membership, origin or newsletter authorization.

The owner session at approximately 2026-10-09T00:07Z shows minute-by-minute
successful status polls followed by 401 about 919 seconds after the last
successful owner POST. This is consistent with the existing cookie lifetime
capped at 900 seconds and a subsequent 60-second poll. HTTP statuses alone do
not prove which POST established the cookie or whether every other 401 represents
expiry, logout, anonymous access or revocation. No live owner session was created.

## Confirmed UI defect and fix

A 401 on an already signed-in dashboard used to hide its panels without setting
an expiry notice; translations could also clear themselves and silently return
to the sign-in screen. A shared expireOwnerSession handler now clears the
private dashboard, child panels, code field and cursors and displays:

> Your owner session expired or is no longer active. Request a new sign-in code to continue.

Dashboard polling, manual refresh, contact/subscriber pagination, editor workspace
and private translation endpoints all use that transition. Initial anonymous
page load remains the normal sign-in screen. Polls stop while signed out; late
responses cannot restore private UI. The short HttpOnly/Secure/SameSite cookie,
verified owner membership/session revocation and CSRF boundaries are preserved.
No session lifetime, refresh-token flow, Supabase configuration, provider setting,
subscriber storage or article switch was changed.

## Verification

- Build: PASS, 72 public pages, 11 stories, publisher disabled.
- Focused owner auth, late-response, workspace-client and translation UI tests:
  PASS; expiry notice, private/code clearing, neutral anonymous load, stopped polls,
  refresh feedback, auth/origin denial and revoked-session rejection.
- `npm test`: PASS, all 31 regression commands, including new automatic/manual
  expiry tests, workspace and translation 401 propagation, late-response isolation,
  authenticated server denial, newsletter/contact/subscriber and privacy tests.
- Deployment: PASS, implementation commit `96f920be5164a4e462ef9765d7f33ad41acf9be7`.
  GitHub reported Vercel deployment completed before syncing master. Three live
  owner JS assets match the tested build byte-for-byte; /owner returns 200 and
  anonymous owner/workspace/translation/newsletter APIs return expected 401.
  Eight HTTP checks are recorded in runtime-log-triage-live-2026-10-09.json.
  Authenticated browser expiry is covered by controlled client fixtures, not a
  newly created live owner session.
- Supabase changelog index and current session documentation were reviewed; no
  Supabase API/schema/dependency change was necessary. Reference:
  https://supabase.com/docs/guides/auth/sessions

## Limits and action

This export contains no response bodies, so it cannot identify the contact form's
invalid field or distinguish anonymous from revoked sessions for each 401.
Valid contact and subscription requests succeeded. No new owner credential or
connection action is needed for this frontend fix. Sign in again when the session
notice appears. Vercel connector inspection remains deferred; full hosted provider,
newsletter/recovery and original lossless source import gates remain separate.
No email, paid model call, translation release or article publication occurred.

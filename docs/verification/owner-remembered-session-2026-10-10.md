# Remembered owner sign-in verification, 2026-10-10 UTC

## Problem and change

The old owner cookie expired after 15 minutes and stored no renewal credential,
requiring another emailed code. The checked Keep me signed in choice now stores
an opaque Supabase renewal credential in a separate host-only Secure/HttpOnly/
SameSite=Strict cookie for 30 days, rotated by verified server-side refresh.
The short access cookie and server-only identity/membership/native-session checks
remain. Responses never contain credentials and are private/no-store.

Each private client preflights renewal without an OTP request. In-tab operations
share a promise; Web Locks serialize tabs when available. GET may recover once;
POST/private writes/paid actions are never replayed. Logout clears the pair even
on provider/configuration outage and retains existing global revocation. Browser
code stores only a freshness timestamp in memory, never tokens in localStorage.

## Evidence

- Build: 73 public pages, 11 preserved stories; unapproved translations stay private.
- npm test: all 41 commands pass, including existing authentication/workspace,
  newsletter, public/private-content and translation security regressions.
- scripts/test-owner-remember.mjs: checked/unchecked behavior, 30-day host-cookie
  flags, no JSON credential leakage, rotation, duplicate-cookie/origin denial,
  membership/session revocation, outage retention, refresh-only logout, shared
  preflight, old-response/logout denial, one GET recovery and zero POST replay.
- Native read-only inventory: 11 articles, 15 versions and 15 content-object refs;
  production.autonomous_enabled, publication.autonomous_enabled and schedule.enabled
  are all false. No schema or policy change was necessary.
- Privacy policy explains the essential remembered cookie and sign-out.

Supabase session/refresh documentation was checked on October 10, 2026:
https://supabase.com/docs/guides/auth/sessions
https://supabase.com/docs/reference/javascript/auth-refreshsession
https://supabase.com/docs/guides/auth/server-side/advanced-guide
Server-only SDK clients are request-scoped; built-in Auth transport retry behavior
is separate from the no-replay rule for paid application operations.

## Remaining hosted acceptance

One fresh owner OTP sign-in with Keep me signed in checked is necessary: old
sessions did not contain a renewal credential. Close/reopen the browser, revisit
/owner after the access cookie expires, verify private panels load without another
email, then verify sign-out and provider revocation deny access. Fixture results
are not evidence that Noah completed this live authenticated sequence. Provider
account policies or browser cookie clearing can require another code sooner.
No live owner credentials were generated, copied or published for these checks.

## Public deployment follow-up

Code c46c392920b55588f6ab86672662b5a81c721992 passed Vercel and is live on
https://www.folkly.com. All 45 reader checks pass, including all 11 byte-exact
article pages, both URL forms, credits and private-route exclusion. Eleven added
public checks verify exact deployed session/test script bytes, visible owner
controls, essential-cookie disclosure, anonymous mail/status/worker denial and
no-store headers. Anonymous same-origin refresh returns 401 and clears both host
cookies with Secure/HttpOnly/SameSite=Strict/Path=/; wrong Origin returns 403.
Anonymous test-mail POST returns 401, so no provider request was made.

The actual owner browser was reloaded and visibly shows the checked Keep me signed
in control, but has no current authenticated session. Fresh login, 15-minute/browser
restart renewal and revocation acceptance still require the owner's real sign-in;
no test credential or OTP was created. Actual provider/mailbox acceptance remains
open until the explicit Subscribers test and mailbox attestation. No email sent.
Evidence: owner-session-newsletter-public-2026-10-10.json.

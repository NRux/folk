# Stage 7 implementation plan

Updated 2026-10-07. Article generation, publication, and scheduling stay off
until all deployed acceptance gates pass. Preserve the four public stories and
seven private reviewed reserve stories and their source/evidence hashes.

## 1. Verified storage and owner authentication

First authorize the Folkly Supabase project in the plugin and match its URL to
Vercel's existing folk integration. Apply the prepared migration only there,
run hosted security/performance advisors, and import a verified snapshot.
Confirm counts, hashes, anonymous/non-owner denial, and all three switches false.

Implement invite-only Supabase Auth with email OTP, trusted redirect allowlist,
and server-managed secure HttpOnly/SameSite cookies. Use PKCE for link flows.
Provide login, callback, logout, and protected owner screens on Vercel.
Verify identity server-side and current folkly_owners membership on every request;
never trust user_metadata or browser session claims for authorization.
Require MFA for publishing/configuration actions, CSRF/origin checks on mutations,
no-store responses, and session revocation checks for sensitive actions.
Add Noah's verified Auth user ID through an audited server operation; no public
signup or self-service owner promotion. Keep service credentials server-only.

Acceptance: owner login/logout/expiry, revoked session, non-owner identity,
forged metadata, cross-origin mutations, and direct private API access tested
on an isolated hosted preview. Reader remains public and reserve stays private.

## 2. Unattended publisher and model provider

Port existing editorial gates and persisted jobs to Vercel Functions and
Supabase transactions. Give a separate publisher identity only narrow RPC rights
for claiming a daily slot, recording evidence, and committing approved content.
Do not reuse an owner session or grant a worker broad owner administration.
Authenticate triggers with a dedicated rotated secret; authenticate database
operations separately. A missing credential or disabled switch must fail closed.

Use a configurable server-side model adapter with explicit model ID, pinned SDK,
JSON-schema outputs, source provenance, timeouts, bounded retries, and per-job
token/dollar caps. Select the provider/model after a small private evaluation
against the five editorial personas and factual/source gates. Noah must connect
and fund the selected provider securely in Vercel before live calls.
Treat researched pages as untrusted data and reject unsupported claims.
Record provider/model, usage, evidence hashes, and gate results without secrets.

Claim a unique Pacific publication date transactionally with lease expiry,
idempotency key, and immutable job/version IDs. Independent readback must verify
stored and served content hashes before a job is marked complete. A timeout
must reconcile persisted state before retrying. Reserve fallback may consume
only reviewed items. Exhaustion stops publishing and reports the blocker.
Build a disabled trigger first; enable the 07:00 Pacific schedule only after
DST timing and the entire deployed acceptance suite pass.

## 3. Hosted recovery tests

Use a separate preview deployment and isolated test database with synthetic
fixtures. Never inject failures into public stories, real subscribers, or the
private reserve. Record deployment SHA, fixture IDs, timestamps, HTTP results,
database readback hashes, and cleanup evidence in the acceptance report.

| Scenario | Required result |
|---|---|
| Two simultaneous publishers | One date claim and one publication |
| Timeout after commit, then retry | Readback reconciles success without duplicate |
| Crash before commit or expired lease | Safe bounded recovery, no partial public article |
| Model 429/timeout/invalid output | Bounded retry, hard gates enforced, reserve policy respected |
| Database/credential outage | Fail closed, no false success or unintended publication |
| Missing reserve or rejected claim/image/music evidence | Stop or approved fallback, never bypass gates |
| Wrong owner or revoked worker secret | Denied and audited without private content disclosure |
| Public readback mismatch | Mark failure, prevent completion, recover verified version |
| Restore from backup | Counts/hashes restored; all three switches remain false |
| DST transition | Exactly one intended 07:00 Pacific date slot |

Run responsive reader checks once a working browser is available. Require two
clean focused debug/security passes and all acceptance cases on the deployed
Vercel/Supabase stack. Local PostgreSQL fixtures are supporting evidence only.

## Editorial presentation requirements

Keep photo captions to subject/place/date, linked photographer, and linked
license. Preserve original attribution records and crop information separately.
Music or singing articles require at least one named artist/recording and a
verified listening link from the artist, label, or cultural archive, plus a
brief listening cue. Check availability during editorial review. Do not host
copyrighted audio without permission; use click-to-play authorized embeds or
external listening links. No autoplay. Add this as a publisher acceptance gate
when the pipeline is ported, including reserve review before publication.

The public build now includes Noah's AdSense loader in every HTML head. AdSense
approval and Auto ads configuration are controlled in Google's dashboard.

References checked 2026-10-07:
- https://supabase.com/docs/guides/auth/server-side
- https://support.google.com/adsense/answer/9274634
- https://folkways.si.edu/new-orleans-brass-bands/jazz-african-american/music/album/smithsonian
- https://arquivosonoro.museudofado.pt/repertorios?search=am%C3%A1lia
- https://planetecommunications.bandcamp.com/track/bug-in-the-bassbin

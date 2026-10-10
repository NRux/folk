# Subscribers and weekly updates

## Current storage

`POST /api/subscribe` automatically validates, normalizes and stores email,
consent/version, signup timestamp and source in the connected **private Vercel
Blob store** at `subscribers/<sha256-of-normalized-email>.json`. The hash is a
pathname, not encryption: the JSON contains the actual address and must remain
private. There is no public subscriber-list endpoint. Existing signup records
are reused; no import, new database or loss of consent history is required.
The signup form alone does not send mail. Supabase Auth SMTP sends login emails;
it is not wired to this newsletter service.

The authenticated owner dashboard has a read-only Subscribers section. It reads
at most 20 private records per page, revalidates the owner session for each page,
and validates the matching suppression record before reporting status. It does not expose
Blob path hashes or unsubscribe tokens, and it cannot subscribe, unsubscribe,
delete or send to anyone. Any malformed record or incomplete storage read makes
the page unavailable instead of guessing at delivery status.

## Implemented delivery

Vercel cron invokes `/api/newsletter` on Fridays at **16:00 UTC** (09:00 Pacific
in daylight time, 08:00 Pacific in standard time). It includes published, routed
stories from the seven completed UTC calendar days before that Friday. Friday
stories wait until the following digest, so a date-only publication timestamp
cannot lose a story published after the run. Empty weeks produce no email.
A cron bearer secret is required; unauthenticated requests cannot send.
Newsletter delivery is a separate switch from autonomous article production,
publication and the article schedule, which remain disabled.

Private Blob lists are paginated and bounded before any delivery. The initial
worker supports up to 200 subscriber records; larger lists fail closed and need
queued/batched fanout rather than silently omitting readers. Private records are
read without cache; email/hash/consent, signup metadata, every page and cursor are
checked. Duplicate paths, missing/repeated continuation cursors, missing bodies and
malformed records stop the job before its first provider call. The historical
acceptance address is excluded. The worker sends a separate Resend API email for each reader, HTML and
plain text, story links, a signed unsubscribe link and List-Unsubscribe headers.
No recipient addresses or tokens are returned in job responses or logged.

A create-only private claim at `newsletter/delivery/<week>/<subscriber-id>.json`
is verified by uncached exact-content readback before sending. It stays immutable,
preventing concurrent jobs and retries from resending. Terminal acceptance or
pre-send suppression is written separately, create-only and verified, at
`newsletter/receipts/<week>/<subscriber-id>.json`. Older terminal records stored
in the claim path remain valid guards and are never rewritten. A surviving receipt
also blocks a send when an incomplete restore omitted its original claim.

A failed or ambiguous claim, provider request or receipt save leaves delivery held:
compare the record with the provider dashboard before resolving it. Do not delete
claims and retry. Provider idempotency keys are an additional safeguard; the durable
claim remains the duplicate guard. API acceptance is not an assertion of inbox
delivery. Bounces and complaints must be monitored in the sending service.

Unsubscribe GET displays confirmation without changing state, protecting against
email link scanners. A signed POST, including provider one-click POST, durably
writes and reads back `newsletter/suppressed/<subscriber-id>.json`, create-only.
Repeated or concurrent requests preserve the first valid unsubscribe timestamp.
Malformed existing suppression is preserved and fails closed; it is not repaired
by overwriting it. Both pre-claim and pre-send
checks consult that suppression. Signing keys stay server-only. Signup does not
silently clear suppression; a previously unsubscribed reader requires explicit
re-enrollment work before restoring delivery. A request already in flight cannot
be recalled. Unsubscribe failures display a retry message, never false success. GET, POST and
error responses are non-cacheable and prevent referrer disclosure. Private JSON
reads are bounded to 4 KiB during streaming, reject invalid UTF-8, bypass cache and
use a ten-second abort deadline; oversized or interrupted streams are cancelled.

## Owner readiness and preview

The Subscribers section now has read-only newsletter status and Refresh digest
preview. Each `/api/owner-newsletter` GET revalidates the owner identity, private
membership and active session before reading configuration/public catalog data.
There is no send, activation, subscriber mutation or provider-call operation.
Only fixed missing-setting names and the delivery switch state are exposed. The
sender, mailing address, secret values and personal unsubscribe tokens are absent.
Configuration presence is not credential validity or hosted delivery acceptance.

The preview uses the strictly next Friday 16:00 UTC boundary and the delivery
worker's same completed UTC calendar dates. Stories published on a Friday wait for
the following week. It lists public/routed titles and links, subject and safe email
text with personal unsubscribe/address placeholders. Empty weeks are identified;
refreshing a preview never sends a message. Catalog failures show unavailable while
readiness remains independent. Sign-out or session expiry clears the preview and
rejects late responses. Actual authenticated hosted readback remains an open gate.

## Hosted acceptance in the existing project

Noah approved Resend and reported the provider secrets configured on 2026-10-08.
Follow-up on 2026-10-10: Noah configured the signing value; live invalid-token GET
now returns 400/no-store. The prior missing/short `NEWSLETTER_SECRET` guard is
resolved. No signed token, subscriber write or email was used. Preserve that value
so previously issued links remain valid; no further signing-secret action is needed.
Do not request those secrets again or copy them into chat/Git. Existing Vercel Blob
credentials were independently exercised by the completed editorial import.
Newsletter provider configuration and end-to-end delivery have separate gates;
the import does not prove them. Vercel connector inspection remains deferred at
Noah's request. GitHub deployment and public denial checks remain available.

Keep `NEWSLETTER_ENABLED` disabled. Production, publication and article scheduling
also remain disabled until full deployed acceptance passes. No activation follows
automatically from local tests. A fresh secure owner session is needed for actual
authenticated owner readback. An authorized, isolated test must then establish:

1. Private subscriber enumeration/readback and scanner-safe GET, followed by a
   signed POST for a specifically consenting test recipient, with independently
   verified first suppression timestamp and no change to other readers.
2. The existing verified sender, mailing address and server-only Resend/cron/signing
   configuration inside the hosted runtime, without revealing values. Preserve
   `NEWSLETTER_SECRET` so existing unsubscribe links remain valid.
3. One test-recipient provider acceptance and actual mailbox result, plus duplicate
   and concurrent invocation denial, immediate suppression and isolated outage,
   interruption and restore behavior. Do not run the production mailing list as a test.
4. Independent claim/receipt/suppression readback and a documented recovery receipt.
   API acceptance alone does not prove mailbox delivery. Enable weekly delivery
   only after the complete deployed gates and applicable owner authorization.

## Held-delivery recovery

This is a reviewed recovery procedure, not an automatic resend endpoint. Never
delete claims, receipts or suppressions to rerun a job. Restore immutable evidence
before restarting workers; leave delivery paused throughout reconciliation.

| Evidence | Interpretation and action |
| --- | --- |
| Verified original claim and separate accepted receipt | Provider API acceptance is recorded; check provider/mailbox outcome, do not resend. |
| Legacy accepted/suppressed state in the original claim | Preserve it as the permanent guard; do not migrate by overwriting. |
| Claim without a verified receipt | Outcome is held, including an interruption before send or a lost response after provider acceptance. Reconcile the existing idempotency key in Resend; never assume unsent or retry. |
| Receipt surviving without a restored claim | Incomplete restore; receipt still blocks sending. Restore the original verified evidence. |
| Corrupt/missing readback, conflicting terminal state or incomplete listing | Processing is unavailable; preserve bytes and investigate storage/restore completeness. No false success or partial mailing. |
| Verified suppression | Reader remains unsubscribed; retain the first timestamp and require a separate explicit re-enrollment process. |

Implementation and fixture evidence: ../verification/newsletter-persistence-recovery-2026-10-10.md.
Actual hosted delivery and recovery remain open; no email was sent for this work.

## Provider references

- https://resend.com/docs/api-reference/emails/send-email
- https://resend.com/changelog/idempotency-keys
- https://www.resend.com/changelog/custom-email-headers

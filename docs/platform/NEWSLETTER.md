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
read without cache, email/hash/consent are checked, and the historical acceptance
address is excluded. The worker sends a separate Resend API email for each reader, HTML and
plain text, story links, a signed unsubscribe link and List-Unsubscribe headers.
No recipient addresses or tokens are returned in job responses or logged.

A create-only private claim at `newsletter/delivery/<week>/<subscriber-id>.json`
prevents concurrent jobs and retries from resending. Accepted provider receipts
are retained. A failed or ambiguous request leaves its claim held: compare that
record with the provider dashboard before resolving it. Do not blindly delete
claims and retry. Provider idempotency keys are prepared as an additional safeguard; the durable
claim remains the duplicate guard. API acceptance is not an assertion
of inbox delivery. Bounces and complaints must be monitored in the sending service.

Unsubscribe GET displays confirmation without changing state, protecting against
email link scanners. A signed POST, including provider one-click POST, durably
writes `newsletter/suppressed/<subscriber-id>.json`. Both pre-claim and pre-send
checks consult that suppression. Signing keys stay server-only. Signup does not
silently clear suppression; a previously unsubscribed reader requires explicit
re-enrollment work before restoring delivery. A request already in flight cannot
be recalled. Unsubscribe failures display a retry message, never false success.

## Required setup in the existing Vercel production project

Owner approved Resend on 2026-10-08. The production adapter is now implemented.

1. Create/use a Resend account and verify the Folkly sending domain using its DNS
   instructions. Add `RESEND_API_KEY` as a server-only production secret.
2. Set `NEWSLETTER_FROM` to a verified sender, such as
   `Folkly <updates@folkly.com>`, and `NEWSLETTER_POSTAL_ADDRESS` to the business
   mailing address that should appear in each newsletter.
3. Generate separate high-entropy secrets for `CRON_SECRET` and
   `NEWSLETTER_SECRET` (at least 32 characters). Preserve the signing secret so
   existing unsubscribe links remain valid. Never put these values in GitHub or chat.
4. Keep the existing private Blob connection (`BLOB_STORE_ID` or
   `BLOB_READ_WRITE_TOKEN`). Check an existing subscriber record in Vercel Storage;
   do not create a second store or move the existing records.
5. Redeploy with delivery paused, verify storage and unsubscribe using a consented
   test address, then set `NEWSLETTER_ENABLED=true` and redeploy to activate the
   owner-authorized weekly newsletter. Confirm sender receipt, unsubscribe and
   suppression before treating hosted delivery as accepted.

The connected Vercel API currently returns project-not-found for both `folkly`
and `prj_d93TLitMYu8uYjqfgvgANuwsRJVK` in the existing team. Noah can reconnect
Vercel with access to that project or enter the environment variables directly
in its dashboard. No sending key or verified sender was available to this run;
no subscribers were contacted. GitHub deployment is available independently.

## Provider references

- https://resend.com/docs/api-reference/emails/send-email
- https://resend.com/changelog/idempotency-keys
- https://www.resend.com/changelog/custom-email-headers

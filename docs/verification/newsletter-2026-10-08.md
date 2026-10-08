# Newsletter and disclaimer verification

Owner requested automatic signup recording and weekly emails, and removal of
article disclaimer footers. Existing private Blob signup storage is reused.
The public build now removes `editorial-note` paragraphs; source and license
sections stay intact. Build regression asserts the disclaimer class is absent.

Implemented Friday weekly digest API, private create-only per-recipient claims,
provider-neutral requests with idempotency keys, completed-calendar-day story selection,
private suppression records and scanner-safe signed unsubscribe confirmation /
one-click POST. A separate newsletter switch defaults off until provider,
sender, address and secrets are supplied and the provider adapter is approved.
Automatic approval review rejected the proposed Resend adapter because the
provider was not explicitly owner-approved for receiving subscriber addresses.
That adapter is not committed; the production API has no sending transport. No article publication switch changed.

Focused newsletter fixtures pass: unauthorized/no-spend guards, missing config,
empty/private story exclusion, Friday boundaries, escaped HTML, separate recipient
requests, competing jobs, retry deduplication, ambiguous-send holds, durable
suppression, bad signatures, read-only GET and fail-closed storage. Build and
full regression suite pass. No live mail, subscriber readback, real provider or
hosted cron/Blob concurrency acceptance is claimed. See platform/NEWSLETTER.md
for activation prerequisites, capacity limits and recovery steps.

Vercel environment metadata access was attempted without decrypting secrets;
both the project name and known ID returned 404 in the known team. GitHub remains
available for deployment. Noah needs sending-service setup and project access;
SMTP configured in Supabase Auth alone does not connect this mailer.

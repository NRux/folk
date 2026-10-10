# Owner newsletter delivery test, 2026-10-10 UTC

## Implemented next gate

An owner-authenticated Subscribers control requests one explicit transactional mail
to FOLKLY_OWNER_EMAIL, then separately records the owner's mailbox receipt. This
reuses the existing private Blob store and Resend adapter; there is no new account,
provider, subscriber import, schema or activation switch. Startup is GET/status
only. The consent checkbox starts unchecked. Nothing sends without the owner's
checkbox and button click.

GET/POST authorization checks owner identity/private membership/active session.
POST additionally requires same Origin, bounded JSON and exact action fields;
recipient/path/provider input is rejected. All three article controls and weekly
mailing must be paused. The mail includes one validated, already-public story.
The fixed owner email is sent to Resend only; API replies reveal no email, address,
key, token or private object path. Claims and receipts are private/create-only.

An immutable daily claim precedes the only provider attempt. Claim concurrency,
ambiguous responses and incomplete restoration cannot permit a second send.
Provider receipt and mailbox attestation require independent exact private reads.
API acceptance is never labeled delivered. Held attempts require provider review,
not deletion/retry. The daily namespace is isolated from real subscribers,
suppression records and weekly digest delivery. This transactional mail does not
prove signed-unsubscribe/newsletter compliance or all Stage 7 acceptance.

## Checks

- All 41 regression commands and the 73-page/11-story build pass.
- scripts/test-owner-newsletter-test.mjs uses a fake provider/storage only. It covers
  anonymous/origin/query denial, exact checkbox/action input, paused settings,
  fixed recipient, HTML escaping, immutable duplicate/concurrent/ambiguous-send
  caps, provider-secret redaction, mailbox idempotency and no subscriber mutation.
- Real owner HTML/client VM proves initial status is read-only, unchecked consent
  cannot send, only explicit click POSTs, logout clears private state and stale
  status replies cannot restore send readiness.
- Existing hosted newsletter storage recovery previously passed eleven real Blob
  checks; see newsletter-hosted-storage-recovery-2026-10-10.md. Those were no-mail
  storage fixtures and are separate from this new actual provider/mailbox gate.

No actual email, provider job or subscription change occurred during implementation.
Actual owner consent, Resend acceptance and mailbox receipt remain OPEN. To complete:
sign in at https://www.folkly.com/owner, open Subscribers, refresh status, check
consent and Send one test email, inspect the mailbox, then I received the test email.
Only missing configuration names are displayed if needed; configured secrets must
stay in provider settings. Weekly mail and autonomous publication stay disabled.

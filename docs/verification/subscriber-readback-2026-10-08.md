# Protected subscriber readback verification

## Implemented

The existing owner dashboard now has a private, paginated Subscribers section.
It reads the established `subscribers/<sha256>.json` records and checks the
corresponding private suppression object before showing one of two explicit
states: Subscribed or Unsubscribed. It displays only the email, signup time,
consent version, source and status. Blob paths, record hashes, signing tokens and
provider credentials never enter the response.

The endpoint is available only after the same Supabase identity, private owner
membership and active-session checks used by the rest of the dashboard. Every
continuation request repeats those checks. Pages are limited to 20 records;
paths, object sizes, email syntax, email-to-path hashes, consent fields,
timestamps, source fields and continuation cursors are validated. A malformed
object, mismatched hash, storage error or ambiguous continuation fails the entire
page closed, so the panel does not claim that a reader is subscribed when the
suppression state could not be checked.

The browser clears subscriber data on sign-out and ignores a late response from
an earlier authenticated request. The panel is read-only. It does not alter
subscriptions, suppression records, delivery claims or newsletter settings.

## Test evidence

- `npm run build`: passed, 73 public routes; generated owner page contains the
  private subscriber controls and no Blob credential names.
- `node scripts/test-subscriber-inbox.mjs`: passed bounded private listing,
  suppression state, identifier redaction, hash validation, malformed record,
  oversized object, unsafe path, repeated cursor and storage-configuration cases.
- `node scripts/test-owner-auth.mjs`: passed per-request session and membership
  checks, anonymous/revoked denial and cursor rejection before Blob access.
- `node scripts/test-owner-response-race.mjs`: passed sign-out clearing and late
  private-response suppression.
- `npm test`: passed the complete debug, security, reader, editorial, newsletter,
  privacy, migration and content-store regression suite.

## Remaining hosted acceptance

This run did not decrypt production secrets, list real subscribers or send mail.
Hosted readback still requires the connected Vercel project to expose Folkly to
the tool session and a real owner session. Resend sender/domain configuration,
provider receipt, unsubscribe readback and bounce/complaint operations remain
separate acceptance items. `NEWSLETTER_ENABLED`, autonomous production,
publication and the recurring article schedule remain disabled.

# Owner contact reply verification

## Implemented

The protected owner contact inbox now provides a Reply action for every validated
message. It opens the owner's configured email application with the recipient,
the fixed subject `Re: Your message to Folkly`, and an encoded greeting. It does
not send mail, change the contact record or claim that a reply was delivered.

The inbox storage boundary now validates email syntax and requires a nonblank
name in addition to the existing private-prefix, path, size, reason, contributor,
message, timestamp and cursor checks. The client creates the link through DOM
properties and percent-encodes contact-derived values. Message content continues
to render with `textContent`; it is not inserted into HTML or copied into the
reply draft.

## Evidence

- `node scripts/test-contact.mjs`: passed form validation, private storage,
  pagination, malformed email rejection, text-only rendering and outage cases.
- `node scripts/test-owner-response-race.mjs`: passed late-response denial after
  sign-out.
- `npm run build`: passed with 73 public routes and the owner-only reply client.
- `npm test`: passed the complete regression suite.

The implementation commit deployed successfully through Vercel. At 2026-10-08
23:53 UTC, the production `/owner.js` returned 200 and contained the fixed reply
subject and `mailto:` workflow. An anonymous `/api/owner?view=contacts` request
returned 401 with `Cache-Control: no-store`; no private contact data was read.

## Limits

The action depends on the owner's local email application. There is no provider
delivery receipt or reply-status ledger. Adding automatic replies would require a
separate approved outbound-mail design, authentication, durable idempotency and
hosted acceptance. No such sending capability was enabled here.

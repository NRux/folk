# Translation budget controls, 2026-10-09 UTC

## Owner feature

The existing owner panel's Translations section includes a Total budget limit
(USD) entry, browser-local expiry, explicit "Allow translation batches within
these limits" checkbox, Save translation budget, and Reload saved budget.
Current persisted values load rather than speculative defaults. The summary
shows total, retained reserved spend and remaining allowance. The configured
model and per-translation reservation are read-only.

Saving does not submit a batch or call a provider. The explicit checkbox affects
only the independent translation pilot; article generation/publication/schedule
and newsletter controls are untouched. Budget API accepts only amount, expiry,
enabled and expected revision. Provider model, job reservation and frozen prices
cannot be chosen through arbitrary browser fields.

## Persistence and security

Migration 20261009214800_translation_budget_controls.sql installs read/save
SECURITY INVOKER RPCs with an empty search_path and service-role JWT checks.
Anonymous, authenticated and scoped publisher roles have no EXECUTE rights.
Budget tables and the existing audit table retain their private RLS/grants.

Save takes the singleton budget lock shared by paid job claims, verifies an
exact expected-budget snapshot, sums ALL retained reservations, rejects a cap
below commitments, checks configured model/prices/token ceiling and records
before/after metadata in the private audit table. An enabled pilot must fit one
per-attempt reservation. Caps are USD 0–50 with at most two decimals; approval
expires in the next 30 days. No job/reservation deletion or refund is provided.
RPC output is independently read again before a success acknowledgement.

Owner endpoint membership/session validation, exact same-origin POST, bounded
JSON body and no-store responses remain. Dirty form values survive refresh and
errors; explicit reload replaces them. In-flight save blocks editing/double
submission, and logout or a changed session clears values and rejects late replies.
New sessions restore editing. Failed verification retains the database result
for refresh and performs no automatic mutation retry.

## Checks

- npm run build: 73 public pages, 11 stories, publisher disabled.
- All 35 npm test commands pass.
- New PGlite tests cover amount/type/precision/expiry limits, false-by-default
  activation, stale edits at both HTTP and SQL boundaries, retained failed
  reservations, readback outage, configuration mismatch, audit append, owner/origin
  denial and service-only permissions. No provider function is passed or called.
- Real owner HTML/client tests verify loaded budget, save progress, explicit
  enable choice, no batch on save, retained unsaved text, invalid values,
  conflict preservation, explicit reload and logout/late-response isolation.
- Applied the migration to existing project vxmyggasjgsiohqzzwzh. A hosted
  save/readback exercised job-cap/expiry persistence while keeping enabled=false;
  the whole transaction was rolled back. Independent readback confirms total=0,
  job cap=0, old expiry, pilot disabled and all three article switches false.
- Hosted privilege readback: anon/authenticated/publisher=false, service_role=true.
  Security advisors before/after are unchanged: private RLS/no-policy INFO and
  pre-existing leaked-password-protection WARN. No new advisory introduced.

No real budget was approved or enabled, paid translation generated, article
published, newsletter sent, private reserve transferred or secret changed.
The form lets Noah provide the remaining cap/expiry explicitly. Model and
private storage configuration remain in existing provider settings.

## Deployed readback

Implementation 286ad89b964f3110988566caac35fb8c91ac94bb completed successfully
on Vercel. Public /owner HTML and /owner-translations.js matched the tested build
byte for byte, including all budget controls. Anonymous API GET and budget POST
returned 401 with no-store. Both main/master were read back at the implementation
SHA. A follow-up copy change clarifies that the publishing/MFA lock applies to
publishing controls; the independent translation spending form remains separate.

No positive budget or activation was selected for Noah. A real owner budget save
is left for his chosen amount/expiry; the private save/readback path was verified
through rolled-back hosted SQL and server/client security tests.

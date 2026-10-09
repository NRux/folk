# Analytics durable checkpoints verification — 2026-10-09

## Outcome

Implemented the next unblocked part of GA4 Prompt 3 without enabling collection.
The collector now claims one durable run per property/date-window/query-version,
uses a five-minute fencing token, writes a sanitized checkpoint after every valid
report page, resumes at the persisted offset, and atomically saves the final
snapshot and completion state. A completed, busy, backed-off or held run returns
before minting a Google token or sending a reporting request.

Only validated, allowlisted article observations, bounded quality/quota fields and
SHA-256 response hashes enter checkpoints. Access tokens, raw error bodies, owner
identity, form values, full URLs and private reserve content are never stored.
Failures store one stable code and an optional bounded retry time. Attempts hold
after five claims. No collector schedule or public/manual trigger was added.

## Database and access controls

Migration `20261009063851_analytics_collection_checkpoints.sql` adds the private
`folkly_analytics_runs` ledger and four narrowly scoped RPCs: claim, checkpoint,
finish and fail. The public-schema table has RLS enabled and no reader policy.
Direct access is revoked from public, anonymous, authenticated, publisher and
analytics roles; service-role access remains for private administration. Each
security-definer RPC uses an empty search path, checks the signed JWT role, bounds
inputs and is executable only by `folkly_analytics`.

The legacy `folkly_save_analytics_snapshot` permission was removed from the
analytics role, so the worker cannot bypass run/checkpoint completion. The
publisher role has no analytics RPC permission.

The migration was applied successfully to Supabase project
`vxmyggasjgsiohqzzwzh`. Hosted readback confirmed:

- RLS enabled and zero persisted run rows after verification;
- claim/checkpoint/finish/fail executable by `folkly_analytics`;
- claim not executable by anonymous or publisher roles;
- legacy direct snapshot save not executable by `folkly_analytics`;
- analytics config disabled;
- production, publication and schedule settings all `false`.

A transaction-only hosted fixture enabled a synthetic property locally inside the
transaction, exercised claim, competing-run denial, checkpoint, finish and
completed-run idempotency, then rolled back. Follow-up readback found zero runs and
zero snapshots and every switch still off.

## Test evidence

- Focused `node scripts/test-analytics.mjs`: passed twice.
- Full `npm test`: passed all 31 regression commands.
- Synthetic collector checks cover page-one interruption and offset-one resume,
  completed/busy no-call behavior, monotonic checkpoints, duplicate/order/count
  rejection, quota/backoff handling, response size/UTF-8 bounds and no partial
  snapshot persistence.
- PGlite migration checks cover disabled claims, RLS/direct-table denial,
  competing leases, checkpoint/finish, idempotent completion, retry backoff and
  RPC denial for anonymous, authenticated, publisher and service roles.
- No Google request, paid model call, email, article publication or locale release
  occurred.

Current Supabase guidance was checked before the change. The public-schema RLS
recommendation and security-definer execution warnings are satisfied by explicit
RLS, revocation from default roles, a fixed search path and an allowlisted scoped
role. The post-migration advisor reports the no-policy condition as informational;
it is intentional deny-by-default design. It found no new analytics performance
warning. Existing unrelated advisories remain unchanged: leaked-password
protection is disabled, one model-reservation foreign key lacks a covering index,
and several unused-index notices reflect an otherwise idle pre-production schema.

References:

- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0028_anon_security_definer_function_executable

## Remaining Prompt 3 work

Implement and test separate compatible report groups for landing sessions and
channel/device, active-user complete windows, and bounded custom editorial events.
Add release/cohort mapping before comparisons. Then run an authorized manual live
collection against GA4 property `558035708`, retain provider/quota receipts and
verify late-window recovery. These receipts are still required before analytics
can influence editorial work. Analytics may remain descriptive only and cannot
authorize model spend, revisions or publication.

No connection or credential change is required for this checkpoint release. The
next live acceptance exercise will require the already configured scoped Google
reporting identity and `folkly_analytics` token to be available to the protected
worker runtime. Do not send either credential in chat or commit it to Git.

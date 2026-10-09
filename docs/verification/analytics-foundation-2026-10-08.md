# Analytics foundation verification

Recent branch check: main and master were both 9597b25d02ab087c0007a27bd635d410dfa13dc4;
no additional branches existed. No merge was necessary before continuing.

Implemented a server-only, read-only GA4 Data API collector, isolated storage
role and private snapshot persistence. Tracking measurement ID remains
G-RQJD3XG35C. Numeric reporting property ID and secure authentication are missing.
No live Google API requests, new credentials, model calls or schedules occurred.

## Implementation

- Requires a separately enabled environment switch, numeric property ID,
  verified property timezone and injected read-only OAuth token provider.
  Runtime OAuth/federated/service-account wiring remains to be implemented.
- Fixed Google API origin, redirect rejection, 15-second request bound, no
  internal retries, five-page/10,000-row limit and one-MB response bound.
- checkCompatibility validates requested names against compatible metadata.
  Reports filter the verified Folkly hostnames and four public story paths.
- Daily additive views and engagement seconds only; no summed distinct users.
  Both URL forms normalize together. Query strings/fragments/private paths
  are excluded from saved rows. No prompts or subscriber/owner identifiers.
- Uses a 28-day window ending two property-calendar days ago. This is a
  freshness heuristic, not a guarantee that late/modelled data is final.
- Preserves thresholding/sampling/other-row/truncation flags; empty reports
  are treated as no observations. Qualified or tiny reports remain observe-only.
  Descriptive evidence never authorizes publication or establishes causation.
- Dedicated folkly_analytics NOLOGIN role has only snapshot RPC execution,
  no table CRUD, editorial access, owner administration or publisher rights.
  Google read access and database credentials are independent.
- RPC persists one bounded snapshot per property/window/report version, atomically
  replacing the same window on refresh. Database config defaults disabled and
  its allowed property must match. Content versions and source evidence untouched.
  Hash fingerprints the fetched responses; it is not an authenticity signature
  or an independently recoverable backup of raw Google reports.

## Evidence and limits

Full build/npm test passed. Focused analytics checks passed again: paused/no-call,
numeric property, URL normalization, metric aggregation, timezone/header checks,
quality flags, incompatible requests, credentials/provider errors, denied API
access and storage failures. Local PGlite verified scoped access, disabled save,
retry idempotency and anonymous/authenticated/publisher/service-role RPC denial.

Hosted migration applied to Folkly Supabase. Readback confirmed collector disabled,
zero snapshots, no worker direct insert/editorial reads, no anon/publisher RPC
execution, and all three autonomous switches false. No production content changed.
This is not live property verification or complete analytics acceptance.

## Next prerequisites and implementation

Numeric GA4 property ID, property timezone and dedicated Viewer/read-only service
identity; secure Google token provider wiring; scoped folkly_analytics credential.
Verify stream G-RQJD3XG35C belongs to that property before enabling collection.
Then implement persisted sync-run checkpoints/retry policy, custom engagement
and subscription events, release mapping, 7/28-day baselines, meaningful
confidence/cohort checks, budgeted AI proposals and protected owner review.
No schedule or automatic revisions should be enabled by those prerequisites alone.

The old Site content migration still needs a complete lossless export. The
available bounded table reader truncates large values; no partial import is safe.
Owner sign-in succeeded according to Noah; MFA/auth recovery acceptance remains.
Prior Supabase Auth leaked-password-protection warning remains a security item.

References verified 2026-10-08:
- https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/checkCompatibility
- https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/ResponseMetaData
- https://developers.google.com/analytics/devguides/reporting/data/v1/reporting-data-expectations

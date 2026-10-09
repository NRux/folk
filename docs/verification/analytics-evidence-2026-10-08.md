# Analytics evidence safeguards, 2026-10-08 UTC

Implemented deterministic per-article observation checks in server/analytics.js.
Configured property 558035708 remains disabled. Public stories and private
reserve content are untouched; no analytics cron, Google request, model call or
publication occurred.

Each public article needs at least 100 views across 14 distinct days with
observed views. These are conservative eligibility heuristics, not statistical
significance. Site-wide traffic cannot qualify an underexposed article. Missing
article days are not treated as zero traffic. The report must match an explicitly
supplied expected property, supported report version and current lagged property
calendar window. Qualified or absent quality metadata, invalid dates/metrics,
duplicate day/path observations, unknown routes and unsafe aggregates hold all
articles in observe-only mode. Threshold options cannot weaken default minima.

Results expose bounded per-article totals and descriptive engagement seconds per
view, never a unique-user conversion rate or authorization to publish.
No arbitrary input URL or provider text is copied into the evidence result.

Full npm test passed. The focused analytics evidence fixture passed twice,
covering article isolation, a one-day launch spike, split traffic, absent/wrong
property, stale/immature windows, impossible calendar dates, unknown report
version, duplicate observations, private paths, NaN/Infinity metrics, missing
quality metadata, sampling, invalid timezone and unsafe threshold configuration.
Existing GA4 collector/storage regression passed. Evidence is synthetic/local;
this does not clear live Google or deployed Stage 7 acceptance.

No release mapping, cohort/device/channel controls, consent coverage, bot/test
traffic classification, comparable baseline or causal inference yet. A clean
report permits descriptive observations only. Runtime Google read-only identity,
property/stream/timezone verification and scoped database credential are pending.
A current report window check is not a retrieval-time or response-authenticity
check; freshness and immutable provenance require future sync run/release work.
All autonomous switches remain off.

Official metadata reference reviewed 2026-10-08:
https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/ResponseMetaData

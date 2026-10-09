# Analytics report integrity: 2026-10-09 UTC

## Selected task and findings

Continued GA4 implementation Prompt 3/4 using offline fixtures while Google Cloud
and Vercel connector inspection remain deferred. Reviewed current build state,
acceptance/SEO reports, verification evidence, publication catalog and manual
release manifest: eleven public stories include the seven already manually
released stories; private reserve is not an analytics source.

A new regression demonstrated that the prior collector could persist an invalid
calendar date such as 2026-09-31 within the report's lexical date window. Other
permitted failure cases included repeated raw report cells, empty/whitespace
metrics coerced to zero, and unexpected query-bearing paths normalized into
accepted observations. Those behaviors could inflate or distort future editorial
briefs even though automatic revision/publication remained prohibited.

## Changes

- Validate exact dimension/metric arrays, real dates, explicit numeric strings,
  finite/safe values and exact public URL variants before canonical aggregation.
- Track raw date/path keys across pages. Reject repeated cells, backwards report
  ordering, changing row counts and impossible window/path cardinality. Canonical
  and .html alias cells remain legitimately additive when each occurs once.
- Read successful responses as bounded streams; cancel at one million bytes,
  reject invalid UTF-8/JSON and redact body/read failures. No response body or
  token is logged or included in errors.
- Preserve only known numeric quota metadata; stop incomplete pagination when
  token/server-error capacity is explicitly exhausted. No partial persistence.
  Valid final-page reports may persist with zero remaining quota. Omission is
  recorded as unknown quota evidence, not interpreted as unlimited capacity.
- Propagate a bounded numeric Retry-After hint for 429 without automatic retry or
  duplicate storage. RPC persistence occurs once only after complete validation.
- Assert the analytics allowlist matches the actual published catalog so a future
  release cannot silently disappear from analytics coverage or include reserve.

No migration, production data, credentials, provider configuration, tracking tag,
consent behavior, article content, image attribution or publication switch changed.

## Evidence

- Before fix: new calendar/duplicate/numeric/path fixture failed with missing
  expected rejection, proving the unsafe acceptance path.
- Two consecutive focused debug/security passes: analytics collector and evidence
  suites PASS. Cases cover aliases across pages, cross-page duplicates/order/count
  changes, missing pages, quota exhaustion, malformed quotas/metrics, 429, invalid
  UTF-8/JSON, response cancellation, credential/body redaction, paused guards,
  private role denial, idempotent SQL upsert and conservative evidence thresholds.
- `npm run build`: PASS, 72 public pages and 11 published stories, publisher
  disabled.
- `npm test`: PASS, all 31 regression commands, including the expanded analytics
  collector tests, private SQL permissions, article/translation preservation,
  subscription/newsletter, owner expiry and consent/reader-event boundaries.
- `npm run test:hosted`: PASS, 45 checks against https://www.folkly.com; exact
  eleven story pages, author/discovery/navigation and private-output boundaries.
  Public readback verifies preservation, not an authenticated live collector run.

## Acceptance limits

All Google responses and collector credentials in tests are synthetic. SQL tests
run in isolated PGlite, not the hosted database. No actual Google request or
Supabase write, email, paid model call, publication or schedule activation occurred.
The collector still has no wired runtime token provider or public execution route.
New durable sync/checkpoint orchestration and further report/cohort groups are
open Prompt 3 work. Actual analytics observations do not become content revisions
or establish causation. Full deployed Stage 7 gates remain separate.

No new Noah connection/credential action is required for this code task. Google
Cloud/reporting credentials stay deferred; reported GA4 setup and provider secrets
are not requested again. No original-content export is reconstructed from the
public pages. Autonomous production/publication/article switches remain off.

## Primary API references checked 2026-10-09 UTC

- https://developers.google.com/analytics/devguides/reporting/data/v1/basics
- https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/RunReportResponse
- https://developers.google.com/analytics/devguides/reporting/data/v1/quotas

These define response row counts, pagination and returned property quota; they do
not guarantee snapshot consistency across separate requests or statistical inference.

## Deployment and final public readback

Implementation commit `e13995ea24255d1e60a17822566af999e557a237` was synced to
main and master with current-head leases. GitHub reported Vercel deployment
completed before master synchronization. Five post-deployment HTTP checks passed:
exact tested bytes for Lisbon, the archive and owner.js, server analytics source
404 and unauthenticated owner API 401. See
analytics-report-integrity-live-2026-10-09.json for hashes/statuses/time.

These checks confirm public preservation and access boundaries. They do not
execute the private collector or replace live Google/provider acceptance.

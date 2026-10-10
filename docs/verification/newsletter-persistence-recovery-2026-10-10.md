# Newsletter persistence and recovery prerequisite

Date: 2026-10-10 UTC. Existing repository/project/storage only. No email sent,
production subscriber mutation, paid provider call, schema change or activation.

## Findings and implementation

The previous adapter returned `true` from claim creation immediately after `put`,
without proving the permanent delivery guard existed. The focused regression
first failed with `Missing expected rejection` for a successful transport with
missing readback. Suppression and delivery completion likewise acknowledged an
unverified write and overwrote existing evidence. Listing trusted malformed
continuations and silently ignored unknown paths, risking incomplete mailing.

- Claims are now private/create-only, uncached and exact-content verified before
  permitting a send. An ambiguous claim write remains held, even if later readback
  finds it. A subsequent invocation cannot send again.
- Original delivery claims are never overwritten. Separately verified immutable
  terminal records live at `newsletter/receipts/<week>/<subscriber-id>.json`.
  Conflicting finalization fails closed. Old accepted/suppressed claim records are
  preserved as guards. A surviving receipt blocks sending after a partial restore
  even when its original claim is missing.
- Suppression is private/create-only and verified before POST returns success.
  Repeated/concurrent requests preserve the first valid unsubscribe timestamp.
  Unreadable or corrupt prior suppression is preserved and cannot be treated as
  successful unsubscribe or active enrollment.
- Enumeration validates all pages, unique fixed paths, booleans, forward cursors,
  record sizes and subscriber consent/hash/metadata before any provider call.
  Capacity remains 200 readers, 100 entries/page and at most 20 listing pages.
  Incomplete/malformed later pages cannot result in a partial mailing.
- Worker and authenticated subscriber inbox share uncached private JSON reading:
  4 KiB streaming limit, fatal UTF-8 decoding, ten-second abort deadline and stream
  cancellation on failure. The inbox reports unavailable rather than inferring
  unsubscribe status from a corrupt object.
- Every newsletter/unsubscribe success, pause, denial and error is non-cacheable.
  Signed-link responses prevent referrer disclosure. Duplicate token parameters
  are invalid; GET/scanners remain read-only. No private path/body/provider error
  is returned to a caller.

## Test evidence

`node scripts/test-newsletter-recovery.mjs` failed against the original adapter,
then passed after the fix. Focused newsletter and subscriber-inbox regressions
also pass. The recovery suite uses the production adapter with injected private
Blob/provider fixtures; it performs no live provider/storage operation.

| Scenario | Result |
| --- | --- |
| Successful write transport, absent/wrong claim readback | Reject; no permission to send. |
| Lost claim response after persistence | Held; existing permanent claim prevents replay. |
| Concurrent worker requests and later retries | Exactly one mocked provider call, immutable claim and separate receipt. |
| Provider acceptance followed by missing receipt persistence | Accepted count stays zero, held count increments; later invocation cannot resend. |
| Lost receipt response after actual fixture persistence | Exact readback reconciles terminal evidence without another send. |
| Missing original claim after restore, surviving terminal receipt | Held without creating a new claim. Corrupt receipt also fails closed. |
| Legacy accepted/suppressed claim and conflicting terminal completion | Original bytes retained; no overwrite or resend. |
| Missing/wrong suppression readback | Unsubscribe POST returns 503/no-store, never false success. |
| Concurrent and repeated unsubscribe requests | First valid timestamp retained; every write is create-only. |
| Duplicate/unknown paths, missing/cyclic cursor, wrong hasMore, missing later body/consent | No partial list/provider call. |
| Subscriber count and 20-page traversal bound | Fail closed before mailing. |
| Oversize streaming body / invalid UTF-8 / malformed suppression | Stream cancelled or parse rejected; inbox unavailable. |
| Invalid delivery scope/date, subscriber ID or duplicate signed-token input | Denied without arbitrary storage writes. |

`npm run build && npm test` PASS: 73 public pages, 11 published stories and all
37 regression commands. Existing public catalogs/credits, owner privacy/version
preview, auth/RLS, publisher/model budgets, translation/batch recovery, source
import and reader-consent checks pass. Expected injected-failure diagnostics in
test output are fixture cases, not observed production errors.

At 2026-10-10 00:33 UTC, native read-only Supabase query returned `false` for
`production.autonomous_enabled`, `publication.autonomous_enabled` and
`schedule.enabled`. This change does not inspect or alter newsletter environment
values, cron configuration, existing subscriber records or private evidence.

## Hosted acceptance and remaining work

Code commit `fd7ccf5a31f417327ef7faa410f2bf5197cf8a9e` is synced to main/master.
GitHub Vercel status is success for the existing project:
https://vercel.com/optagens-projects/folk/9V8TJmfbLpXD9HEpShvdnjXXhGEJ.
All 45 deployed reader checks pass, including byte-exact public articles/credits.
Anonymous newsletter and owner/subscriber-page requests return 401/no-store.
No live signed unsubscribe POST or authenticated cron run is used as a test.
Local tests and anonymous HTTP checks do not prove actual subscriber persistence,
Resend sender acceptance, mailbox delivery or hosted interruption/restore recovery.

The live invalid-token unsubscribe GET returns **503/no-store**, with
`Unsubscribe temporarily unavailable`, instead of reaching token validation. In the
deployed handler this response is only produced when `NEWSLETTER_SECRET` is absent
or shorter than 32 characters. This is a production runtime configuration blocker,
not a failed Blob read. No signed token or subscriber preference was exercised.
Aggregate public evidence: [denial checks](newsletter-public-denial-2026-10-10.json).

Noah already reported provider secrets configured. Do not reveal or re-send them.
The exact action is to verify the existing `NEWSLETTER_SECRET` in **Production**
for project `prj_d93TLitMYu8uYjqfgvgANuwsRJVK`, ensure the signing value is at least
32 characters and redeploy; do not rotate an existing signing key or invalidate
previous links. If it was never set, create a dedicated high-entropy signing secret
inside provider settings. An invalid-token GET should then return 400/no-store.
No new Resend account, Blob store, database or unrelated provider setup is needed.
Vercel connector inspection and Google Cloud remain deferred. A fresh secure owner
sign-in is needed for actual authenticated owner readback. Then use an explicitly
isolated consenting test recipient and hosted runtime configuration without
exposing credentials or invoking the production list. Full deployed acceptance
and applicable owner authorization must precede weekly delivery or autonomous
production/publication/article schedule activation. See the current
[newsletter runbook](../platform/NEWSLETTER.md) for reconciliation cases.

## Primary references

- [Vercel Blob SDK](https://vercel.com/docs/vercel-blob/using-blob-sdk):
  explicit private access, `allowOverwrite: false`, `useCache: false` and
  `abortSignal` options checked against current documentation on 2026-10-10.
- [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email):
  existing approved single-recipient provider and idempotency contract retained.

# Translation runtime and Stage 7 follow-up

Updated 2026-10-09 UTC. This report supersedes earlier translation approval,
reviewer-provision and GA4 setup blockers in BUILD-STATE, the acceptance report,
translation-reader-events report and multilingual prompts.

The owner reports the separate capped pilot/model approval and competent reviewers
for zh-Hans/es/hi/ar/fr/ja completed. GA4 property 558035708 / stream G-RQJD3XG35C,
bounded dimensions, enhanced-measurement restrictions and consent-aware DebugView
work are reported complete. Provider secrets are reported set. These setup tasks
are recorded as completed reports; no independent Analytics account inspection or
live provider evidence is claimed. Google Cloud/reporting credentials stay deferred.

## Implementation

- Separate translation budget/job/usage ledger in existing Supabase, default closed;
  no changes to article-generation budgets or autonomous settings.
- Authenticated owner Translations navigation, private draft generation/readback,
  attempt list and receipt-based recovery. Only current public build contracts can
  be submitted; no arbitrary source text, private reserve or browser provider key.
- Single active reservation, exact source identity/UUID duplicate denial, total and
  per-attempt limits, current pricing, frozen-rate usage estimates and excess-usage hold.
  Failed/ambiguous attempts retain their full reservation, with no automatic retry.
- Private create-only Blob draft objects, bounded UTF-8/checksum verification and
  immutable SQL receipts. Recovery only completes a verified saved object's
  persistence; it never repeats the paid provider call or refunds the reservation.
- Reviewed shared home/archive/About/Subscribe/Privacy/image-credit page contracts
  and a dynamic message catalog. Six locale routes, complete static labels, filter
  metadata/counts, confirmation/error messages, RTL and accessible English fallback.
  Unreviewed subarchives/stories keep English destinations. Review hashes and stale
  omission apply to every page/message payload. No actual locale was released.
- Subscribe now has its missing self canonical URL and description.

## Evidence

| Check | Result / scope |
| --- | --- |
| `npm run build` | PASS: 72 existing public routes; eleven published stories; empty locale manifest. |
| `npm test` | PASS: all 31 regression commands, including new translation job and shared UI suites. Provider/storage failure messages are intentional fixtures. |
| Focused debug/security pass | PASS: job, UI, original translation, reader-event, contact and privacy checks after full regression. |
| Syntax checks and public extraction | PASS: changed modules parse; eleven story plus seven shared UI contracts exported outside public output, with create-only files. |
| Local Postgres/runtime fixtures | PASS: caps/rate expiry, one reservation, retained failed spend, source duplicate denial, immutable evidence, fencing, usage estimate/overage hold, CSRF/auth/private source denial, corrupted/private-prefix denial and no-call recovery. Provider/Blob mocks only. |
| Six-language UI fixtures | PASS: 42 synthetic shared-page/message payloads; reviewed static paths, reciprocal canonicals/alternates, placeholder protection, localized discovery/form/privacy text, preserved credits, stale rollback, reproducibility and owner logout races. These are structural fixtures, not translations or human approvals. |
| Hosted migration | APPLIED to existing Folkly Supabase: translation pilot ledger. RLS and client/publisher permissions checked; pilot closed/zero, jobs zero. |
| Hosted SQL recovery fixture | PASS in one rolled-back transaction: claim/held competitor, fenced finish, exact replay, immutable terminal receipt, frozen-rate estimate, duplicate source and retained failed-spend cap. Synthetic references only; no Blob/provider operation and no cross-connection concurrency claim. |
| Hosted cleanup readback | PASS: zero translation jobs; closed zero budget; zero editorial articles/versions/content objects; all three article switches false. |
| Supabase advisors | No new security warning/error for translation objects. RLS/no-policy informational notices match intentional client denial. Existing auth/performance findings remain outside this change. |

Debugging caught the missing Subscribe canonical and missing optgroup label
translation. Both were corrected. English contact-form fixture compatibility was
restored by treating an absent browser dictionary as English fallback. English
destination links now use hreflang rather than incorrectly tagging translated link
text as English, with a visible notice and accessible description.

## Remaining deployed gates and exact access/action

1. The complete original private export and independent checksum/count receipt are
   unavailable. Supabase still has zero articles, versions and editorial objects.
   Provide the complete original SQLite/JSON export privately as described in
   `docs/platform/SUPABASE-CONTENT-IMPORT.md`; truncated table reads/public HTML cannot
   reconstruct a lossless export. No partial import was performed.
2. The Vercel connector still returns 404/not_found for the existing project
   `prj_d93TLitMYu8uYjqfgvgANuwsRJVK` in `team_QufgodCsuoarDSEhOJyWbUJF`.
   Restore connector visibility to this project in optagens-projects. Do not create
   a replacement project or paste secrets. Once access is restored, verify the
   already set secrets and approved model/cap/rate settings in provider configuration,
   then run the authorized paid pilot and hosted editorial/newsletter recovery suite.
   Credential presence alone does not supply the separate SQL cap/rate entries.
3. Review the actual generated pilot/page/message payloads with the supplied reviewers
   before any locale release. Actual viewport/keyboard and full Vercel/Blob/provider
   acceptance remain unverified; a local Chromium executable is unavailable.

Production, publication and article scheduling remain off. No paid model call,
translation release, new article publication or outgoing newsletter occurred.
The newsletter handler remains guarded; runtime delivery configuration is not
independently verified because project access is blocked.

Public deployment readback will be recorded separately after GitHub synchronization.

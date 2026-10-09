# Stage 7 durable model budget verification

Verified 2026-10-08 UTC (2026-10-07 Pacific). This completes the durable-budget
implementation component; it does not close the full unattended publisher gate.

## Implemented

- Three private RLS tables: operator-controlled daily/per-attempt caps, expiring
  approved model price ceilings, immutable UUID reservations and usage evidence.
- Scoped folkly_publisher RPCs only; no worker table CRUD, owner administration,
  service-role RPC access, or public HTTP generation trigger.
- A single configuration-row lock serializes reservations. Same-job replay is
  denied even after failure or a crash. Recovery records existing evidence;
  another model call requires a new attempt UUID and a fresh reservation.
- Full attempt cap remains charged against its Pacific-date budget after every
  outcome. No automatic refunds for timeouts or unknown provider charges.
- Price ceiling check uses 64,000 input tokens (48 KB research plus bounded
  system/schema overhead) and 6,000 output tokens. Prices must be explicit,
  conservative upper bounds and expire. No rates have been approved or seeded.
  Review bounds whenever prompts, schema, SDK or rolling model pricing change.
- generateBudgetedDraft supplies the durable RPC callbacks to the existing
  schema/source/music-validated adapter. Missing credentials, paused settings,
  invalid rates and storage errors fail closed. No live calls were made.
- Usage evidence stores model/snapshot and bounded token counts only. It is
  immutable after settlement and cannot be written with the wrong reservation.
  Reservations are budget accounting, not claims about actual provider billing.

## Evidence

Build: 59 public pages, four stories, private reserve excluded, no cron.
All npm test suites passed. npm audit --omit=dev: zero vulnerabilities.
Two local ledger/publisher checks passed; additional JWT-role denial and
paused wrapper checks passed. Includes cap exhaustion, missing/expired/excessive
rates, same-job replay, failed-spend retention, immutable settlement, token
fencing, anonymous/authenticated/service-role denial and storage outage.

Hosted migration applied to vxmyggasjgsiohqzzwzh. Isolated schema
folkly_budget_acceptance_20261008 used synthetic jobs only. Five concurrent
requests against a $1 fixture daily cap: one $1 reservation, four NULL denials.
Winner job 00000000-0000-0000-0000-000000000002. Same-job replay denied;
failed settlement and identical settlement retry completed successfully.
Further reservation denied with failed spend retained. Fixture dropped.
Independent readback: fixture absent, production reservations 0, rates 0,
daily/job caps 0, and all three production/publication/schedule switches false.
Hosted ACL readback: anon and service_role cannot reserve; worker cannot read
reservation tables. Existing public stories and old Site reserve untouched.

Security advisor: 22 INFO RLS-without-policy findings are intentional default
deny with client grants revoked. One Auth WARN: leaked-password protection
is disabled. This is not a clean full-platform security acceptance pass.
Remediation: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Remaining gate dependencies

- Securely issue and install a bounded-lifetime folkly_publisher credential;
  do not reuse SUPABASE_SECRET_KEY/service_role or owner sessions.
- Approve current conservative price ceilings and daily/per-job caps only when
  controlled evaluation is authorized. OPENAI_API_KEY is present in Vercel
  metadata; validity, funding and persona evaluation remain unverified.
- Persist editorial job/evidence integration, approved content commit and
  independent served-content readback. No publication commit endpoint exists.
- Owner SMTP quota/real sign-in, MFA, full lossless old Site export/import,
  isolated Vercel recovery and restore tests, and complete deployed acceptance.

All autonomous switches remain false. No recurring article schedule enabled.

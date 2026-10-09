# Translation Batch and bulk processing, 2026-10-09

The owner translation form now queues OpenAI Batch requests, with up to 12 public
source–language pairs. Bare `gpt-6-luna` and `openai/gpt-6-luna` IDs are accepted;
the exact identifier must match the separate approved pilot budget. The former
provider-prefix-only validator rejected the owner's bare Luna value.

All contracts and JSONL requests validate before atomic budget reservation.
The queue writes a durable submission fence before provider access. Each request
uses strict structured output, no reasoning, a 24,000-output-token ceiling,
and a unique UUID. A fixed-origin bounded transport uploads one JSONL file and
creates one asynchronous batch with a 24-hour window and 30-day output retention.
There is no provider retry, synchronous paid fallback, refund or automatic release.

Owner **Check batch** imports results by UUID, including partial/expired results.
Source/glossary/prompt hashes, placeholder/credit integrity and model receipts
validate before private create-only Blob persistence and independent readback.
Storage faults retain reservations and allow persistence-only recovery from the
same paid output. A 90-second lease prevents simultaneous imports; duplicate and
foreign output IDs hold the entire import. Lost creation responses reconcile with
provider metadata and manifest hash, never a second paid submission.

## Checks

- Build passes: 72 public pages and 11 published stories, publication disabled.
- Full regression suite passes, including existing translation jobs and six-language
  shared-page fixtures. New SQL/provider batch fixtures cover closed/default caps,
  total-cap denial, atomic duplicate rollback, concurrent claim denial, discounted
  frozen rates, bare model IDs, RLS/role/CSRF denial, lost creation receipts,
  out-of-order and expired/partial outputs, truncation, source changes, retained
  spend, private storage failures, replay and storage-only recovery.
- Actual owner HTML/client fixture passes: multiple source/language selection,
  12-pair limit, visible submission progress, double-click prevention, batch sync,
  paused readiness, and logout/late-response privacy.
- Every provider/Blob fixture is synthetic. No paid translation or mail sent.

## Hosted SQL evidence

Migration `20261009194655_translation_batch_queue.sql` applied successfully to the
existing Supabase project `vxmyggasjgsiohqzzwzh`. Readback confirms batch RLS=true,
anonymous and authenticated SELECT=false, anonymous batch claim=false,
service-role batch claim=true, zero batch rows, and pilot enabled=false.

Security advisors before/after show only the expected informational RLS/no-policy
notice on the new server-only table, plus the pre-existing leaked-password warning.
No public grants or SECURITY DEFINER functions were introduced. The existing
warning remediation is https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

The live pilot row remains disabled with blank model, zero caps/rates and an expired
approval window. Owner-reported approval is acknowledged; numeric approved caps
and expiry were not inferred. Existing Vercel project access remains blocked by
connector 404/403. No environment secret or provider account access was verified.
The article production/publication/schedule switches and translation release
manifest were not changed. Full paid hosted translation and language-review
acceptance remain outstanding.

## Setup and operation

Use the server-only OpenAI key and `FOLKLY_TRANSLATION_MODEL_ID=gpt-6-luna` in the
existing production deployment. Set the exact matching SQL budget model, approved
total/per-attempt cap and future pricing expiry. SQL approval prices must be
STANDARD USD-per-million: Luna input 0.10 and output 0.50, checked 2026-10-09.
Batch reservations/evidence snapshot half those rates, so do not halve the approval
row again. A $0.02 per-translation cap covers the conservative Luna Batch ceiling
of $0.016, but this example does not authorize spending or set a total pilot cap.

Queue the selected pairs, check the existing batch after processing, preview
verified private drafts, and obtain competent language review before any release.
Public reader requests use stored translations and never invoke the provider.

Sources: https://developers.openai.com/api/docs/guides/batch and
https://developers.openai.com/api/docs/models/gpt-6-luna.

# Translation configuration preparation, 2026-10-09 UTC

## Live changes and evidence

Prepared the existing Supabase project vxmyggasjgsiohqzzwzh singleton translation
budget with the user's selected bare model ID `gpt-6-luna` and verified STANDARD
prices: 0.10 input / 0.50 output USD per million. Batch snapshots half these rates.
Pricing reference: https://developers.openai.com/api/docs/models/gpt-6-luna
Prices were checked on 2026-10-09.

The guarded update required enabled=false, empty model, zero caps/prices and no
translation jobs or batches. It updated one row. A separate read confirms:
model gpt-6-luna; input 0.10; output 0.50; enabled=false; total_usd=0; job_usd=0;
valid_until=2026-10-09T03:19:24.640764Z; jobs=0; batches=0. No approval expiry or
numeric spending authorization was invented. All three autonomous article
switches were independently read as false.

## Remaining configuration

The owner already authorized a capped translation pilot and provided reviewers.
Its actual numeric total cap, per-attempt cap and future approval/pricing expiry
have not been supplied or configured. Before enabling only the independent pilot,
verify FOLKLY_TRANSLATION_MODEL_ID exactly matches gpt-6-luna and
FOLKLY_TRANSLATION_MAX_JOB_DOLLARS matches the approved per-translation reservation.
Existing server-only OpenAI and private Blob configuration must be verified.
A Luna Batch reservation must cover the conservative $0.016 ceiling per member;
$0.02 is a planning example, not an approved cap. Never halve SQL prices again.

Vercel still rejects runtime logs with 403 and exact project/environment metadata
lookup with 404. A direct owner acceptance attempt reached the site's email-code
form. The secure credential request timed out, and a fresh canonical owner-page
observation showed signed-out state. No authenticated acceptance, real editor
reply, paid translation, draft recovery or provider billing receipt is claimed.
Sign-in codes are handled only by the secure browser sign-in capability.

## Tests and scope

node scripts/test-translation-batches.mjs passed: atomic bulk limits, half-price
snapshots, authorization/RLS/CSRF, concurrency and duplicate fences, uncertain
submission reconciliation, partial/out-of-order/expired/truncated results, stale
sources, private storage verification, storage-only recovery and bounded provider
transport with no retries/refunds. Synthetic fixtures made no paid calls.

This update changes only the previously blank model/pricing configuration and
documentation. It does not release content, alter private reserve or image
credits, enable newsletter delivery or change the autonomous article switches.

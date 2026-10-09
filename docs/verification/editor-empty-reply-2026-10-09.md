# Owner editor empty-reply repair — October 9, 2026

## Finding and certainty

The supplied 2026-10-09 22:49:12.174 UTC record reports action chat, stage
provider, MODEL_EMPTY_REPLY and HTTP 503. The deployed adapter used the valid
chat-latest alias and max_completion_tokens=800. The endpoint rejected blank
text but discarded the provider finish reason and usage at this boundary.

Official OpenAI documentation says that max_completion_tokens covers visible
text and non-visible reasoning; a exhausted limit can produce no visible reply.
The actual installed SDK fixture reproduces a content:null/finish_reason:length
response with every completion token consumed by reasoning. A second distinct
SDK defect at the application boundary is reproduced: message.refusal is not
included in result.text, while response bodies are excluded by default in AI SDK
7. A valid refusal consequently looked like an empty model response.

Neither cause can be assigned conclusively to the supplied historical request:
that record lacks finish/usage, the scoped Vercel runtime-log query returns 403,
and no Vercel CLI executable is available. The available owner tab reports an
expired session, so no authenticated replay or fresh paid call was attempted.
These are supported, tested response-shape repairs rather than a claim that
every possible upstream empty completion is eliminated.

## Repair

- Preserve the latest chat-latest alias and modern completion parameter. Raise
  the total completion ceiling to 2,048 and request a direct answer of at most
  250 words, with larger requests handled section by section.
- Keep existing 6,000-byte message/12,000-byte prompt-history bounds, 30-second
  timeout, no tools, zero SDK retries and twenty $0.15 UTC daily reservations.
  Checked current prices are $5/$30 per million input/output tokens; a 13,000
  input-token allowance including framing plus 2,048 completion tokens estimates
  $0.12644, below one reservation. This is a conservative estimate at those
  prices, not an invoice guarantee or future alias-pricing guarantee.
- Reject length-truncated replies as MODEL_OUTPUT_LIMIT rather than recording
  partial content as complete. Give a shorter-answer/one-section instruction.
  Distinguish provider content filtering as MODEL_CONTENT_FILTER.
- Enable local SDK response-body inclusion solely to extract an explicit refusal
  when visible content is blank. Render that refusal through the existing private
  text-only response flow. Never display reasoning or bypass content filtering.
- For empty/length/filter failures, log only a fixed finish-reason allowlist,
  static completion ceiling and bounded integer token counts. Unknown strings,
  invalid counters, raw bodies, prompts, reasoning, headers and keys are omitted.
  Owner JSON keeps the existing fixed code/stage/correlation reference.
- Failed attempts/reservations remain retained. No automatic resend, fallback
  model/provider, budget reset, auth change or publication action is added.

## Verification

npm run build passes: 73 public pages, 11 stories, publisher disabled.
All 35 regression commands pass. A focused installed-SDK test also passes after
the final refusal-persistence assertion was added.

Actual pinned @ai-sdk/openai 4.0.87 / ai 7.0.131 transport tests confirm the latest
alias, modern token limit, pending-history exclusion, success usage and one
provider request with no retries. Reasoning-only output, visible partial text,
content filtering, blank stop and explicit-refusal response shapes are exercised.
Refusal becomes a complete private reply; failed outputs retain pending attempts,
return 503/no-store and reject a duplicate ID without a second reservation/call.
Client tests retain unsent input and display the two new fixed diagnostic codes.
Malicious diagnostic strings/fields and nonfinite/negative counts are redacted.
Existing authorization, CSRF, Blob privacy, logout and stale-response tests pass.

No real model generation or new private chat record occurred during this repair.
No article, reserve, source credit, translation budget, newsletter or autonomous
switch changed. Live owner replay needs a fresh normal sign-in; provider billing
and historical finish reason remain unverified. A successful deployment/readback
does not substitute for that authenticated generation check.

## Sources checked October 9, 2026

- https://developers.openai.com/api/docs/models/chat-latest
- https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create
- https://developers.openai.com/api/docs/guides/reasoning
- Installed SDK chat conversion/usage source and generateText include.responseBody
  documentation. npm reports ai 7.0.137 available; the pinned 7.0.131 is the same
  major and the reproduced boundary is repaired without a dependency migration.

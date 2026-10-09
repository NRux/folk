# Owner runtime readiness and verified idea saves

## Report and findings

Noah reported unresponsive editor chat, unavailable translation, uncertain idea
persistence and successful sign-out after the owner initialization repair.

The Vercel connector lists the correct team, but its project search returns zero
matching projects. Exact project lookup returns 404/not_found and runtime logs
return 403/forbidden. This is an access failure, not evidence of empty logs.
No environment values were retrieved or changed. No authenticated owner session
was available for live private write/readback or provider tests.

Read-only Supabase evidence confirms the translation pilot is disabled, with an
empty model, zero total/per-job budgets, zero input/output rates and an expired
approval window (2026-10-09T03:19:24.640764Z). No translation jobs exist. Provider
secrets alone cannot satisfy this independent ledger. Editorial article/version
counts remain zero and all three autonomous switches are false. No budget or
content record was changed during this investigation.

## Implemented repairs

- Idea writes require an uncached private readback matching the returned ETag and
  every saved field before acknowledging success. Ambiguous readback remains an
  explicit hold; unknown storage errors are no longer mislabeled as edit conflicts.
- Row-local progress, validation and verified success/error messages make Save
  visible. Unsaved rows survive workspace refreshes, chat refreshes and partial
  read failures. Field input remains intact on failed saves. Logout still clears
  private text; this is in-memory protection, not a new browser persistence store.
- Ideas and conversation history load independently. A failure in one section no
  longer erases the other. Editor loading errors and provider credential/quota/
  model/timeout/empty-output failures have bounded, non-secret explanations.
- The protected editor readiness response names missing activation/provider/Blob
  configuration without returning its values. Sending shows immediate progress.
- Translation readiness now checks the actual independent SQL budget, approval
  expiry, model match, pricing/token ceiling, provider and Blob configuration.
  Unavailable generation is disabled in the UI and rejected before a model call.
  Private saved-draft recovery remains independent of the generation activation.

## Validation

Build passed: 72 public pages, eleven published stories. All 32 regression
commands passed. Focused cases cover authenticated idea write/readback, unreadable
or mismatched saved content, storage outage versus conflict, partial panel failure,
unsaved-row refresh, input retention, chat progress/errors, no-call paused pilot,
configuration redaction and logout/late-response isolation. Provider, Blob and
owner interactions are fixtures; no hosted private write, paid call, email or
translation release is claimed. No public story or private reserve was changed.

## Remaining activation work

Grant the Vercel connection project access to the existing
`prj_d93TLitMYu8uYjqfgvgANuwsRJVK` in `optagens-projects`, or inspect/configure its
production settings directly. Confirm the already supplied OpenAI/private Blob
credentials and `FOLKLY_EDITOR_CHAT_ENABLED=true`, then redeploy. Secrets belong
only in provider settings. The editor uses the valid `chat-latest` alias confirmed
against [official OpenAI documentation](https://developers.openai.com/api/docs/models/chat-latest).

Match the translation deployment model/cap to the separately approved pilot model,
total/per-attempt caps, current pricing and expiry in Supabase. Those approved
values are not present in the current ledger; they must be reconciled before any
paid attempt. Keep autonomous production/publication/article scheduling disabled
while hosted provider, persistence and recovery acceptance remains incomplete.

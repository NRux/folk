# Owner POST 503 investigation, 2026-10-09

Owner-supplied production records show translation POST 503 at 12:48:17 PDT,
owner GET 200 at 12:48:33, and workspace POST 503 at 12:49:15. These status-only
records contain no response body, provider error or failure stage. Successful
owner reads are consistent with working sign-in. The application's private
POST authorization failure normally returns 401, not 503; do not weaken auth.

## Translation findings and implemented repair

- The previous translation model validator required `provider/model` and rejected
  the advised `gpt-6-luna` value. The Batch implementation accepts bare Luna IDs
  and OpenAI-prefixed IDs. This defect is fixed in commit
  `6e05a90720471686f471a4a1f3212ffbc78c9137`, deployed successfully by Vercel.
- Live Supabase readback confirms the independent pilot row is still disabled,
  model blank, caps and pricing zero, expiry 2026-10-09T03:19:24Z. Secrets alone
  do not populate that row. Those conditions cause deliberate configuration 503
  responses before any paid model call. They are a confirmed blocker, though
  the supplied status-only record cannot identify which check that request hit.
- Preserve the owner's previously reported pilot/model approval and reviewers.
  Enter its actual approved total/per-attempt limits and future pricing expiry,
  with model exactly matching `FOLKLY_TRANSLATION_MODEL_ID`. Luna STANDARD prices
  checked 2026-10-09 are input 0.10 / output 0.50 USD per million; Batch snapshots
  half. Numeric approval values were not invented and spending remains disabled.

## Workspace findings and diagnostic repair

Workspace POST 503 can occur at configuration, pending-attempt save, daily budget
reservation, private chat-history read, provider call, or reply read/save. Existing
response messages already distinguish several provider statuses, but the supplied
request log omits those messages and the failure stage.

The server now emits only fixed diagnostic codes, stage, action, HTTP status and
an application-generated correlation UUID. Responses include that same UUID.
No prompt, idea contents, raw provider error, API key, session or email is logged.
Budget exhaustion has a distinct `BUDGET_EXHAUSTED` code and explains the next
UTC budget-day boundary. A reservation failure stops before any model call.
Provider codes distinguish credentials, 400 request rejection, 404 unavailable
model, rate/quota limit, timeout and empty output. Blob codes distinguish access,
missing/suspended store, rate limit and outage. Attempts and spend holds remain.

Translation configuration/submission/import failures now also emit safe phase,
code and correlation UUID rather than an empty function log. Public/error status
semantics and owner authorization are unchanged.

Vercel runtime log read still returns 403; decrypt=false environment metadata
read returns 404 for the supplied existing project/team. The CLI is not installed
or authenticated here, and no signed-in owner tab is available in the accessible
browser. Therefore the actual workspace failure is NOT confirmed as an invalid
key, exhausted budget, model outage, missing Blob connection or timeout. No
credential/configuration change was guessed. Use the newly emitted code/stage
and UUID in the next failed attempt to identify the specific remedy, or restore
connector access to the existing project for direct runtime inspection.

## Verification

Build passes: 72 public pages and 11 stories. Full regression passes for the Batch
implementation. After adding diagnostics, focused workspace/server/client,
owner response-race/real HTML, Batch server/client, translation UI and private
job tests pass. New tests simulate all failure stages, assert no paid call after
budget/history failure, verify fixed-code allowlisting and correlation, and prove
owner prompts and secret/error text do not enter responses or logs.

No paid model call, newsletter, translation/article release, private-record edit,
secret change or autonomous-switch activation occurred.

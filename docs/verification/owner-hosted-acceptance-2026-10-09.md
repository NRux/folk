# Owner hosted acceptance, 2026-10-09 UTC

## Runtime findings and repairs

A secure owner sign-in completed in the live Folkly dashboard. Existing private
idea, chat, subscriber and contact records were readable. One existing idea was
saved without changing its contents; the owner UI acknowledged independent
private readback with "Saved and verified." Draft storage remains empty in the
editorial SQL catalog, so imported editorial draft acceptance remains blocked.

The deployed build had two Subscribers sections with duplicate DOM IDs. The source
template already included the section, while the static build inserted it again.
Removed the build insertion. Full regression now asserts all deployed owner IDs
are unique and exactly one subscriber section exists. Public HTTP readback of
owner HTML and workspace script matches the tested build byte for byte after
deployment propagation; the authenticated browser also shows one subscriber
section.

The first editor check failed with a correlation reference but no visible code.
The server already returned safe code/stage fields; the browser discarded them.
The client now displays only allowlisted diagnostic codes and stages alongside
the existing message and reference. Unknown provider strings are omitted; no
raw provider body, keys or user inputs are added to diagnostic output.

A subsequent current-build check returned MODEL_REQUEST_REJECTED (provider),
confirming an OpenAI HTTP 400 after durable attempt/budget/history stages.
Inspected the installed @ai-sdk/openai 4.0.87 source: model capability detection
recognizes gpt-* families, but not the valid chat-latest alias. Its standardized
maxOutputTokens therefore serialized the legacy max_tokens field for that alias.

Replaced that option with documented providerOptions.openai.maxCompletionTokens,
preserving the actual 800 completion-token ceiling, chat-latest model selection,
30-second deadline and zero automatic retries. Extracted the adapter into
server/editor-model.js for a test using the actual installed SDK and intercepted
synthetic transport. It proves the outgoing request uses max_completion_tokens
and omits max_tokens, preserves usage readback and never retries a provider 400.
The parameter incompatibility is a supported explanation; definitive live outcome
is recorded separately below.

Official references checked 2026-10-09:
- https://developers.openai.com/api/docs/models/chat-latest
- https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create
The alias remains the latest ChatGPT Instant model. No model downgrade, gateway
migration, secret rotation, added provider or weakened authentication occurred.

## Tests and release scope

npm run build passes: 73 public pages, 11 stories, publisher disabled.
All 34 npm test commands pass after both repairs, including SDK wire transport,
private-record verification, duplicate DOM denial, fixed diagnostic allowlisting,
authorization/CSRF, retention of failed spend, late response/logout isolation,
translation Batch fences and storage-only recovery.

Implementation commits:
- 3278ad69906b86202366dc7cd93f00ac409ad06c: visible diagnostic/unique subscriber fix.
- 9b6cc80d95f40256a015030178dab77a51a26fa2: modern completion token parameter.
Both have successful Vercel deployment status and were synced with expected-SHA
leases to main/master. Concurrent map work remains preserved.

No translations were generated or released. Translation SQL readback remains
disabled with model gpt-6-luna, standard prices 0.10/0.50, zero total/per-attempt
caps, expired approval and zero jobs/batches. All three autonomous article
switches remain false. Newsletter delivery remains paused. Failed editor
reservations are retained, not reset or refunded; provider invoices were not
available and no zero-cost claim is inferred from rejected requests.

Remaining runtime access limitation: Vercel log queries still return 403 for the
existing project. Owner diagnostics provide direct evidence without those logs.
Actual approved translation numeric caps/expiry, full original content export,
hosted editorial/newsletter/recovery gates and competent translation output review
remain separate. Google Cloud setup stays deferred.

## Definitive live outcome after the parameter repair

The next bounded owner editor check completed successfully. A real interview
question appeared in the private history and the input cleared. The subsequent
workspace history read displayed the same stored reply with "Editor ready."
This closes the observed editor POST 503/request-compatibility defect and proves
provider generation plus reply persistence/readback for this flow. Three earlier
checks remained pending after provider rejection; their spend reservations were
preserved. Four live editor attempts were made during this investigation, with
one successful reply. Actual provider billing remains unavailable.

A private screenshot of the working owner editor was saved for Noah outside Git.
No owner chat content, subscriber addresses or other private record contents were
committed. Existing idea-save/readback and subscriber rendering acceptance passed;
publication, imported editorial drafts, translation output/recovery and newsletter
acceptance are not inferred from this editor result.

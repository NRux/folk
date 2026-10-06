# Stage 05 — Admin control room verification

Date: 2026-10-06

## Authorization

Every admin page and API operation checks the server-provided Sites identity. The user ID must match the explicitly configured owner ID; a signed-in visitor alone is insufficient. Local/direct-server access fails closed unless the trusted Sites proxy is enabled. Background jobs use a separate bearer credential and an explicit scope; that credential is not accepted as an owner session.

| Action | Anonymous | Signed-in non-owner | Owner |
|---|---:|---:|---:|
| Read the admin dashboard or a private article record | 401 | 403 | 200 |
| Edit a draft | 401 | 403 | 200; creates a new version and queues revalidation |
| Unpublish an article | 401 | 403 | 200; records the owner action |
| Change settings | 401 | 403 | 200; validates values and records the change |
| Publish now | 401 | 403 | 202; records explicit intent and queues a job, but does not publish until Stage 06 supplies the publisher |

The test also confirms that a cross-origin settings write is rejected, missing trusted-proxy configuration fails closed, and a job bearer token cannot authorize an interactive owner action.

## Dashboard and controls

- Next publication uses a Pacific wall-clock conversion and displays the Pacific time-zone abbreviation.
- Today's slot and outcome, next article, ready reserve count, recent job failures, and ledger spend are read from SQLite.
- Automatic production/publication indicators read the scheduler registry. Since Stage 06 has not installed that registry yet, the dashboard says the state is unavailable instead of inferring it from configuration switches.
- The control room includes calendar and pipeline holds, isolated draft preview, editing, source and image-credit ledgers, verification and claim records, persona status/brief history/slot balance, topic exclusions and assignments, schedule overrides, pause/resume, failed-step retry, tomorrow replacement, version comparison/restore, unpublish, correction notes, and schedule/model/budget/length/editorial-policy settings.
- Factual edits create a new version, preserve sources while remapping claim citations, invalidate prior verification for that version, move the article to verification, and queue a revalidation job. Edited HTML is sanitized before storage.
- Topic exclusions are applied during pitch scoring. Explicit owner publish requests and retries are persisted as jobs with actor and reason details.

## Verification

Passed:

- node web/scripts/test-stage05-admin.js — authorization matrix, loopback server routes, same-origin writes, dashboard values, controls, audit records, edit/revalidation, version restore/compare, source/citation preservation, and unsafe-markup filtering.
- node --check for web/lib/admin-auth.js, web/lib/admin.js, web/server.js, web/lib/calendar.js, and web/lib/pipeline.js.
- Stage 04 focused security test.
- Stage 04 prepared acceptance run: 29/29 checks passed after the Stage 05 policy/exclusion integration.

The HTTP route test supplies controlled identity headers; it does not deploy the control room or configure production runtime values. Before activation, the Site runtime must set FOLKLY_TRUSTED_AUTH_PROXY=sites and FOLKLY_OWNER_USER_ID from the owned Site identity. No owner ID, job credential, or other secret is committed. Stage 06 must install the scheduler registry, revalidation worker, and publication execution path; until then, the dashboard reports automation state as unavailable and publish-now requests remain queued and unpublished.

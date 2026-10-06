# Stage 06 — Scheduling and publication verification

## Platform inspection

Confirmed on 2026-10-06: the existing Folkly Site is public and active, but its published
version has no MCP server declaration, so there is no Site MCP publishing/source tool for a
linked schedule to invoke yet. Sites provides a linked-schedule capability. No schedule was
created or activated in this stage; Stage 08 activation remains gated on Stage 07 acceptance.

## Automated checks

Run with Node 24:

```powershell
node web/scripts/test-stage06-scheduler.js
```

Result: PASS. The test uses separate Node worker threads and SQLite connections for a
simultaneous same-date publication attempt.

- DST: 2026-03-07 and 2026-03-09 straddle spring-forward; 2026-10-31 and 2026-11-02
  straddle fall-back. All four resolve to 07:00 America/Los_Angeles with offsets GMT-8,
  GMT-7, GMT-7, and GMT-8 respectively.
- Concurrency: two simultaneous publisher workers yield one published slot and one article.
- Lost response: simulated timeout after commit followed by retry returns
  `already-published`; the separate readback confirms the same version and hash.
- Provider unavailable: stores retryable failure, leaves content untouched, creates an open
  in-app alert, and enforces retry backoff.
- Empty reserve: the ready candidate fails source eligibility, so publication does not happen;
  the slot and alert retain the honest failure reason.
- Not due: invocation before the configured local release time publishes nothing.

The runner and dashboard use persisted SQLite state. The one-shot runner deliberately treats the
public Site publisher as unavailable; the transaction-level publisher in the isolated harness
verifies database guarantees only. Stage 06 does not claim that the static Site has been updated
or that this CLI is unattended production scheduling. The deployment boundary, separate source
access check, and Stage 08 activation procedure are in `docs/platform/SCHEDULING.md`.

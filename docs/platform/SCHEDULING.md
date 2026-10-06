# Folkly scheduling and publication

## Current execution mechanism

The repository provides a persisted, one-shot Node runner at `web/scripts/run-scheduler.js`.
It reads and writes the SQLite publication-slot registry and is intended to be invoked by a
durable scheduler. It does not start an in-memory timer, browser poller, local cron service, or
background process. A developer can run it manually for verification, but manual execution is
not unattended scheduling.

The production Site currently has no declared MCP server endpoint (the Sites read returned
“published Site does not declare an MCP server”). The one-shot runner’s default provider adapter
is deliberately unavailable: its SQLite transaction is a tested persistence boundary, not a claim
that the public static Site has been updated. Sites exposes a linked-schedule capability, but
there is not yet a Site MCP tool that can invoke a publishing adapter. Therefore the recurring
production schedule remains inactive and the runner refuses to claim a live release. Stage 08 must publish the MCP-enabled Site version and
connect a Sites-linked schedule only after Stage 07 acceptance passes. Keep the current Site
ID, public audience, and URL unchanged.

The durable trigger should invoke two isolated jobs: (1) `web/scripts/run-replenishment.js` early
enough to prepare validated articles without blocking release, and (2) the publisher at
07:00 every day in `America/Los_Angeles`. The runner resolves the current local calendar date
using the IANA timezone database, so DST changes do not shift the local release hour. Site
scheduler configuration must use a timezone-aware daily trigger and must not replay prior
dates as a backlog.

## Publication guarantees

- `publication_slots.slot_date` is unique. A `BEGIN IMMEDIATE` transaction serializes
  publishers. Within that transaction the runner rechecks the slot outcome, article's latest
  version, ready state, source and claim links, disclosure, and editorial check failures.
- A publication updates the slot, article status and homepage cover in one transaction.
  Newer owner edits cannot be overwritten because selection and the latest-version check take
  place after the transaction obtains its write lock.
- A retry after a lost response reads the already-published slot and returns the stored
  article/version. It cannot publish a second article for that date.
- A separately executed readback reads the stored article/version and status, computes a
  SHA-256 content hash, and records its timestamp on the slot.
- The runner considers only today's Pacific date. It never drains past dates. A late same-day
  release records delay seconds; empty reserve and provider failure leave the existing site
  intact, persist a retryable state, and create an in-app admin alert. Retry state has a five
  minute backoff. The owner dashboard shows scheduler runs, missed/retryable slots, and open
  alerts.
- Budget reservations remain enforced by the existing provider ledger under SQLite write
  locks. Ready reserve publication does not make a new provider call. Production stops when
  either configured cap is exhausted.

## Configuration and operation

Defaults are `schedule.publish_time=07:00`, `site.timezone=America/Los_Angeles`,
`budget.daily_usd=5`, `budget.monthly_usd=100`, and `reserve.target=7`.
The schedule setting is owner-editable. The replenisher dispatches queued pitches to the resumable
Stage 04 pipeline, stops at the configured reserve target, serializes pitch claims, and stops new
production when provider-ledger budget reservations report either cap exhausted. UTC timestamps are persisted for execution; slot dates
are Pacific local dates. `FOLKLY_DB` selects the database file. The checked-in runner keeps the publisher unavailable until Stage 08 wires a supported server-side
publishing adapter and health check; until then it records “publisher unavailable” and does not
claim a live release. Never put provider credentials in command arguments, URLs, source control, logs,
or article records.

Manual local diagnostics (not unattended operation):

```powershell
$env:FOLKLY_DB = "C:\path\to\folkly.db"
node web/scripts/run-replenishment.js
node web/scripts/run-scheduler.js
```

The replenisher dispatches queued work through the resumable Stage 04 pipeline until the
validated reserve target is reached or the queue/budget prevents more work. It uses an
independent persisted production-run record and serializes pitch claims.

A response with `state=disabled` means the owner has not enabled the schedule and publication
switches (the safe default); `state=not-due` means before today's configured time. A failure exit
code and persisted retryable state are not a successful publication.

## Stage 08 deployment path

1. Preserve the existing Site identity and audience. Add the stateless `/mcp` publishing
   endpoint to the Site source, declare MCP in the hosting manifest, and use the supported
   Sites OAuth identity. Keep the editorial publisher scope separate from owner administration.
2. Verify a read-only MCP initialize/tool-list call and a harmless source-read call before
   creating any recurring task. Verify the trigger's source authorization separately from
   checking that the public website URL is reachable: a public HTTP 200 proves website
   reachability only, not scheduler source access.
3. Save and deploy the exact verified Site source version. Read the deployment state and test
   public content readback with no browser session.
4. Only after Stage 07 acceptance is green, create a Sites-linked, America/Los_Angeles daily
   publication schedule at 07:00 and a separate early replenishment schedule. Read back both
   persisted schedule records and perform a controlled one-shot invocation. Do not make
   catch-up tasks for older dates.
5. Keep automatic production and publication switches off until those checks and owner-scoped
   configuration are verified. Set credentials only in supported server-side configuration.

A schedule is considered active only when the platform's persisted schedule record and last
source invocation both read back as enabled/successful. This stage leaves it inactive.

# Folkly Platform Architecture (Stage 02)

## Overview

As of 2026-10-07 the existing public Site at
`https://folkly-journal.nrapp.chatgpt.site` runs an asynchronous Worker with D1 storage.
It contains four published legacy stories and seven unpublished reviewed reserve stories.
The Site source is separately versioned at `f2cf470865ee4e5e07c186826fec3fdc9e1d82c9`;
the Node/SQLite repository remains the pipeline development and test implementation.
The Site's owner-gated `/admin`, `/api/admin`, and `/mcp` are deployed, but the model provider,
hosted replenishment, authenticated unattended connection and recurring schedule are not active.

### Local Node implementation

Folkly now runs as a zero-dependency Node.js server (Node 24, `node:sqlite` built-in) backed
by a SQLite content store. All reader-facing content is rendered from durable records —
nothing generated per-request from git-tracked prose. Routine publication updates content
records in the database; no git commit or full-site redeploy is required per article.

```
┌─────────────────────────────────────────────────────────────┐
│                    web/server.js (Node http)                │
│  routes: /, /<slug>, /<slug>.html, /perspective, /about,   │
│          /style.css, /assets/*, /admin (stage 05)          │
├─────────────────────────────────────────────────────────────┤
│  web/lib/render.js  — HTML rendering (live-site skeleton)   │
│  web/lib/db.js      — schema, settings, audit (adapter)     │
├─────────────────────────────────────────────────────────────┤
│  web/folkly.db (SQLite, WAL)   ← D1 stand-in               │
│  web/static/assets/* (files)   ← R2 stand-in               │
└─────────────────────────────────────────────────────────────┘
```

## Local implementation versus the live Site

| Component | Repository implementation | Deployed Site and remaining work |
|-----------|------------------|----------------------------------|
| Content store | Synchronous `node:sqlite` in a local DB ignored by git | D1 schema and filtered content deployed; conditional batch publication locally verified, hosted write/readback still open |
| Image assets | Files under `web/static/assets/` | Existing images and CSS served as static assets with preserved credits; no R2 binding used |
| Server runtime | Node HTTP listener on a configurable port | Worker reader and owner/MCP routes deployed from separate Site source |
| Scheduling | Persisted local one-shot runners | No linked automation; hosted pipeline and production model still need implementation |
| Auth / owner role | Server-side checks in Node, with a trusted-proxy setting | Deployed anonymous/forged-header denial verified; authenticated owner session and unattended MCP connection still need verification |

The live Site has a separate source repository and does not run this Node server.
Its reader and limited admin/publisher port uses async D1 calls. The Node research pipeline,
full owner editorial controls, and scheduler have not been ported. A deployed runtime is not
evidence of autonomous publication; see `docs/verification/acceptance-report.md`.

## Data model (web/lib/db.js SCHEMA)

- `personas` / `persona_briefs` — five editorial personas, versioned briefs (stage 03)
- `pitches` / `assignments` — editorial calendar inputs with scoring reasons (stage 04)
- `articles` — one row per article: slug, title, deck, persona link, place/country/category,
  status, word_count, reading_minutes, home composition fields, content_hash
- `article_versions` — immutable versions; content_json holds eyebrow, deck, byline,
  figure, toc, body_html (trusted, sanitized at ingest), sources, note
- `page_blocks` — stored pages (perspective, about) as main_html
- `sources` — per-version source records (title, org, url, publisher, type)
- `claim_citations` — claim-to-source ledger (stage 04)
- `media_assets` — file_path, original_url, creator, license, license_url, attribution,
  caption, alt_text, sha256
- `editorial_checks` — verification results (stage 04)
- `publication_slots` — unique per slot_date; atomic publish target (stage 06)
- `jobs` / `job_steps` — durable job tracking (stage 06)
- `settings` — schedule, budgets, lengths, policy (stage 04/06)
- `audit_events` — append-only actor/action/reason trail

## Start command

```
node web/server.js          # http://localhost:8787
FOLKLY_PORT=9000 node web/server.js
FOLKLY_DB=/path/to/db node web/server.js
```

## Migration (idempotent)

```
node web/scripts/migrate.js
```

Parses `docs/preservation/raw/*.html` (stage 01 captures) into the store. Guard: records are
only inserted/updated when content_hash differs from the stored hash; a second run reports
"Records changed: 0". Verified in `docs/verification/stage-02-url-check.md`.

## URL parity

Both `/<slug>` and `/<slug>.html` resolve with identical content (server normalizes
`.html` off the slug). Canonical form is the `site.canonical_form` setting (currently
`html` to match the live site's existing canonicals; the spec's "actual live domain"
requirement is enforced via `site.canonical_domain` — see NOTES.md stage 01, open question
1 on which subdomain is authoritative).

## What publication looks like (stage 04/06)

1. Pipeline (stage 04) writes `article_versions` + `sources` + `media_assets` +
   `editorial_checks`; sets `articles.status = 'ready'`.
2. Scheduler (stage 06) resolves today's America/Los_Angeles slot, atomically claims the
   `publication_slots` row for that date, rechecks gates, flips `status='published'`.
3. The local server renders from the store on the next request. The Site reader now renders
   D1 published records; a hosted authenticated publication has not been executed.

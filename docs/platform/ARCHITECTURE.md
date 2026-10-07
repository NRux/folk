# Folkly Platform Architecture (Stage 02)

## Overview

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

| Component | Repository implementation | Required live Site migration |
|-----------|------------------|----------------------------------|
| Content store | Synchronous `node:sqlite` in a local DB ignored by git | D1 async queries, schema/data migration, transactional publication equivalent |
| Image assets | Files under `web/static/assets/` | Static assets or R2 with verified credit/permission mapping |
| Server runtime | Node HTTP listener on a configurable port | Cloudflare-compatible ESM Worker `fetch` handler in the separate existing Site source repository |
| Scheduling | Persisted local one-shot runners, production publisher unavailable | Site-linked triggers and a deployed authenticated publisher with independent readback |
| Auth / owner role | Server-side checks in Node, with a trusted-proxy setting | Verified Site identity propagation and owner/job scope enforcement in deployed runtime |

The current live Site is a separate static source repository and does not run this Node server.
`web/server.js` uses Node HTTP and synchronous SQLite calls throughout rendering, pipeline,
admin, and scheduling. D1 is asynchronous, so changing `db.js` alone cannot deploy it. A real
port must adapt request handling and all database call sites, migrate the preserved content and
version/claim ledgers, bind Site storage and auth, and run the same acceptance tests against the
deployed Worker. No production deployment or autonomous publication is implied by local tests.

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
3. The local server renders from the store on the next request. A live Site will need its own
   verified runtime and storage migration before it can exhibit this behavior.

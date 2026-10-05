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

## Real vs stand-in

| Component | This environment | Real Sites deployment (stage 08) |
|-----------|------------------|----------------------------------|
| Content store (structured records) | SQLite via `node:sqlite` (WAL mode, FKs on) | Sites D1 (same relational model; swap in db.js) |
| Image assets | Files under `web/static/assets/` (git-tracked originals) | R2 buckets (swap file reads in server static handler) |
| Server runtime | Node http server, port 8787 (config: FOLKLY_PORT) | Sites server runtime (same server.js entry) |
| Scheduling | Not yet (stage 06 builds durable job runner) | Verified supported Sites scheduler |
| Auth / owner role | Not yet (stage 05) | Platform auth + owner role verification |

**db.js is the adapter boundary**: schema SQL, settings defaults, and audit writes are
isolated there. When D1/R2 become available, the content code (render.js, pipeline, admin)
stays unchanged; only db.js's openDb and the static asset handler change.

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
3. Server renders from the store on the next request. No git, no redeploy.

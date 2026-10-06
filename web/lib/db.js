"use strict";
// Folkly content store: SQLite (node:sqlite) behind a thin adapter that can later be
// swapped for Sites D1/R2 bindings without changing content code.
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS personas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  bio_public TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  subject_tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS persona_briefs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  persona_id TEXT NOT NULL REFERENCES personas(id),
  version INTEGER NOT NULL,
  brief_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(persona_id, version)
);
CREATE TABLE IF NOT EXISTS pitches (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  persona_id TEXT,
  place TEXT,
  practice TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  score REAL,
  reason TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  pitch_id TEXT REFERENCES pitches(id),
  persona_id TEXT,
  article_id TEXT,
  slot_date TEXT,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  deck TEXT,
  persona_id TEXT,
  byline_legacy TEXT,
  place_label TEXT,
  country TEXT,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  word_count INTEGER,
  reading_minutes INTEGER,
  is_cover INTEGER NOT NULL DEFAULT 0,
  home_position INTEGER,
  home_short TEXT,
  home_place TEXT,
  home_eyebrow TEXT,
  home_dek TEXT,
  home_figure_src TEXT,
  home_figure_alt TEXT,
  home_figure_style TEXT,
  home_figure_w TEXT,
  home_figure_h TEXT,
  next_story_slug TEXT,
  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS article_versions (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES articles(id),
  version INTEGER NOT NULL,
  content_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(article_id, version)
);
CREATE TABLE IF NOT EXISTS page_blocks (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  meta_description TEXT,
  main_html TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  article_version_id TEXT NOT NULL REFERENCES article_versions(id),
  ord INTEGER NOT NULL,
  title TEXT NOT NULL,
  org_author TEXT,
  url TEXT NOT NULL,
  pub_date TEXT,
  retrieved_at TEXT,
  lang TEXT,
  publisher TEXT,
  source_type TEXT,
  independence_rank INTEGER,
  supports_claims TEXT,
  excerpt TEXT,
  UNIQUE(article_version_id, ord)
);
CREATE TABLE IF NOT EXISTS claim_citations (
  id TEXT PRIMARY KEY,
  article_version_id TEXT NOT NULL REFERENCES article_versions(id),
  claim TEXT NOT NULL,
  source_ids TEXT NOT NULL DEFAULT '[]',
  kind TEXT NOT NULL DEFAULT 'fact',
  verified INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL UNIQUE,
  original_url TEXT,
  creator TEXT,
  license TEXT,
  license_url TEXT,
  attribution TEXT,
  downloaded_at TEXT,
  sha256 TEXT,
  caption TEXT,
  alt_text TEXT,
  asset_kind TEXT NOT NULL DEFAULT 'photo',
  notes TEXT
);
CREATE TABLE IF NOT EXISTS editorial_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_version_id TEXT NOT NULL REFERENCES article_versions(id),
  check_name TEXT NOT NULL,
  check_type TEXT NOT NULL,
  result TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS publication_slots (
  id TEXT PRIMARY KEY,
  slot_date TEXT NOT NULL UNIQUE,
  article_version_id TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  published_at TEXT,
  published_by TEXT,
  note TEXT
);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt INTEGER NOT NULL DEFAULT 0,
  next_run_at TEXT,
  last_run_at TEXT,
  error TEXT
);
CREATE TABLE IF NOT EXISTS job_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  step_name TEXT NOT NULL,
  status TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 1,
  detail TEXT,
  at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_sources_av ON sources(article_version_id);
CREATE INDEX IF NOT EXISTS idx_checks_av ON editorial_checks(article_version_id);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_events(at);
CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);
`;

function openDb(file) {
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 10000;"); // concurrent pipeline runs: wait for writes instead of failing
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  ensureColumns(db);
  migrateLegacyCitationOrdinals(db);
  return db;
}


// Stage 04: older runs stored 1-based source ordinals in claim_citations.source_ids.
// Normalize those legacy rows to the source table's stable IDs so resumed runs and
// audits can resolve citations consistently. Invalid references are left untouched
// for the publication gates to reject.
// Stage 04: older runs stored 1-based source ordinals in claim_citations.source_ids.
// Normalize those legacy rows once, so resumed runs and audits can resolve citations
// consistently. Invalid references are left untouched for the publication gates to reject.
function migrateLegacyCitationOrdinals(db) {
  const migrationId = "stage04.claim-citations-stable-ids.v1";
  db.exec("BEGIN IMMEDIATE");
  try {
    if (db.prepare("SELECT 1 FROM schema_migrations WHERE id = ?").get(migrationId)) {
      db.exec("COMMIT");
      return 0;
    }
    const sourceRows = db.prepare("SELECT id, article_version_id, ord FROM sources ORDER BY article_version_id, ord").all();
    const sourcesByVersion = new Map();
    for (const source of sourceRows) {
      if (!sourcesByVersion.has(source.article_version_id)) sourcesByVersion.set(source.article_version_id, []);
      sourcesByVersion.get(source.article_version_id).push(source);
    }
    const updates = [];
    const claims = db.prepare("SELECT id, article_version_id, source_ids FROM claim_citations").all();
    for (const claim of claims) {
      let refs;
      try { refs = JSON.parse(claim.source_ids || "[]"); } catch { continue; }
      if (!Array.isArray(refs) || !refs.length) continue;
      const sources = sourcesByVersion.get(claim.article_version_id) || [];
      const idSet = new Set(sources.map((source) => source.id));
      if (refs.every((ref) => typeof ref === "string" && idSet.has(ref))) continue;
      const byOrd = new Map(sources.map((source) => [source.ord, source.id]));
      const converted = refs.map((ref) => {
        if (typeof ref === "string" && idSet.has(ref)) return ref;
        if (typeof ref !== "number" && !(typeof ref === "string" && /^\d+$/.test(ref))) return null;
        const ord = Number(ref);
        return Number.isSafeInteger(ord) ? byOrd.get(ord) || null : null;
      });
      if (converted.every(Boolean)) updates.push({ id: claim.id, source_ids: JSON.stringify(converted) });
    }
    const update = db.prepare("UPDATE claim_citations SET source_ids = ? WHERE id = ?");
    for (const row of updates) update.run(row.source_ids, row.id);
    if (updates.length) {
      audit(db, "schema-migration", "claim-citations-ordinals-to-ids", "claim_citations", null, `converted ${updates.length} legacy citation rows`);
    }
    db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)").run(migrationId, new Date().toISOString());
    db.exec("COMMIT");
    return updates.length;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

// Additive migration (idempotent): stage 04 pipeline fields.
function ensureColumns(db) {
  const articleCols = db.prepare("PRAGMA table_info(articles)").all().map((r) => r.name);
  const wants = [
    ["pipeline_state", "TEXT NOT NULL DEFAULT 'pitch'"],
    ["revision_attempts", "INTEGER NOT NULL DEFAULT 0"],
    ["hold_reason", "TEXT"],
    ["score", "REAL"],
    ["score_reason", "TEXT"],
  ];
  for (const [col, def] of wants) {
    if (!articleCols.includes(col)) db.exec(`ALTER TABLE articles ADD COLUMN ${col} ${def}`);
  }
  // Stage 04: pitch slug (stable article slug) + country (geographic balance).
  const pitchCols = db.prepare("PRAGMA table_info(pitches)").all().map((r) => r.name);
  const pitchWants = [
    ["slug", "TEXT"],
    ["country", "TEXT"],
    ["deck", "TEXT"],
  ];
  for (const [col, def] of pitchWants) {
    if (!pitchCols.includes(col)) db.exec(`ALTER TABLE pitches ADD COLUMN ${col} ${def}`);
  }
}

const DEFAULTS = {
  "site.canonical_domain": "folkly-journal.nrapp.chatgpt.site",
  "site.timezone": "America/Los_Angeles",
  "schedule.publish_time": "07:00",
  "schedule.enabled": "false",
  "production.autonomous_enabled": "false",
  "publication.autonomous_enabled": "false",
  "budget.daily_usd": "5",
  "budget.monthly_usd": "100",
  "article.length_min": "900",
  "article.length_typical_min": "1200",
  "article.length_typical_max": "1800",
  "article.length_max": "2200",
  "reserve.target": "7",
};

function settingsGetAll(db) {
  for (const [k, v] of Object.entries(DEFAULTS)) {
    db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO NOTHING").run(k, v, new Date().toISOString());
  }
  const rows = db.prepare("SELECT key, value FROM settings").all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

function audit(db, actor, action, entity, entityId, reason) {
  db.prepare(
    "INSERT INTO audit_events (at, actor, action, entity, entity_id, reason) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(new Date().toISOString(), actor, action, entity ?? null, entityId ?? null, reason ?? null);
}

module.exports = { openDb, settingsGetAll, audit, DEFAULTS };

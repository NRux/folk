-- Folkly schema for Sites D1. Schema only; unpublished content is imported privately.
CREATE TABLE article_versions (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES articles(id),
  version INTEGER NOT NULL,
  content_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(article_id, version)
);

CREATE TABLE articles (
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
, pipeline_state TEXT NOT NULL DEFAULT 'pitch', revision_attempts INTEGER NOT NULL DEFAULT 0, hold_reason TEXT, score REAL, score_reason TEXT);

CREATE TABLE assignments (
  id TEXT PRIMARY KEY,
  pitch_id TEXT REFERENCES pitches(id),
  persona_id TEXT,
  article_id TEXT,
  slot_date TEXT,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  reason TEXT
);

CREATE TABLE claim_citations (
  id TEXT PRIMARY KEY,
  article_version_id TEXT NOT NULL REFERENCES article_versions(id),
  claim TEXT NOT NULL,
  source_ids TEXT NOT NULL DEFAULT '[]',
  kind TEXT NOT NULL DEFAULT 'fact',
  verified INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE editorial_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_version_id TEXT NOT NULL REFERENCES article_versions(id),
  check_name TEXT NOT NULL,
  check_type TEXT NOT NULL,
  result TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE job_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  step_name TEXT NOT NULL,
  status TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 1,
  detail TEXT,
  at TEXT NOT NULL
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt INTEGER NOT NULL DEFAULT 0,
  next_run_at TEXT,
  last_run_at TEXT,
  error TEXT
);

CREATE TABLE media_assets (
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

CREATE TABLE page_blocks (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  meta_description TEXT,
  main_html TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE persona_briefs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  persona_id TEXT NOT NULL REFERENCES personas(id),
  version INTEGER NOT NULL,
  brief_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(persona_id, version)
);

CREATE TABLE personas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  bio_public TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  subject_tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE pitches (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  persona_id TEXT,
  place TEXT,
  practice TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  score REAL,
  reason TEXT,
  created_at TEXT NOT NULL
, slug TEXT, country TEXT, deck TEXT);

CREATE TABLE publication_slots (
  id TEXT PRIMARY KEY,
  slot_date TEXT NOT NULL UNIQUE,
  article_version_id TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  published_at TEXT,
  published_by TEXT,
  note TEXT
);

CREATE TABLE schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sources (
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

CREATE TABLE spend_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  run_id TEXT,
  article_slug TEXT,
  step TEXT,
  model TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  cost_usd REAL,
  reserved_usd REAL
, reservation_id TEXT);

CREATE INDEX idx_articles_status ON articles(status);

CREATE INDEX idx_audit_at ON audit_events(at);

CREATE INDEX idx_checks_av ON editorial_checks(article_version_id);

CREATE INDEX idx_sources_av ON sources(article_version_id);

CREATE INDEX idx_spend_at ON spend_ledger(at);

CREATE INDEX idx_spend_reservation ON spend_ledger(reservation_id);

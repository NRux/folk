# Stage 7 content-import verification — October 8, 2026

## Hosted read-only findings

The existing Supabase project vxmyggasjgsiohqzzwzh is accessible. Counts: folkly_articles 0, folkly_article_versions 0, folkly_sources 0. production.autonomous_enabled, publication.autonomous_enabled and schedule.enabled are all false. No hosted write or schema change was performed.

The original Site DB binding is available. Its bounded article_versions read at limit 1 reports model_projection.truncated=true and truncated_values=1; content_json length is 2,000 characters. The article metadata row is complete. This still does not constitute a lossless snapshot. Reading more pages cannot restore bytes omitted within a cell. No partial import or reconstruction was attempted.

## Implementation and local evidence

Added offline Supabase snapshot compiler and private SQL preparation command. The compiler validates the existing transfer format, an independently supplied checksum/count receipt, complete trusted schema columns, duplicate records, parseable JSON, latest article hashes, evidence/version ownership and current manual release classification. It locks destination editorial tables, requires disabled switches, compares counts and all supplied columns in one transaction and refuses existing changed data. It imports no secrets, owners, settings, spend, slots or schedule. SQL is written outside the repository/public directories with exclusive creation and mode 0600.

PGlite fixtures pass: import and exact retry, preserved SQL-like/quoted private text, held-story privacy, manifest-based already-public classification, raw and rehashed truncation rejection, mismatched counts, unknown columns, changed release hashes, concurrent-revision refusal, anonymous/authenticated table denial, paused-switch guard and forced post-insert failure rollback with zero article rows. Full npm build/regression and script syntax checks also pass. This is isolated local transaction evidence, not a hosted content migration or served draft acceptance.

Supabase changelog checked October 8: PostgreSQL 15.19/17.11 changes concern ltree, legacy pgcrypto ciphers, btree_gist NaN and custom operators. This compiler adds no extension/operator/schema behavior or encryption. Source: https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes . Existing default-deny RLS/grants are retained.

Remaining prerequisite: complete original Site export/SQLite backup and independently recorded checksum/table counts. See docs/platform/SUPABASE-CONTENT-IMPORT.md for exact preparation and application/readback steps. Later public editorial revisions remain in Git/Vercel and need separate version reconciliation after historical import; the importer never downgrades public pages. No credential needs to be pasted in chat, and no new project is needed.

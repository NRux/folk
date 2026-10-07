// Run only from a protected setup operation against a migrated D1 binding.
// This module has no HTTP route. A retry after a partial chunk is idempotent.
const TABLES = [
  "personas", "persona_briefs", "pitches", "articles", "article_versions",
  "assignments", "page_blocks", "sources", "claim_citations", "media_assets",
  "editorial_checks",
];

export async function importSnapshot(db, snapshot, { batchSize = 25 } = {}) {
  if (snapshot?.format !== "folkly-d1-snapshot-v1" || snapshot.release_state !== "unpublished") {
    throw new Error("Unsupported or already released snapshot");
  }
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 50) {
    throw new Error("Invalid D1 batch size");
  }
  const { sha256, ...payload } = snapshot;
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
    .map((value) => value.toString(16).padStart(2, "0")).join("");
  if (digest !== sha256) throw new Error("Snapshot checksum mismatch");
  // The importer never changes an existing production article or its version.
  // An interrupted import may be resumed, but unrelated content is a hard stop.
  const existing = await db.prepare("SELECT id FROM articles LIMIT 1").first();
  if (existing && !snapshot.records.articles.some((a) => a.id === existing.id)) {
    throw new Error("Destination contains an unrelated article");
  }
  const counts = {};
  for (const table of TABLES) {
    const rows = snapshot.records[table];
    if (!Array.isArray(rows)) throw new Error(`Missing snapshot table: ${table}`);
    counts[table] = rows.length;
    for (let i = 0; i < rows.length; i += batchSize) {
      const statements = rows.slice(i, i + batchSize).map((row) => {
        const columns = Object.keys(row);
        if (!columns.length || columns.some((key) => !/^[a-z_][a-z_0-9]*$/i.test(key))) {
          throw new Error(`Invalid column in ${table}`);
        }
        const sql = `INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")}) ON CONFLICT DO NOTHING`;
        return db.prepare(sql).bind(...columns.map((key) => row[key]));
      });
      if (statements.length) await db.batch(statements);
    }
  }
  // Compare row counts; ON CONFLICT must not conceal an incomplete target.
  for (const table of TABLES) {
    const result = await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first();
    if (Number(result.n) !== counts[table]) throw new Error(`D1 count mismatch: ${table}`);
  }
  for (const article of snapshot.records.articles) {
    const row = await db.prepare("SELECT content_hash, status FROM articles WHERE id = ?").bind(article.id).first();
    if (row?.content_hash !== article.content_hash || row?.status !== article.status) {
      throw new Error(`Article mismatch after D1 import: ${article.id}`);
    }
  }
  for (const version of snapshot.records.article_versions) {
    const row = await db.prepare("SELECT content_json FROM article_versions WHERE id = ?").bind(version.id).first();
    if (row?.content_json !== version.content_json) {
      throw new Error(`Version mismatch after D1 import: ${version.id}`);
    }
  }
  return counts;
}

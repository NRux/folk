"use strict";
// Export editorial records for a one-time, private D1 import. Never place the
// output under a public/static directory or commit it to the Site source.
const { DatabaseSync } = require("node:sqlite");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const TABLES = [
  "personas", "persona_briefs", "pitches", "articles", "article_versions",
  "assignments", "page_blocks", "sources", "claim_citations", "media_assets",
  "editorial_checks",
];
const hash = (text) => createHash("sha256").update(text).digest("hex");

function exportSnapshot(dbFile, outputFile) {
  const output = path.resolve(outputFile);
  const repository = path.resolve(__dirname, "..", "..");
  const relative = path.relative(repository, output);
  if (relative === "" || (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative))) {
    throw new Error("Private editorial snapshot must be outside the repository");
  }
  if (/(^|[\\/])(public|static|dist)([\\/]|$)/i.test(output)) {
    throw new Error("Private editorial snapshot cannot be saved in a public asset directory");
  }
  if (fs.existsSync(output)) throw new Error("Refusing to overwrite an existing snapshot");
  const db = new DatabaseSync(dbFile, { readOnly: true });
  try {
    const records = {};
    for (const table of TABLES) {
      const info = db.prepare(`PRAGMA table_info(${table})`).all();
      if (!info.length) throw new Error(`Missing table: ${table}`);
      const order = info.find((column) => column.pk)?.name || "rowid";
      records[table] = db.prepare(`SELECT * FROM ${table} ORDER BY ${order}`).all();
    }
    const state = db.prepare("SELECT key, value FROM settings WHERE key IN ('schedule.enabled', 'production.autonomous_enabled', 'publication.autonomous_enabled')").all();
    const unsafe = state.filter((row) => row.value !== "false");
    if (unsafe.length) throw new Error("Disable local schedule, production, and publication before export");
    const payload = { format: "folkly-d1-snapshot-v1", release_state: "unpublished", records };
    payload.sha256 = hash(JSON.stringify(payload));
    fs.writeFileSync(output, JSON.stringify(payload) + "\n", { flag: "wx", mode: 0o600 });
    return { sha256: payload.sha256, counts: Object.fromEntries(TABLES.map((t) => [t, records[t].length])) };
  } finally {
    db.close();
  }
}

if (require.main === module) {
  if (process.argv.length !== 4) {
    console.error("Usage: node web/site-runtime/export-snapshot.cjs <local.db> <private-output.json>");
    process.exitCode = 2;
  } else {
    try { console.log(JSON.stringify(exportSnapshot(process.argv[2], process.argv[3]))); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
module.exports = { exportSnapshot, TABLES };

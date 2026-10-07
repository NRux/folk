"use strict";
// Produce the initial Site migration model from the upgraded local SQLite schema.
// Review the generated SQL before publishing; subsequent migrations append only.
const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const dbFile = process.argv[2];
const output = process.argv[3];
if (!dbFile || !output) throw new Error("Usage: generate-drizzle.cjs <local.db> <site/db/schema.ts>");
const db = new DatabaseSync(dbFile, { readOnly: true });
const quote = (value) => JSON.stringify(value);
const lines = [
  "// Generated from Folkly's upgraded SQLite schema for the initial D1 migration.",
  "// Later schema changes must use append-only generated Drizzle migrations.",
  'import { integer, real, sqliteTable, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";',
  'import { sql } from "drizzle-orm";',
  "",
];
try {
  const tables = db.prepare(`SELECT name, sql FROM sqlite_master WHERE type='table'
    AND name NOT LIKE 'sqlite_%' ORDER BY name`).all();
  for (const table of tables) {
    lines.push(`export const ${table.name} = sqliteTable(${quote(table.name)}, {`);
    const columns = db.prepare(`PRAGMA table_info(${table.name})`).all();
    for (const col of columns) {
      const type = /INT/i.test(col.type) ? "integer" : /REAL|FLOAT|DOUBLE/i.test(col.type) ? "real" : "text";
      const autoIncrement = col.pk && new RegExp(`${col.name}\\s+INTEGER PRIMARY KEY AUTOINCREMENT`, "i").test(table.sql);
      let expr = `${type}(${quote(col.name)})`;
      if (col.pk) expr += `.primaryKey(${autoIncrement ? "{ autoIncrement: true }" : ""})`;
      if (col.notnull) expr += ".notNull()";
      if (col.dflt_value !== null) {
        const raw = String(col.dflt_value);
        const unquoted = /^'(.*)'$/s.exec(raw);
        if (unquoted) expr += `.default(${quote(unquoted[1].replace(/''/g, "'"))})`;
        else if (/^-?\d+(?:\.\d+)?$/.test(raw)) expr += `.default(${raw})`;
        else expr += ".default(sql`" + raw.replace(/`/g, "\\`") + "`)";
      }
      lines.push(`  ${col.name}: ${expr},`);
    }
    lines.push("}, (table) => [");
    for (const idx of db.prepare(`PRAGMA index_list(${table.name})`).all()) {
      const names = db.prepare(`PRAGMA index_info(${idx.name})`).all().map((c) => c.name);
      if (!names.length || (names.length === 1 && columns.find((c) => c.name === names[0])?.pk)) continue;
      const indexName = idx.name.startsWith("sqlite_autoindex_")
        ? `uq_${table.name}_${names.join("_")}` : idx.name;
      lines.push(`  ${idx.unique ? "uniqueIndex" : "index"}(${quote(indexName)}).on(${names.map((n) => `table.${n}`).join(", ")}),`);
    }
    lines.push("]);", "");
  }
  fs.writeFileSync(output, lines.join("\n") + "\n");
  console.log(`${tables.length} tables generated`);
} finally { db.close(); }

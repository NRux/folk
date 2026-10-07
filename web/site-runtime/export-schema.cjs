"use strict";
const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const dbFile = process.argv[2];
const output = process.argv[3];
if (!dbFile || !output) throw new Error("Usage: export-schema.cjs <local.db> <output.sql>");
const db = new DatabaseSync(dbFile, { readOnly: true });
try {
  const objects = db.prepare(`SELECT type, name, sql FROM sqlite_master
    WHERE type IN ('table', 'index') AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL
    ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name`).all();
  const sql = "-- Folkly schema for Sites D1. Schema only; unpublished content is imported privately.\n" +
    objects.map((item) => `${item.sql};`).join("\n\n") + "\n";
  fs.writeFileSync(output, sql);
  console.log(`${objects.length} schema objects`);
} finally { db.close(); }

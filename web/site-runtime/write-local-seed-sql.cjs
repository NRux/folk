"use strict";
// Local D1 fixture only. Hosted data flows through the authenticated importer.
const fs = require("node:fs");
const { TABLES } = require("./export-snapshot.cjs");
const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) throw new Error("Usage: write-local-seed-sql.cjs <private-snapshot.json> <private-output.sql>");
const snapshot = JSON.parse(fs.readFileSync(input, "utf8"));
if (snapshot.format !== "folkly-d1-snapshot-v1") throw new Error("Invalid snapshot");
const literal = (v) => v === null ? "NULL" : typeof v === "number" ? String(v) :
  "'" + String(v).replace(/'/g, "''") + "'";
const statements = [];
for (const table of TABLES) {
  for (const row of snapshot.records[table]) {
    const columns = Object.keys(row);
    statements.push(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map((key) => literal(row[key])).join(",")});`);
  }
}
for (const [key, value] of Object.entries({
  "site.canonical_domain": "folkly-journal.nrapp.chatgpt.site",
  "site.issue_label": "Issue 01 / The things we carry",
  "site.footer_date": "October 2026",
  "site.timezone": "America/Los_Angeles",
  "schedule.enabled": "false",
  "production.autonomous_enabled": "false",
  "publication.autonomous_enabled": "false",
  "budget.daily_usd": "5",
  "budget.monthly_usd": "100",
})) statements.push(`INSERT INTO settings (key,value,updated_at) VALUES (${literal(key)},${literal(value)},'2026-10-07T00:00:00Z');`);
fs.writeFileSync(output, statements.join("\n"), { flag: "wx", mode: 0o600 });
console.log(`${statements.length} local D1 fixture statements`);

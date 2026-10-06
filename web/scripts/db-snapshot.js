"use strict";
const { openDb } = require("../lib/db");
const db = openDb(process.argv[2]);
console.log("=== articles ===");
for (const r of db.prepare("SELECT slug, title, persona_id, status, pipeline_state, place_label, country, category FROM articles").all())
  console.log(JSON.stringify(r));
console.log("=== personas ===");
for (const r of db.prepare("SELECT id, name, slug, active, subject_tags FROM personas").all())
  console.log(JSON.stringify(r));
console.log("=== persona briefs (latest per persona) ===");
const rows = db.prepare("SELECT pb.persona_id, pb.version, pb.brief_json FROM persona_briefs pb ORDER BY pb.persona_id, pb.version DESC").all();
const seen = new Set();
for (const r of rows) {
  if (seen.has(r.persona_id)) continue;
  seen.add(r.persona_id);
  console.log(r.persona_id, "v" + r.version, JSON.stringify(JSON.parse(r.brief_json)));
}
console.log("=== pitches ===");
for (const r of db.prepare("SELECT * FROM pitches").all()) console.log(JSON.stringify(r));
console.log("=== slots ===");
for (const r of db.prepare("SELECT * FROM publication_slots ORDER BY slot_date LIMIT 10").all()) console.log(JSON.stringify(r));
console.log("=== settings ===");
for (const r of db.prepare("SELECT key, value FROM settings").all()) console.log(r.key + " = " + r.value);

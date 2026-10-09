"use strict";
// Probe: current publication state across all candidate DB files.
const fs = require("fs");
const path = require("path");
const { openDb } = require("../lib/db");

const web = path.join(__dirname, "..");
const candidates = fs
  .readdirSync(web)
  .filter((f) => f.endsWith(".db"))
  .map((f) => path.join(web, f))
  .concat(fs.readdirSync(path.join(web, "..")).filter((f) => f.endsWith(".db")).map((f) => path.join(web, "..", f)));

for (const file of [...new Set(candidates)]) {
  try {
    const db = openDb(file);
    const rows = db.prepare("SELECT status, COUNT(*) c FROM articles GROUP BY status").all();
    const pub = db.prepare("SELECT slug, place_label, country FROM articles WHERE status='published' ORDER BY created_at").all();
    console.log("\n==", file, "==");
    console.log("  counts:", rows.map((r) => r.status + "=" + r.c).join(" "));
    console.log("  published:", pub.map((p) => p.slug).join(", "));
    const slots = db.prepare("SELECT COUNT(*) c FROM publication_slots").get();
    console.log("  slots:", slots.c);
  } catch (e) {
    console.log("\n==", file, "== ERROR:", e.message);
  }
}

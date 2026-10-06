"use strict";
// Reset the partial tokushima article from the failed run so a clean re-run starts fresh.
const { openDb } = require("../lib/db");
const db = openDb(process.argv[2] || "folkly.db");
const art = db.prepare("SELECT id, slug, pipeline_state FROM articles WHERE slug = 'tokushima-aizome'").get();
console.log("partial article:", art ? art.id + " state=" + art.pipeline_state : "none");
if (art) {
  db.prepare("DELETE FROM article_versions WHERE id = ?").run(art.id + "-v1");
  db.prepare("DELETE FROM articles WHERE id = ?").run(art.id);
  console.log("deleted partial article");
}
db.prepare("UPDATE pitches SET status = 'new' WHERE id = 'p-tokushima-aizome'").run();
const stuck = db.prepare("SELECT COUNT(*) c, COALESCE(SUM(reserved_usd),0) s FROM spend_ledger WHERE reserved_usd > 0").get();
console.log("stuck reservations:", stuck.c, "usd=" + stuck.s);
db.prepare("UPDATE spend_ledger SET reserved_usd = 0 WHERE reserved_usd > 0").run();
console.log("spend rows now:", db.prepare("SELECT COUNT(*) c FROM spend_ledger").get().c);
console.log("CLEANUP OK");

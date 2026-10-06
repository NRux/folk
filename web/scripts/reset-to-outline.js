"use strict";
// Reset the tokushima article to 'outline' so the runner resumes at drafting
// (research is already persisted under <articleId>-v1).
const { openDb } = require("../lib/db");
const db = openDb(process.argv[2] || "folkly.db");
const art = db.prepare("SELECT id, slug, pipeline_state FROM articles WHERE slug = 'tokushima-aizome'").get();
if (!art) { console.log("no article; nothing to reset"); process.exit(0); }
const srcs = db.prepare("SELECT COUNT(*) c FROM sources WHERE article_version_id = ?").get(art.id + "-v1").c;
const claims = db.prepare("SELECT COUNT(*) c FROM claim_citations WHERE article_version_id = ?").get(art.id + "-v1").c;
console.log(`article ${art.id} state=${art.pipeline_state} research: ${srcs} sources, ${claims} claims`);
db.prepare("UPDATE articles SET pipeline_state = 'outline', status = 'draft', updated_at = ? WHERE id = ?").run(new Date().toISOString(), art.id);
db.prepare("UPDATE pitches SET status = 'new' WHERE id = 'p-tokushima-aizome'").run();
// clear any stuck reservations for this article
db.prepare("UPDATE spend_ledger SET reserved_usd = 0 WHERE reserved_usd > 0 AND article_slug = 'tokushima-aizome'").run();
console.log("RESET TO outline");

"use strict";
// Probe: are the fabricated numbers present in the stored evidence?
const { openDb } = require("../lib/db");
const db = openDb(process.argv[2] || require("path").join(__dirname, "..", "folkly.db"));
const a = db.prepare("SELECT id FROM articles WHERE slug = ?").get("tokushima-aizome");
const srcs = db.prepare("SELECT ord, title, excerpt FROM sources WHERE article_version_id = ? ORDER BY ord").all(a.id + "-v1");
const corpus = srcs.map((s) => s.excerpt || "").join("\n");
console.log("excerpts total chars:", corpus.length);
for (const tok of ["1903", "15,000", "15000", "1445", "Muromachi", "hectares", "companies"]) {
  console.log(tok, "=>", corpus.includes(tok) ? "FOUND in evidence" : "NOT in evidence");
}
const claims = db.prepare("SELECT claim, source_ids FROM claim_citations WHERE article_version_id = ?").all(a.id + "-v1");
console.log("--- claims ledger (" + claims.length + " claims) ---");
for (const c of claims) console.log("*", c.claim.slice(0, 140), "src:", c.source_ids);

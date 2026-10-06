"use strict";
// Unit-test the new numeric_claims_supported deterministic check against the
// persisted tokushima draft and its research (no LLM calls).
const { openDb } = require("../lib/db");
const { deterministicChecks } = require("../lib/pipeline");
const path = require("path");
const db = openDb(process.argv[2] || path.join(__dirname, "..", "folkly.db"));
const art = db.prepare("SELECT * FROM articles WHERE slug = ?").get("tokushima-aizome");
const verId = art.id + "-v1";
const srcRows = db.prepare("SELECT * FROM sources WHERE article_version_id = ? ORDER BY ord").all(verId);
const claimRows = db.prepare("SELECT * FROM claim_citations WHERE article_version_id = ?").all(verId);
const research = {
  sources: srcRows.map((s) => ({ url: s.url, title: s.title, org: s.org_author, publisher_class: s.publisher, pub_date: s.pub_date, text_excerpt: s.excerpt || "" })),
  claims: claimRows.map((c) => ({ claim: c.claim })),
  namedLocalVoices: [], uncertainties: [], disagreements: [],
};
const content = JSON.parse(db.prepare("SELECT content_json FROM article_versions WHERE id = ?").get(verId).content_json);
const checks = deterministicChecks(db, art, content, research);
for (const c of checks) console.log(`${c.result.toUpperCase().padEnd(7)} ${c.name}: ${c.details}`);
const num = checks.find((c) => c.name === "numeric_claims_supported");
console.log(num && num.result === "pass" ? "\nNUMERIC CHECK: PASS (no false positives)" : "\nNUMERIC CHECK: " + (num ? "FAIL" : "MISSING"));

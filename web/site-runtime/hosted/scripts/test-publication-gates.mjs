import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { evidenceDigest, PUBLICATION_GUARD_SQL, validateEvidence } from "../lib/publication-gates.mjs";

const version = "article-v1", article = "article", hash = "content-hash";
const sources = Array.from({ length: 5 }, (_, index) => ({
  id: `source-${index + 1}`, ord: index + 1, title: `Source ${index + 1}`,
  org_author: null, url: `https://${index + 1}.example/story`, pub_date: null,
  retrieved_at: "2026-10-07T00:00:00.000Z", lang: "en",
  publisher: index < 2 ? ["primary", "local"][index] : "publisher", source_type: null,
}));
const claims = [{ id: "claim-1", claim: "Supported claim", source_ids: '["source-1","source-2"]', kind: "fact", verified: 1 }];
const required = ["citations_resolve", "links_valid", "mandatory_disclosure", "numeric_claims_supported",
  "required_fields", "sources_present", "word_count"];
const checks = required.map((check_name) => ({ check_name, check_type: "gate", result: "pass", details: "passed" }));

assert.equal(validateEvidence({ sources, claims, checks }), true);
assert.equal(validateEvidence({ sources, claims: [{ ...claims[0], source_ids: '["unknown"]' }], checks }), false);
assert.equal(validateEvidence({ sources, claims, checks: checks.slice(1) }), false);
const expected = await evidenceDigest({ sources, claims, checks });
assert.notEqual(expected, await evidenceDigest({ sources, claims: [{ ...claims[0], claim: "Changed" }], checks }));

function database() {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE articles(id TEXT PRIMARY KEY,status TEXT,pipeline_state TEXT,content_hash TEXT);
    CREATE TABLE article_versions(id TEXT PRIMARY KEY,article_id TEXT,version INTEGER,content_json TEXT);
    CREATE TABLE sources(id TEXT PRIMARY KEY,article_version_id TEXT,url TEXT,publisher TEXT,source_type TEXT);
    CREATE TABLE claim_citations(id TEXT PRIMARY KEY,article_version_id TEXT,source_ids TEXT);
    CREATE TABLE editorial_checks(id INTEGER PRIMARY KEY,article_version_id TEXT,check_name TEXT,result TEXT);
    CREATE TABLE media_assets(file_path TEXT PRIMARY KEY,license TEXT,license_url TEXT,attribution TEXT);
    INSERT INTO articles VALUES('${article}','draft','ready','${hash}');
    INSERT INTO article_versions VALUES('${version}','${article}',1,'{"note":{"text":"AI editorial persona; linked sources; no firsthand experience."}}');`);
  for (const source of sources) db.prepare("INSERT INTO sources VALUES(?,?,?,?,?)")
    .run(source.id, version, source.url, source.publisher, source.source_type);
  db.prepare("INSERT INTO claim_citations VALUES(?,?,?)").run("claim-1", version, claims[0].source_ids);
  for (const check of checks) db.prepare("INSERT INTO editorial_checks(article_version_id,check_name,result) VALUES(?,?,?)")
    .run(version, check.check_name, check.result);
  return db;
}
const passes = (db) => !!db.prepare(PUBLICATION_GUARD_SQL).get(version, article, hash);
let db = database(); assert.equal(passes(db), true); db.close();
db = database(); db.exec("DELETE FROM editorial_checks WHERE check_name='word_count'"); assert.equal(passes(db), false); db.close();
db = database(); db.prepare("UPDATE claim_citations SET source_ids='[\"unknown\"]'").run(); assert.equal(passes(db), false); db.close();
db = database(); db.prepare("UPDATE article_versions SET content_json='{}'").run(); assert.equal(passes(db), false); db.close();

console.log("Publication evidence gates passed: attestation, claim links, required checks, and atomic D1 guard.");

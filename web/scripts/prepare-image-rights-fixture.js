"use strict";
// Prepare an isolated image-rights gate fixture from the verified seed's persisted
// evidence and draft. Run only in the disposable Stage 04 verification database.
const crypto = require("crypto");
const path = require("path");
const { openDb, audit } = require("../lib/db");

const db = openDb(process.argv[2] || path.join(__dirname, "..", "folkly.db"));
const seed = db.prepare("SELECT * FROM articles WHERE slug = 'tokushima-aizome' AND pipeline_state = 'ready'").get();
if (!seed) throw new Error("verified ready seed article tokushima-aizome is required");
const seedVersion = seed.id + "-v1";
const content = db.prepare("SELECT content_json FROM article_versions WHERE id = ?").get(seedVersion);
if (!content) throw new Error("seed article version is missing");
const fixtureId = "art-image-rights-aizome-fixture";
const fixtureSlug = "image-rights-aizome-fixture";
const fixtureVersion = fixtureId + "-v1";
const pitchId = "p-image-rights-aizome";
const now = new Date().toISOString();

db.exec("BEGIN IMMEDIATE");
try {
  db.prepare(
    "INSERT OR IGNORE INTO pitches (id,title,persona_id,place,practice,status,score,reason,created_at,slug,country,deck) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
  ).run(pitchId, "Aizome image-rights gate fixture", seed.persona_id, seed.place_label, "indigo dyeing (aizome) and craft economies", "new", null, "Isolated image-rights gate fixture; never scheduled for publication.", now, fixtureSlug, seed.country || "Japan", seed.deck || null);

  db.prepare("DELETE FROM sources WHERE article_version_id = ?").run(fixtureVersion);
  db.prepare("DELETE FROM claim_citations WHERE article_version_id = ?").run(fixtureVersion);
  db.prepare("DELETE FROM editorial_checks WHERE article_version_id = ?").run(fixtureVersion);
  db.prepare("DELETE FROM media_assets WHERE notes LIKE ?").run("article=" + fixtureId + "%");
  db.prepare("DELETE FROM article_versions WHERE id = ?").run(fixtureVersion);
  db.prepare("DELETE FROM audit_events WHERE entity_id = ?").run(fixtureId);

  const previous = db.prepare("SELECT id FROM articles WHERE id = ? OR slug = ?").get(fixtureId, fixtureSlug);
  if (previous && previous.id !== fixtureId) throw new Error("fixture slug is already owned by another article");
  if (previous) {
    db.prepare("UPDATE articles SET title=?,deck=?,persona_id=?,place_label=?,country=?,category=?,status='draft',pipeline_state='editorial-revision',content_hash=?,created_at=?,updated_at=?,revision_attempts=0,hold_reason=NULL WHERE id=?")
      .run("[FIXTURE] " + seed.title, seed.deck, seed.persona_id, seed.place_label, seed.country, seed.category, seed.content_hash, now, now, fixtureId);
  } else {
    db.prepare("INSERT INTO articles (id,slug,title,deck,persona_id,place_label,country,category,status,pipeline_state,content_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,'draft','editorial-revision',?,?,?)")
      .run(fixtureId, fixtureSlug, "[FIXTURE] " + seed.title, seed.deck, seed.persona_id, seed.place_label, seed.country, seed.category, seed.content_hash, now, now);
  }
  db.prepare("INSERT INTO article_versions (id,article_id,version,content_json,created_by,note,created_at) VALUES (?,?,?,?,?,?,?)")
    .run(fixtureVersion, fixtureId, 1, content.content_json, "stage-04-fixture", "isolated verified-seed checkpoint for image-rights gate", now);

  const oldSources = db.prepare("SELECT * FROM sources WHERE article_version_id = ? ORDER BY ord").all(seedVersion);
  const idMap = new Map();
  const ordMap = new Map();
  const insSource = db.prepare("INSERT INTO sources (id,article_version_id,ord,title,org_author,url,pub_date,retrieved_at,lang,publisher,source_type,independence_rank,supports_claims,excerpt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
  oldSources.forEach((source, index) => {
    const id = "fixture-src-" + crypto.randomBytes(8).toString("hex");
    idMap.set(source.id, id);
    ordMap.set(index + 1, id);
    insSource.run(id, fixtureVersion, index + 1, source.title, source.org_author, source.url, source.pub_date, source.retrieved_at, source.lang, source.publisher, source.source_type, source.independence_rank, source.supports_claims, source.excerpt);
  });

  const oldClaims = db.prepare("SELECT * FROM claim_citations WHERE article_version_id = ?").all(seedVersion);
  const insClaim = db.prepare("INSERT INTO claim_citations (id,article_version_id,claim,source_ids,kind,verified) VALUES (?,?,?,?,?,?)");
  for (const claim of oldClaims) {
    const refs = JSON.parse(claim.source_ids || "[]");
    const mapped = refs.map((ref) => idMap.get(ref) || ordMap.get(Number(ref)));
    if (mapped.some((id) => !id)) throw new Error("seed contains a claim citation that cannot be mapped");
    insClaim.run("fixture-claim-" + crypto.randomBytes(8).toString("hex"), fixtureVersion, claim.claim, JSON.stringify(mapped), claim.kind, claim.verified);
  }
  const dossier = db.prepare("SELECT reason FROM audit_events WHERE entity_id = ? AND action = 'persist-dossier' ORDER BY id DESC LIMIT 1").get(seed.id);
  if (dossier) audit(db, "stage-04-fixture", "persist-dossier", "article", fixtureId, dossier.reason);
  audit(db, "stage-04-fixture", "fixture-prepared", "article", fixtureId, "verified ready seed evidence copied into an isolated draft checkpoint; no publication slot is attached");
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}
console.log("Prepared isolated image-rights fixture at editorial-revision:", fixtureSlug);

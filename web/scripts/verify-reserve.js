"use strict";
// Read-only acceptance gate for the seven unpublished articles in the local
// editorial reserve. It never changes status or publishes a slot.
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(process.argv[2] || process.env.FOLKLY_DB || path.join(__dirname, "..", "folkly.db"), { readOnly: true });
try {
  const target = Number(db.prepare("SELECT value FROM settings WHERE key='reserve.target'").get()?.value || 7);
  const rows = db.prepare("SELECT * FROM articles WHERE pipeline_state='ready' AND status NOT IN ('scheduled','published','withdrawn') ORDER BY slug").all();
  const failures = [];
  const editorialNotes = [];
  for (const article of rows) {
    const version = db.prepare("SELECT * FROM article_versions WHERE article_id=? ORDER BY version DESC LIMIT 1").get(article.id);
    if (!version) { failures.push(article.slug + ": version missing"); continue; }
    let content;
    try { content = JSON.parse(version.content_json); } catch { failures.push(article.slug + ": invalid content"); continue; }
    const hash = crypto.createHash("sha256").update(JSON.stringify(content)).digest("hex");
    if (hash !== article.content_hash) failures.push(article.slug + ": version hash mismatch");
    if (!content.body_html || !content.note || !Array.isArray(content.sources) || content.sources.length < 5) failures.push(article.slug + ": incomplete content/source disclosure");
    const sources = db.prepare("SELECT id FROM sources WHERE article_version_id=?").all(version.id);
    if (sources.length < 5) failures.push(article.slug + ": fewer than five retrieved sources");
    const sourceIds = new Set(sources.map(s => s.id));
    const claims = db.prepare("SELECT source_ids FROM claim_citations WHERE article_version_id=?").all(version.id);
    if (!claims.length || claims.some(c => { try { const refs=JSON.parse(c.source_ids); return !Array.isArray(refs) || !refs.length || refs.some(id=>!sourceIds.has(id)); } catch { return true; } })) failures.push(article.slug + ": invalid claim citations");
    const checks = db.prepare("SELECT check_name,result FROM editorial_checks WHERE article_version_id=?").all(version.id);
    if (!checks.length || checks.some(c=>c.result==="fail")) failures.push(article.slug + ": deterministic checks failed/missing");
    const review = db.prepare("SELECT reason FROM audit_events WHERE entity_id=? AND action='persist-review' ORDER BY id DESC LIMIT 1").get(article.id);
    try {
      const result=JSON.parse(review.reason);
      if (result.verdict!=="pass" || (result.findings||[]).some(f=>f.severity==="critical"||f.severity==="major")) failures.push(article.slug + ": independent review has unresolved major/critical findings");
      const minor=(result.findings||[]).filter(f=>f.severity==="minor");
      if (minor.length) editorialNotes.push({slug:article.slug,count:minor.length});
    } catch { failures.push(article.slug + ": independent review missing/invalid"); }
  }
  if (rows.length < target) failures.push("reserve below target: "+rows.length+"/"+target);
  console.log(JSON.stringify({ready:rows.length,target,slugs:rows.map(r=>r.slug),editorialNotes,failures},null,2));
  if (failures.length) process.exitCode=1;
} finally { db.close(); }

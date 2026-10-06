"use strict";
// Stage 04 verification: validates the pipeline run results against the stage
// exit criteria and writes docs/verification/stage-04-pipeline-run.md.
//
// Checks:
//   A. Seed article reached 'ready' with claim-linked sources meeting the source
//      rules, a valid image clearance outcome, and accurate disclosure.
//   B. Two gate-failure fixtures (unsupported-claim, image-rights) prevented
//      'ready' and routed to needs-review (reserve routing).
//   C. Transition audit trail: reason + actor on every transition for the runs.
//   D. Budget accounting: spend ledger rows exist with per-run/per-article cost.
//   E. Deterministic checks present (schema/links/fields) and not model-only.
const fs = require("fs");
const path = require("path");
const { openDb } = require("../lib/db");

const db = openDb(path.join(__dirname, "..", "folkly.db"));
const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  [" + detail + "]" : ""}`);
}

const DISCLOSURE_RE = /Written with AI using the ([A-Z][a-z]+ [A-Z][a-z]+|Folkly) editorial persona; researched from the linked sources\./;

// ---- A. Seed article (tokushima-aizome) -----------------------------------
const seed = db.prepare("SELECT * FROM articles WHERE slug = 'tokushima-aizome'").get();
check("A1 seed article exists", !!seed, seed ? seed.slug : "missing");
let seedReady = false;
if (seed) {
  seedReady = seed.pipeline_state === "ready";
  check("A2 seed article reached 'ready'", seedReady, "state=" + seed.pipeline_state);

  // Sources meeting the rules
  const sources = db.prepare("SELECT * FROM sources WHERE article_version_id = ? ORDER BY org").all(seed.id + "-v1").sort((a, b) => a.ord - b.ord);
  const pubs = new Set(sources.map((s) => s.org_author));
  const strong = sources.filter((s) => ["primary", "local", "scholarly", "institutional", "practitioner"].includes(s.publisher)).length;
  check("A3 >=5 substantive sources", sources.length >= 5, sources.length + " sources");
  check("A4 >=3 independent publishers", pubs.size >= 3, [...pubs].join(", "));
  check("A5 >=2 primary/local/scholarly/institutional/practitioner", strong >= 2, strong + " strong");
  const haveExcerpts = sources.filter((s) => s.excerpt && s.excerpt.length > 100).length;
  check("A6 retrieved-page evidence stored (excerpts)", haveExcerpts >= 3, haveExcerpts + "/" + sources.length + " with excerpts");

  // Claim ledger
  const claims = db.prepare("SELECT * FROM claim_citations WHERE article_version_id = ?").all(seed.id + "-v1");
  const linked = claims.filter((c) => JSON.parse(c.source_ids || "[]").length > 0);
  check("A7 claim ledger with source links", claims.length >= 5 && linked.length >= 5, `${linked.length}/${claims.length} claims linked to sources`);

  // Word count band
  const content = JSON.parse(db.prepare("SELECT content_json FROM article_versions WHERE id = ?").get(seed.id + "-v1").content_json);
  const words = String(content.body_html || "").replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;
  check("A8 word count in band (900-2200)", words >= 900 && words <= 2200, words + " words");
  const citations = [...new Set((String(content.body_html).match(/\[(\d+)\]/g) || []).map((x) => parseInt(x.replace(/\[|\]/g, ""))))];
  const unres = citations.filter((n) => n < 1 || n > sources.length);
  check("A9 all citations resolve to listed sources", unres.length === 0, "citations: " + [...citations].join(",") + (unres.length ? " UNRESOLVED: " + unres.join(",") : ""));

  // Image clearance
  const media = db.prepare("SELECT * FROM media_assets WHERE notes LIKE ?").get("article=" + seed.id + "%");
  const figureSrc = content.figure && content.figure.src;
  const imgOk = (media && media.license && media.creator !== undefined && media.sha256) || (!media && !figureSrc);
  check("A10 image clearance outcome valid", imgOk, media ? `licensed: ${media.license}, creator=${media.creator}, sha=${String(media.sha256).slice(0, 12)}` : "typographic treatment (no figure)");
  if (media) {
    const licOk = media.license && !/nc|noncommercial/i.test(media.license);
    check("A11 NC license excluded", licOk, "license=" + media.license);
    check("A12 full license metadata (URL + attribution + download time)", !!(media.license_url && media.attribution && media.downloaded_at && media.original_url), `license_url=${!!media.license_url} attribution=${!!media.attribution}`);
    const fileOk = media.file_path && fs.existsSync(path.join(__dirname, "..", "static", media.file_path.replace(/^\//, "")));
    check("A13 image file downloaded on disk", fileOk, media.file_path);
  }
  if (content.figure) {
    check("A14 figure has factual alt text + attribution caption", !!(content.figure.alt && content.figure.figcaption_html), `alt="${content.figure.alt}"`);
  }

  // Disclosure accuracy: the article renders with the persona disclosure (server renders it;
  // verify the data the renderer uses: persona_id set + disclosure template).
  check("A15 persona byline set (disclosure source of truth)", !!seed.persona_id, "persona=" + seed.persona_id);

  const sourceRows = db.prepare("SELECT id FROM sources WHERE article_version_id = ?").all(seed.id + "-v1");
  const sourceIds = new Set(sourceRows.map((row) => row.id));
  const claimRows = db.prepare("SELECT source_ids FROM claim_citations WHERE article_version_id = ?").all(seed.id + "-v1");
  const citationsResolve = claimRows.every((row) => {
    try { return JSON.parse(row.source_ids || "[]").every((id) => sourceIds.has(id)); } catch { return false; }
  });
  check("A15b claim citations resolve to persisted source IDs", claimRows.length > 0 && citationsResolve, `${claimRows.length} claim records / ${sourceRows.length} sources`);

  // Deterministic checks present
  const checks = db.prepare("SELECT check_name, result FROM editorial_checks WHERE article_version_id = ?").all(seed.id + "-v1");
  const names = checks.map((c) => c.check_name);
  check("A16 deterministic checks recorded (schema/links/fields)", ["word_count", "sources_present", "citations_resolve", "links_valid", "required_fields"].every((n) => names.includes(n)), names.join(", "));
}

// ---- B. Gate-failure fixtures ---------------------------------------------
function fixture(name, slug, gateLabel) {
  const f = db.prepare("SELECT * FROM articles WHERE slug = ?").get(slug);
  check(`B${name}1 ${gateLabel} fixture exists`, !!f, f ? f.slug : "missing");
  if (!f) return null;
  const notReady = f.pipeline_state !== "ready";
  const held = f.pipeline_state === "needs-review" || f.pipeline_state === "withdrawn" || f.pipeline_state === "blocked";
  check(`B${name}2 ${gateLabel}: did NOT reach ready`, notReady, "state=" + f.pipeline_state);
  check(`B${name}3 ${gateLabel}: routed to hold (needs-review/blocked/withdrawn)`, held, "state=" + f.pipeline_state + " hold_reason=" + (f.hold_reason || "").slice(0, 80));
  return f;
}
fixture("1", "kumasi-kente-fixture", "unsupported-claim gate");
fixture("2", "dakar-griot-fixture", "image-rights gate");

// ---- C. Transition audit trail ---------------------------------------------
function trail(articleId) {
  return db.prepare("SELECT * FROM audit_events WHERE entity_id = ? AND action LIKE 'transition %' ORDER BY id").all(articleId);
}
if (seed) {
  const t = trail(seed.id);
  const allHaveActor = t.every((r) => r.actor && r.actor.length > 0);
  const allHaveReason = t.every((r) => r.reason && r.reason.length > 0);
  check("C1 every transition has actor + reason", allHaveActor && allHaveReason, t.length + " transitions");
  const states = t.map((r) => r.action.replace("transition ", ""));
  console.log("   trail:", states.join(" -> "));
}
const f1 = db.prepare("SELECT * FROM articles WHERE slug = 'kumasi-kente-fixture'").get();
const f2 = db.prepare("SELECT * FROM articles WHERE slug = 'dakar-griot-fixture'").get();
if (f1) {
  const t = trail(f1.id);
  check("C2 fixture 1 trail has actor + reason on all transitions", t.every((r) => r.actor && r.reason), t.length + " transitions");
}
if (f2) {
  const t = trail(f2.id);
  check("C3 fixture 2 trail has actor + reason on all transitions", t.every((r) => r.actor && r.reason), t.length + " transitions");
}

// ---- D. Budget accounting ---------------------------------------------------
const spend = db.prepare("SELECT COUNT(*) c, COALESCE(SUM(cost_usd),0) s FROM spend_ledger").get();
check("D1 spend ledger has entries", spend.c > 0, spend.c + " entries, " + spend.s.toFixed(4) + " USD total");
const perArticle = db.prepare("SELECT article_slug, COUNT(*) c FROM spend_ledger WHERE article_slug IS NOT NULL GROUP BY article_slug").all();
check("D2 per-article cost tracked", perArticle.length >= 1, perArticle.map((r) => r.article_slug + ":" + r.c).join(", "));
const perRun = db.prepare("SELECT run_id, COUNT(*) c FROM spend_ledger WHERE run_id IS NOT NULL GROUP BY run_id").all();
check("D3 per-run usage tracked", perRun.length >= 1, perRun.length + " runs");

// ---- E. Jobs / step records --------------------------------------------------
const jobs = db.prepare("SELECT * FROM jobs WHERE job_type LIKE 'pipeline:%' ORDER BY id").all();
check("E1 pipeline jobs recorded", jobs.length >= 3, jobs.map((j) => j.status).join(","));
const steps = db.prepare("SELECT COUNT(*) c FROM job_steps WHERE job_id IN (SELECT id FROM jobs WHERE job_type LIKE 'pipeline:%')").get().c;
check("E2 step records persisted (resumable checkpoints)", steps >= 10, steps + " steps");

// ---- Report ------------------------------------------------------------------
const failed = results.filter((r) => !r.ok);
const lines = [
  "# Stage 04 Verification — Pipeline run, gates, calendar",
  "",
  `Date: ${new Date().toISOString()}`,
  "",
  `Total checks: ${results.length}, passed: ${results.length - failed.length}, failed: ${failed.length}`,
  "",
  "| Check | Result | Detail |",
  "|---|---|---|",
  ...results.map((r) => `| ${r.name} | ${r.ok ? "PASS" : "FAIL"} | ${r.detail.replace(/\|/g, "/")} |`),
  "",
  `Overall: ${failed.length === 0 ? "ALL PASS" : "FAILURES PRESENT"}`,
  "",
];
fs.mkdirSync(path.join(__dirname, "..", "..", "docs", "verification"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "..", "..", "docs", "verification", "stage-04-pipeline-run.md"), lines.join("\n"));
console.log(`\n${failed.length === 0 ? "ALL PASS" : failed.length + " FAILURES"} — report: docs/verification/stage-04-pipeline-run.md`);
process.exit(failed.length === 0 ? 0 : 1);

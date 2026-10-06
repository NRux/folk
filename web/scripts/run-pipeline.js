"use strict";
// Stage 04 pipeline runner: drives ONE pitch through the full staged workflow
// (pitch -> ... -> ready) with durable checkpoints, per-step records, gates,
// image clearance, and budget accounting. Resumable: re-running picks up from the
// article's current pipeline_state.
//
// Usage:
//   node scripts/run-pipeline.js <db> <pitchId> [--gate-demo <gateName>]
//
//   <db>        path to folkly.db
//   <pitchId>   id of a row in pitches (status 'new')
//   --gate-demo For the gate-failure demonstration only: force a specific gate to fail
//               so we can show the article routes away from 'ready'. Values:
//               unsupported-claim, image-rights, source-rules, word-count-band
const path = require("path");
const crypto = require("crypto");
const { openDb, settingsGetAll, audit } = require("../lib/db");
const {
  transition, stepRecord, runResearch, sourceRulesCheck,
  runDraft, mdToArticleHtml, deterministicChecks, independentReview,
  runImageClearance, runGates, nowIso, MAX_REVISIONS,
} = require("../lib/pipeline");
const { ensureCalendar, nextOpenSlot } = require("../lib/calendar");

const DB_FILE = process.argv[2];
const PITCH_ID = process.argv[3];
const args = process.argv.slice(4);
const gateDemoIdx = args.indexOf("--gate-demo");
const GATE_DEMO = gateDemoIdx >= 0 ? args[gateDemoIdx + 1] : null;
const ASSETS_DIR = path.join(__dirname, "..", "static", "assets");

const db = openDb(DB_FILE);
const settings = settingsGetAll(db);
const personas = db.prepare("SELECT * FROM personas WHERE active = 1").all();
const briefsMap = (() => {
  const rows = db.prepare(
    `SELECT pb.persona_id, pb.brief_json FROM persona_briefs pb
     JOIN (SELECT persona_id, MAX(version) v FROM persona_briefs GROUP BY persona_id) m
     ON m.persona_id = pb.persona_id AND m.v = pb.version`
  ).all();
  return new Map(rows.map((r) => [r.persona_id, JSON.parse(r.brief_json)]));
})();

function jobRow(jobType, status = "running") {
  const id = "job-" + crypto.randomBytes(6).toString("hex");
  db.prepare("INSERT INTO jobs (id, job_type, status, next_run_at, last_run_at) VALUES (?,?,?,?,?)").run(id, jobType, status, nowIso(), nowIso());
  return id;
}
function finishJob(jobId, status, error) {
  db.prepare("UPDATE jobs SET status=?, error=?, last_run_at=? WHERE id=?").run(status, error ? String(error).slice(0, 500) : null, nowIso(), jobId);
}

function slugify(s) {
  return String(s ?? "").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "item";
}
function bodyStatsOf(html) {
  const text = String(html || "").replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");
  const words = text.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
  return { words: words.length, minutes: Math.max(1, Math.round(words.length / 200)) };
}
function escHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Research persisted as sources + claim_citations under version id <articleId>-v1.
// The dossier (named local voices, uncertainties, disagreements) round-trips in the
// version row's content_json under the _research key so a resumed run sees the full
// research object (gates read namedLocalVoices).
function loadResearch(db, articleId) {
  const verId = articleId + "-v1";
  const sources = db.prepare("SELECT * FROM sources WHERE article_version_id = ? ORDER BY ord").all(verId);
  if (!sources.length) return null;
  const claims = db.prepare("SELECT * FROM claim_citations WHERE article_version_id = ?").all(verId);
  const sourceOrdById = new Map(sources.map((s, i) => [s.id, i + 1]));
  // The dossier (named local voices, uncertainties, disagreements) round-trips via the
  // persist-dossier audit event — durable even after persistDraft overwrites the
  // version row's content_json. Gates read namedLocalVoices, so it must survive resume.
  let dossier = { namedLocalVoices: [], uncertainties: [], disagreements: [] };
  const drow = db.prepare("SELECT reason FROM audit_events WHERE entity_id = ? AND action = 'persist-dossier' ORDER BY id DESC LIMIT 1").get(articleId);
  if (drow && drow.reason) {
    try {
      const d = JSON.parse(drow.reason);
      if (d && typeof d === "object" && !Array.isArray(d)) {
        dossier = {
          namedLocalVoices: d.namedLocalVoices || [],
          uncertainties: d.uncertainties || [],
          disagreements: d.disagreements || [],
        };
      }
    } catch {
      /* keep defaults */
    }
  }
  return {
    sources: sources.map((s) => ({
      url: s.url, title: s.title, org: s.org_author, publisher_class: s.publisher,
      pub_date: s.pub_date, retrieved_at: s.retrieved_at, lang: s.lang,
      words: null, text_excerpt: s.excerpt || "", supports_claims: s.supports_claims,
    })),
    claims: claims.map((c) => ({
      claim: c.claim, kind: c.kind,
      source_indices: JSON.parse(c.source_ids || "[]").map((id) => sourceOrdById.get(id)).filter(Number.isInteger),
      verified: c.verified,
    })),
    namedLocalVoices: dossier.namedLocalVoices,
    uncertainties: dossier.uncertainties,
    disagreements: dossier.disagreements,
    rejected: [],
  };
}
function persistResearch(db, articleId, research) {
  const verId = articleId + "-v1";
  db.prepare("INSERT OR IGNORE INTO article_versions (id, article_id, version, content_json, created_by, note, created_at) VALUES (?,?,?,?,?,?,?)")
    .run(verId, articleId, 1, "{}", "pipeline-runner", "research checkpoint", nowIso());
  db.prepare("DELETE FROM sources WHERE article_version_id = ?").run(verId);
  db.prepare("DELETE FROM claim_citations WHERE article_version_id = ?").run(verId);
  const insSrc = db.prepare(
    "INSERT INTO sources (id, article_version_id, ord, title, org_author, url, pub_date, retrieved_at, lang, publisher, source_type, independence_rank, supports_claims, excerpt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
  );
  const insClaim = db.prepare(
    "INSERT INTO claim_citations (id, article_version_id, claim, source_ids, kind, verified) VALUES (?,?,?,?,?,0)"
  );
  const sourceIds = research.sources.map(() => "src-" + crypto.randomBytes(5).toString("hex"));
  research.sources.forEach((s, i) => {
    insSrc.run(
      sourceIds[i], verId, i + 1,
      String(s.title || "Untitled source"), String(s.org || "Unknown publisher"), String(s.url || ""),
      s.pub_date || null, s.retrieved_at || nowIso(), s.lang || "en",
      s.publisher_class || "secondary", "retrieved-page", i + 1,
      JSON.stringify(s.supports_claims || []), String(s.text_excerpt || "").slice(0, 4000)
    );
  });
  research.claims.forEach((c) => {
    const sourceIdsForClaim = (c.source_indices || [])
      .filter((index) => Number.isInteger(index) && index >= 1 && index <= sourceIds.length)
      .map((index) => sourceIds[index - 1]);
    insClaim.run(
      "claim-" + crypto.randomBytes(5).toString("hex"), verId,
      String(c.claim || "unparsed claim"), JSON.stringify(sourceIdsForClaim),
      String(c.kind || "fact")
    );
  });
  audit(db, "pipeline-runner", "persist-research", "article", articleId, `${research.sources.length} sources, ${research.claims.length} claims`);
}
function persistDossier(db, articleId, research) {
  // Durable checkpoint of the non-source parts of research (named local voices,
  // uncertainties, disagreements) so a resumed run can reconstruct the full object.
  audit(db, "pipeline-runner", "persist-dossier", "article", articleId,
    JSON.stringify({
      namedLocalVoices: research.namedLocalVoices || [],
      uncertainties: research.uncertainties || [],
      disagreements: research.disagreements || [],
    }));
}
function buildOutline(research) {
  const byKind = {};
  for (const c of research.claims) {
    (byKind[c.kind || "fact"] ||= []).push(c.claim);
  }
  const sections = Object.entries(byKind).map(([kind, claims]) => ({
    heading: kind.split(/[-]/).map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" "),
    focus: claims.slice(0, 4).join(" "),
  }));
  return { sections, generated_at: nowIso() };
}
function persistOutline(db, articleId, outline) {
  audit(db, "pipeline-runner", "persist-outline", "article", articleId, JSON.stringify(outline.sections.map((s) => s.heading)));
}
function persistDraft(db, articleId, content) {
  const verId = articleId + "-v1";
  db.prepare("UPDATE article_versions SET content_json = ?, created_at = ? WHERE id = ?").run(JSON.stringify({ ...content, _pipeline: true }), nowIso(), verId);
  const words = bodyStatsOf(content.body_html).words;
  db.prepare("UPDATE articles SET deck = ?, word_count = ?, reading_minutes = ? WHERE id = ?")
    .run(content.deck || "", words, bodyStatsOf(content.body_html).minutes, articleId);
}
function loadDraft(db, articleId) {
  const row = db.prepare("SELECT content_json FROM article_versions WHERE id = ?").get(articleId + "-v1");
  if (!row) return null;
  try {
    const c = JSON.parse(row.content_json);
    return c && c._pipeline ? c : null;
  } catch {
    return null;
  }
}
function loadReview(db, articleId) {
  const rows = db.prepare("SELECT * FROM audit_events WHERE entity_id = ? AND action = 'persist-review' ORDER BY id DESC LIMIT 1").all(articleId);
  if (!rows.length) return { findings: [], verdict: "revise" };
  try {
    return JSON.parse(rows[0].reason);
  } catch {
    return { findings: [], verdict: "revise" };
  }
}
function persistReview(db, articleId, review) {
  audit(db, "pipeline-runner", "persist-review", "article", articleId, JSON.stringify({ verdict: review.verdict, findings: review.findings || [] }));
}
function loadDetChecks(db, articleId) {
  return db.prepare("SELECT check_name name, check_type type, result, details FROM editorial_checks WHERE article_version_id = ?").all(articleId + "-v1");
}
function loadImage(db, articleId) {
  const row = db.prepare("SELECT * FROM media_assets WHERE notes LIKE ? ORDER BY id DESC LIMIT 1").get(`article=${articleId}%`);
  if (!row) return null;
  return { outcome: "licensed", asset: row };
}
function persistImage(db, articleId, image) {
  if (image.outcome === "licensed" && image.asset) {
    db.prepare(
      "INSERT INTO media_assets (id, file_path, original_url, creator, license, license_url, attribution, downloaded_at, sha256, caption, alt_text, asset_kind, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)"
    ).run("media-" + crypto.randomBytes(5).toString("hex"), image.asset.file_path, image.asset.original_url, image.asset.creator, image.asset.license, image.asset.license_url, image.asset.attribution, image.asset.downloaded_at, image.asset.sha256, image.asset.caption, image.asset.alt_text, image.asset.asset_kind, "article=" + articleId + (image.asset.notes ? "; " + image.asset.notes : ""));
  } else {
    audit(db, "pipeline-runner", "image-typographic", "article", articleId, image.reason || "typographic treatment");
  }
}
function finalizeArticle(db, art, content, research, image) {
  const verId = art.id + "-v1";
  const words = bodyStatsOf(content.body_html).words;
  const minutes = bodyStatsOf(content.body_html).minutes;
  const hash = crypto.createHash("sha256").update(JSON.stringify(content)).digest("hex");
  db.prepare("UPDATE article_versions SET content_json = ?, created_at = ?, created_by = 'pipeline-runner', note = 'final ready version' WHERE id = ?")
    .run(JSON.stringify(content), nowIso(), verId);
  db.prepare(
    `UPDATE articles SET title=?, deck=?, place_label=?, country=?, category=?,
     word_count=?, reading_minutes=?, content_hash=?, updated_at=?, home_eyebrow=?, home_dek=?, home_short=?
     WHERE id=?`
  ).run(
    art.title, content.deck || art.deck, art.place_label, art.country, art.category || "Cultural essay",
    words, minutes, hash, nowIso(),
    art.category || "Cultural essay", content.deck || art.deck, (content.deck || art.deck || "").slice(0, 120),
    art.id
  );
  audit(db, "pipeline-runner", "finalize-article", "article", art.id, `${words} words, ${minutes} min read`);
}

// Gate names that mean "hard failure: hold, do not auto-revise".
const HARD_GATES = new Set(["unsupported-claim", "verification-failure", "image-rights", "source-rules", "word-count-band", "mandatory-disclosure"]);

async function main() {
  const startedAt = Date.now();
  console.log(`[run] pitch=${PITCH_ID} gate-demo=${GATE_DEMO || "none"}`);
  ensureCalendar(db, 30);

  const pitch = db.prepare("SELECT * FROM pitches WHERE id = ?").get(PITCH_ID);
  if (!pitch) throw new Error("no such pitch: " + PITCH_ID);

  // Resume or create the article.
  let art = db.prepare("SELECT * FROM articles WHERE slug = ?").get(pitch.slug || slugify(pitch.title));
  const jobId = jobRow("pipeline:" + PITCH_ID);
  try {
    if (!art) {
      const id = "art-" + crypto.randomBytes(6).toString("hex");
      const slug = pitch.slug || slugify(pitch.title);
      db.prepare(
        `INSERT INTO articles (id, slug, title, deck, persona_id, place_label, country, category, status, pipeline_state, content_hash, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?, 'draft', 'pitch', '', ?, ?)`
      ).run(id, slug, pitch.title, "", pitch.persona_id || null, pitch.place, pitch.country || "", pitch.practice || "", nowIso(), nowIso());
      art = db.prepare("SELECT * FROM articles WHERE id = ?").get(id);
      stepRecord(db, jobId, "article-created", "ok", `id=${art.id} slug=${art.slug}`);
      console.log(`[run] created article ${art.slug} (id=${art.id})`);
    }

    let research = loadResearch(db, art.id);
    let content = loadDraft(db, art.id);
    let review = null;
    let image = loadImage(db, art.id);
    let revisionNotes = null;

    // ---- STATE MACHINE ------------------------------------------------------
    let guard = 0;
    while (guard++ < 12) {
      const state = art.pipeline_state;
      console.log(`[state] ${state}`);

      if (state === "pitch") {
        const slot = nextOpenSlot(db, todayIso());
        const cal = require("../lib/calendar");
        const pick = art.persona_id ? { personaId: art.persona_id, reason: "pitch bound to persona" } : cal.pickPersona(db, personas, art.category || art.title);
        if (!art.persona_id) db.prepare("UPDATE articles SET persona_id=? WHERE id=?").run(pick.personaId, art.id);
        transition(db, art.id, "assignment", "pipeline-runner", `assigned to ${pick.personaId}; slot ${slot ? slot.slot_date : "none open"}; ${pick.reason}`);
        stepRecord(db, jobId, "pitch->assignment", "ok", pick.reason);
        art = db.prepare("SELECT * FROM articles WHERE id = ?").get(art.id);
        continue;
      }
      if (state === "assignment") {
        transition(db, art.id, "source-research", "pipeline-runner", "begin research");
        stepRecord(db, jobId, "assignment->source-research", "ok", "");
        art = db.prepare("SELECT * FROM articles WHERE id = ?").get(art.id);
        continue;
      }
      if (state === "source-research") {
        if (!research) {
          const ctx = { query: `${pitch.place} ${pitch.practice} ${pitch.title}`, place: pitch.place, topic: pitch.practice };
          console.log(`[run] researching (persona=${art.persona_id})...`);
          research = await runResearch(ctx, db, art);
          persistResearch(db, art.id, research);
          stepRecord(db, jobId, "source-research", "ok", `${research.sources.length} sources, ${research.claims.length} claims, ${research.namedLocalVoices.length} local voices`);
          console.log(`[run] research complete: ${research.sources.length} sources, ${research.claims.length} claims`);
          // Evidence too thin -> pick another story (route to reserve), never fabricate depth.
          const src = sourceRulesCheck(research);
          if (research.sources.length < 5) {
            transition(db, art.id, "withdrawn", "pipeline-runner", "evidence too thin: " + src.issues.join("; "));
            finishJob(jobId, "withdrawn", "evidence too thin");
            console.log(`[run] WITHDRAWN: evidence too thin (${research.sources.length} sources). Route to reserve selection.`);
            return;
          }
        } else {
          console.log(`[run] resumed; research already present (${research.sources.length} sources)`);
        }
        transition(db, art.id, "evidence-dossier", "pipeline-runner", "claim ledger persisted");
        persistDossier(db, art.id, research);
        stepRecord(db, jobId, "source-research->evidence-dossier", "ok", `${research.claims.length} claims`);
        art = db.prepare("SELECT * FROM articles WHERE id = ?").get(art.id);
        continue;
      }
      if (state === "evidence-dossier") {
        const outline = buildOutline(research);
        persistOutline(db, art.id, outline);
        transition(db, art.id, "outline", "pipeline-runner", "outline derived from claim ledger");
        stepRecord(db, jobId, "evidence-dossier->outline", "ok", `${outline.sections.length} sections`);
        art = db.prepare("SELECT * FROM articles WHERE id = ?").get(art.id);
        continue;
      }
      if (state === "outline") {
        const persona = personas.find((p) => p.id === art.persona_id) || { name: "Folkly editorial" };
        const brief = briefsMap.get(art.persona_id) || { beat: "", central_question: "", voice: "", story_structure: "", research_emphasis: "", blind_spot: "" };
        console.log(`[run] drafting as ${persona.name}...`);
        const ctx = { query: `${pitch.place} ${pitch.practice}`, place: pitch.place, topic: pitch.practice, deck: pitch.deck || "" };
        const draft = await runDraft(ctx, db, art, persona, brief, research, { revisionNotes });
        const { body_html, toc } = mdToArticleHtml(draft.markdown, research.sources);
        const titleMatch = draft.markdown.match(/^#\s+(.+)$/m);
        if (titleMatch && !revisionNotes) {
          db.prepare("UPDATE articles SET title = ? WHERE id = ?").run(titleMatch[1].trim().slice(0, 140), art.id);
        }
        const firstPara = (draft.markdown.split(/\n\n/).find((p) => p && !p.startsWith("#")) || "").slice(0, 200);
        content = {
          eyebrow: art.category || pitch.practice || "Cultural essay",
          deck: pitch.deck || firstPara || "",
          body_html,
          toc,
          sources: research.sources.map((s, i) => ({ ord: i + 1, org: s.org, title: s.title, href: s.url, pub_date: s.pub_date })),
          figure: null,
          note: { text: "Every story is researched from the linked sources. The writing is done by an AI editorial persona in the journal's voice; it carries no firsthand experience of the place." },
        };
        persistDraft(db, art.id, content);
        transition(db, art.id, "draft", "pipeline-runner", revisionNotes ? "revised draft from findings" : "draft generated from evidence dossier");
        stepRecord(db, jobId, "outline->draft", "ok", `${bodyStatsOf(body_html).words} words`);
        art = db.prepare("SELECT * FROM articles WHERE id = ?").get(art.id);
        console.log(`[run] draft complete: ${bodyStatsOf(body_html).words} words`);
        continue;
      }
      if (state === "draft") {
        transition(db, art.id, "verification", "pipeline-runner", "begin verification");
        stepRecord(db, jobId, "draft->verification", "ok", "");
        art = db.prepare("SELECT * FROM articles WHERE id = ?").get(art.id);
        continue;
      }
      if (state === "verification") {
        if (!content) throw new Error("at verification but no persisted draft");
        console.log(`[run] verifying (deterministic + independent review)...`);
        const detChecks = deterministicChecks(db, art, content, research);
        const ctx = { place: pitch.place, topic: pitch.practice };
        review = await independentReview(ctx, db, art, content, research);
        persistReview(db, art.id, review);
        stepRecord(db, jobId, "verification", "ok", `verdict=${review.verdict} findings=${(review.findings || []).length}`);
        console.log(`[run] verification verdict=${review.verdict}, findings=${(review.findings || []).length}`);
        art = db.prepare("SELECT * FROM articles WHERE id = ?").get(art.id);

        // ---- GATE EVALUATION (hard gates are non-negotiable) ---------------
        const draftWords = bodyStatsOf(content.body_html).words;
        const gates = runGates(db, art, {
          research,
          review,
          detChecks,
          image: { outcome: "deferred" }, // image rights gate evaluated at image-clearance
          draftWords,
          content,
        });
        if (GATE_DEMO && GATE_DEMO !== "image-rights") {
          gates.ok = false;
          gates.failures.push({ gate: GATE_DEMO, why: "FORCED by --gate-demo (isolated stage-04 demonstration; fixture, no real slot)" });
          console.log(`[run] GATE-DEMO forcing failure of '${GATE_DEMO}'`);
        }
        const hardFail = gates.failures.some((f) => HARD_GATES.has(f.gate));
        const attempts = art.revision_attempts || 0;
        if (!gates.ok && (hardFail || attempts >= 2)) {
          const reason = "gates failed [" + gates.failures.map((f) => f.gate).join(", ") + "] attempts=" + attempts;
          transition(db, art.id, "needs-review", "pipeline-runner", reason);
          stepRecord(db, jobId, "gates-failed", "fail", reason);
          finishJob(jobId, "needs-review", reason);
          console.log(`[run] GATES FAILED (hard) -> needs-review. ${reason}`);
          console.log(`[run] (stage-06 would select a ready reserve article to keep the slot filled.)`);
          return;
        }
        if (!gates.ok) {
          transition(db, art.id, "editorial-revision", "pipeline-runner", "non-critical findings; revising: " + gates.failures.map((f) => f.gate).join(","));
          stepRecord(db, jobId, "gates->editorial-revision", "warn", gates.failures.map((f) => f.gate + ": " + f.why).join("; "));
          art = db.prepare("SELECT * FROM articles WHERE id = ?").get(art.id);
          continue;
        }
        // Spec state list: verification -> editorial revision -> image clearance.
        // Editorial revision is a MANDATORY stage (even with a clean pass it is an
        // explicit checkpoint), so we always route through it.
        transition(db, art.id, "editorial-revision", "pipeline-runner", `gates passed; editorial checkpoint (verdict=${review.verdict || "n/a"})`);
        stepRecord(db, jobId, "gates-passed", "ok", `words=${draftWords} verdict=${review.verdict || "n/a"}`);
        art = db.prepare("SELECT * FROM articles WHERE id = ?").get(art.id);
        continue;
      }
      if (state === "editorial-revision") {
        if (!review) review = loadReview(db, art.id);
        if (!content) throw new Error("at editorial-revision but no persisted draft");
        if (GATE_DEMO === "image-rights") {
          // The image-rights demo fails AT the image gate, so editorial passes through
          // (the fixture still went through real research, drafting and verification).
          transition(db, art.id, "image-clearance", "pipeline-runner", "gate-demo(image-rights): editorial checkpoint passed; image rights gate is the failure under test");
          stepRecord(db, jobId, "editorial-revision->image-clearance", "ok", "demo: to image clearance");
          art = db.prepare("SELECT * FROM articles WHERE id = ?").get(art.id);
          continue;
        }
        // Recompute gates from persisted state so the decision is identical on a
        // resumed run (review + deterministic checks are durable; gates are pure).
        const detChecks = loadDetChecks(db, art.id);
        const draftWords = bodyStatsOf(content.body_html).words;
        const gates = runGates(db, art, {
          research,
          review,
          detChecks,
          image: { outcome: "deferred" }, // image rights gate evaluated at image-clearance
          draftWords,
          content,
        });
        const hardFail = gates.failures.some((f) => HARD_GATES.has(f.gate));
        const attempts = art.revision_attempts || 0;
        if (!gates.ok && (hardFail || attempts >= 2)) {
          const reason = "gates failed [" + gates.failures.map((f) => f.gate).join(", ") + "] attempts=" + attempts;
          transition(db, art.id, "needs-review", "pipeline-runner", reason);
          stepRecord(db, jobId, "gates-failed", "fail", reason);
          finishJob(jobId, "needs-review", reason);
          console.log(`[run] GATES FAILED (hard) -> needs-review. ${reason}`);
          return;
        }
        // Clean pass: verdict 'pass' with no gate failures -> no re-draft; the
        // editorial-revision stage is the recorded checkpoint before image clearance.
        if (gates.ok && (review.verdict || "pass") === "pass") {
          transition(db, art.id, "image-clearance", "pipeline-runner", "editorial revision passed with no changes (verdict=pass, all gates ok)");
          stepRecord(db, jobId, "editorial-revision->image-clearance", "ok", "no changes; passing to image clearance");
          console.log(`[run] editorial revision: PASS (no changes; to image clearance)`);
          art = db.prepare("SELECT * FROM articles WHERE id = ?").get(art.id);
          continue;
        }
        // Revision cap (spec: "Cap automatic revision attempts"): allow exactly
        // MAX_REVISIONS re-drafts. `attempts` = entries into editorial-revision so
        // far (transition() increments before this branch reads it): entry n passes
        // the check and re-drafts when n < MAX_REVISIONS... with the > comparison the
        // k-th re-draft happens on entry k+1, so MAX_REVISIONS=2 allows 2 re-drafts
        // and entry 3 holds.
        if (attempts > MAX_REVISIONS) {
          const reason = `revision cap reached (attempts=${attempts} > ${MAX_REVISIONS}); reviewer still verdict=${review.verdict}`;
          transition(db, art.id, "needs-review", "pipeline-runner", reason);
          stepRecord(db, jobId, "revision-cap", "fail", reason);
          finishJob(jobId, "needs-review", reason);
          console.log(`[run] REVISION CAP reached -> needs-review. ${reason}`);
          console.log(`[run] (stage-06 would select a ready reserve article to keep the slot filled.)`);
          return;
        }
        console.log(`[run] revising (attempt ${attempts})...`);
        const persona = personas.find((p) => p.id === art.persona_id) || { name: "Folkly editorial" };
        const brief = briefsMap.get(art.persona_id) || { beat: "", central_question: "", voice: "", story_structure: "", research_emphasis: "", blind_spot: "" };
        const ctx = { query: `${pitch.place} ${pitch.practice}`, place: pitch.place, topic: pitch.practice, deck: pitch.deck || "" };
        const findingNotes = (review.findings || []).map((f) => `${f.type} (${f.severity}): ${f.article_text || ""} — ${f.evidence_issue || ""}`).join("; ");
        const gateNotes = gates.failures.map((f) => `gate ${f.gate}: ${f.why}`).join("; ");
        const notes = [findingNotes, gateNotes].filter(Boolean).join(" || ");
        const draft = await runDraft(ctx, db, art, persona, brief, research, { revisionNotes: notes });
        const { body_html, toc } = mdToArticleHtml(draft.markdown, research.sources);
        content = { ...content, body_html, toc };
        persistDraft(db, art.id, content);
        transition(db, art.id, "verification", "pipeline-runner", "revision complete; re-verifying");
        stepRecord(db, jobId, "editorial-revision->verification", "ok", `${bodyStatsOf(body_html).words} words`);
        art = db.prepare("SELECT * FROM articles WHERE id = ?").get(art.id);
        continue;
      }
      if (state === "image-clearance") {
        if (!image) {
          if (GATE_DEMO === "image-rights") {
            // Gate demonstration: simulate an image whose reuse rights cannot be
            // established (fixture, isolated from real publication slots).
            image = { outcome: "unresolved", reason: "FIXTURE (stage-04 gate demo): candidate image found but license could not be verified from its source page; no CC0/CC-BY metadata, no public-domain archive match" };
            persistImage(db, art.id, image);
            stepRecord(db, jobId, "image-clearance", "fail", image.reason);
            console.log(`[run] image clearance: ${image.outcome} (forced gate demo)`);
          } else {
            console.log(`[run] image clearance...`);
            const ctx = { place: pitch.place, topic: pitch.practice };
            image = await runImageClearance(ctx, db, art, ASSETS_DIR);
            persistImage(db, art.id, image);
            stepRecord(db, jobId, "image-clearance", "ok", `outcome=${image.outcome}`);
            console.log(`[run] image clearance: ${image.outcome}`);
          }
        }
        if (image.outcome === "licensed" && image.asset) {
          content.figure = {
            src: image.asset.file_path,
            alt: image.asset.alt_text,
            width: null,
            height: null,
            img_style: null,
            figcaption_html: escHtml(image.asset.attribution),
          };
          persistDraft(db, art.id, content); // attach figure to the version
        }
        // Image-rights gate: an unresolved outcome blocks.
        if (image.outcome !== "licensed" && image.outcome !== "typographic") {
          transition(db, art.id, "needs-review", "pipeline-runner", "unresolved image rights: " + (image.reason || ""));
          stepRecord(db, jobId, "image-gate", "fail", image.reason || "no clearance outcome");
          finishJob(jobId, "needs-review", "image rights unresolved");
          console.log(`[run] IMAGE-RIGHTS GATE FAILED -> needs-review. Route to reserve selection.`);
          return;
        }
        transition(db, art.id, "ready", "pipeline-runner", "image cleared; article ready for scheduling");
        stepRecord(db, jobId, "ready", "ok", `ready: ${art.slug}`);
        finalizeArticle(db, art, content, research, image);
        art = db.prepare("SELECT * FROM articles WHERE id = ?").get(art.id);
        finishJob(jobId, "done", null);
        console.log(`[run] READY: ${art.slug} (reserve seed)`);
        console.log(`[run] done in ${Math.round((Date.now() - startedAt) / 1000)}s`);
        return;
      }
      if (state === "retryable-failure") {
        const resumeState = image ? "image-clearance" : content ? (review ? "editorial-revision" : "verification") : research ? "evidence-dossier" : "source-research";
        transition(db, art.id, resumeState, "pipeline-runner", "resuming transient failure from last durable checkpoint");
        art = db.prepare("SELECT * FROM articles WHERE id = ?").get(art.id);
        continue;
      }
      if (["ready", "scheduled", "published", "withdrawn", "needs-review", "blocked"].includes(state)) {
        console.log(`[run] terminal/hold state ${state}; nothing to do`);
        finishJob(jobId, "done", null);
        return;
      }
      throw new Error("unhandled state: " + state);
    }
    throw new Error("state machine guard exceeded");
  } catch (e) {
    console.error(`[run] ERROR: ${e.message}`);
    try {
      const cur = db.prepare("SELECT pipeline_state FROM articles WHERE id = ?").get(art.id);
      const curState = cur ? cur.pipeline_state : null;
      if (curState && ["source-research", "evidence-dossier", "outline", "draft", "verification", "editorial-revision"].includes(curState)) {
        transition(db, art.id, "retryable-failure", "pipeline-runner", e.message);
        stepRecord(db, jobId, "error", "fail", e.message);
      }
    } catch (e2) {
      console.error("transition-on-error failed: " + e2.message);
    }
    finishJob(jobId, "error", e.message);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});

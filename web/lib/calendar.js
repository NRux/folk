"use strict";
// Stage 04 editorial calendar: rolling 30-day slot calendar + pitch backlog scoring.
// Rules (spec section 3): rotate the five personas aiming for rough 30-day balance;
// avoid the same persona or major theme on successive mornings; balance large cities
// with smaller towns/regions/diaspora; at least half of new coverage outside North
// America and Europe over a rolling month (without lowering the evidence standard);
// compare pitches against existing and queued articles (entities, places, practices,
// semantic similarity); reject superficial rewrites; a return to a place needs a
// substantially different practice or question; store the reason for each assignment.
const { openDb, settingsGetAll, audit } = require("./db");

const NA_EU = new Set(["united states", "canada", "mexico", "united kingdom", "ireland", "france", "germany", "spain", "portugal", "italy", "switzerland", "austria", "netherlands", "belgium", "luxembourg", "denmark", "sweden", "norway", "finland", "poland", "czech republic", "czechia", "slovakia", "hungary", "romania", "bulgaria", "croatia", "serbia", "bosnia", "greece", "cyprus", "malta", "estonia", "latvia", "lithuania", "iceland", "uk", "usa"]);

function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokens(s) {
  return norm(s).split(" ").filter((t) => t.length > 2);
}

function outsideNaEu(country) {
  return !NA_EU.has(norm(country));
}

// Ensure the rolling 30-day calendar exists (creates open slots, never overwrites used ones).
function ensureCalendar(db, days = 30) {
  const now = new Date();
  const tz = settingsGetAll(db)["site.timezone"] || "UTC";
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    const slotDate = d.toISOString().slice(0, 10);
    db.prepare(
      "INSERT INTO publication_slots (id, slot_date, status) VALUES (?, ?, 'open') ON CONFLICT(slot_date) DO NOTHING"
    ).run("slot-" + slotDate, slotDate);
  }
  return db.prepare("SELECT * FROM publication_slots WHERE status = 'open' ORDER BY slot_date LIMIT 30").all();
}

// Next open slot at or after fromDate (YYYY-MM-DD).
function nextOpenSlot(db, fromDate) {
  return db.prepare("SELECT * FROM publication_slots WHERE status = 'open' AND slot_date >= ? ORDER BY slot_date LIMIT 1").get(fromDate);
}

// Persona usage over the rolling window + who last ran on the most recent slot.
function personaUsage(db) {
  const slots = db.prepare(
    "SELECT ps.slot_date, ps.article_version_id, a.persona_id, a.place_label, a.country, a.category, a.title FROM publication_slots ps LEFT JOIN article_versions av ON av.id = ps.article_version_id LEFT JOIN articles a ON a.id = av.article_id WHERE ps.status IN ('open','filled','published') ORDER BY ps.slot_date DESC LIMIT 30"
  ).all();
  const counts = {};
  let lastPersona = null;
  let lastTheme = null;
  for (const s of slots) {
    if (!s.persona_id) continue;
    if (lastPersona === null) {
      lastPersona = s.persona_id;
      lastTheme = norm(s.category || s.title || "");
    }
    counts[s.persona_id] = (counts[s.persona_id] || 0) + 1;
  }
  // Geographic balance over the filled window
  const filled = slots.filter((s) => s.country);
  const outside = filled.filter((s) => outsideNaEu(s.country)).length;
  return { counts, lastPersona, lastTheme, filledCount: filled.length, outsideFraction: filled.length ? outside / filled.length : 1, slots };
}

// Pick a persona honoring rotation rules. Returns { personaId, reason }.
function pickPersona(db, personas, themeLabel) {
  const usage = personaUsage(db);
  const active = personas.filter((p) => p.active);
  const theme = norm(themeLabel);
  const scored = active.map((p) => {
    let score = -(usage.counts[p.id] || 0); // fewest-used first -> rough 30-day balance
    if (p.id === usage.lastPersona) score -= 10; // no same persona on successive mornings
    if (theme && usage.lastTheme && (theme.includes(usage.lastTheme.split(" ")[0]) || usage.lastTheme.includes(theme.split(" ")[0]))) score -= 4; // same major theme
    return { p, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const pick = scored[0].p;
  const reason = `persona rotation: usage ${JSON.stringify(usage.counts)}; last=${usage.lastPersona || "none"}; theme='${themeLabel || ""}'`;
  return { personaId: pick.id, reason, usage };
}

// Dedupe: compare a candidate against existing + queued articles.
// Overlap on (place AND practice) is a hard reject unless the practice differs substantially.
function dedupeCheck(db, { place, practice, title }) {
  const rows = db.prepare(
    "SELECT slug, title, place_label, category, status, pipeline_state FROM articles WHERE status != 'withdrawn' OR pipeline_state NOT IN ('withdrawn')"
  ).all();
  const pPlace = tokens(place);
  const pPractice = tokens(practice);
  const pTitle = tokens(title);
  const hits = [];
  for (const r of rows) {
    const rPlace = tokens(r.place_label);
    const rPractice = tokens(r.category || "");
    const rTitle = tokens(r.title || "");
    const placeOverlap = inter(pPlace, rPlace) / Math.max(1, Math.min(pPlace.length, rPlace.length));
    const practiceOverlap = inter(pPractice, rPractice) / Math.max(1, Math.min(pPractice.length, rPractice.length));
    const titleOverlap = inter(pTitle, rTitle) / Math.max(1, Math.min(pTitle.length, rTitle.length));
    if (placeOverlap >= 0.6 && practiceOverlap >= 0.6) {
      hits.push({ slug: r.slug, why: "same place + same practice" });
    } else if (placeOverlap >= 0.6 && practiceOverlap < 0.6 && titleOverlap >= 0.8) {
      hits.push({ slug: r.slug, why: "title-level rewrite of existing coverage" });
    }
  }
  return { ok: hits.length === 0, hits };
}

function inter(a, b) {
  const bs = new Set(b);
  return a.filter((x) => bs.has(x)).length;
}

// Score a pitch (spec section 3 criteria). Returns { score, reasons[] }.
function scorePitch(db, pitch) {
  const reasons = [];
  let score = 0;
  const dedupe = dedupeCheck(db, { place: pitch.place, practice: pitch.practice, title: pitch.title });
  if (!dedupe.ok) {
    return { score: -1, reasons: dedupe.hits.map((h) => "reject: " + h.why + " (existing: " + h.slug + ")"), dedupe };
  }
  reasons.push("no duplicate of existing/queued coverage");
  // Cultural specificity: place + practice both named and concrete
  if (tokens(pitch.place).length >= 2) { score += 1; reasons.push("concrete place"); }
  if (tokens(pitch.practice).length >= 2) { score += 1; reasons.push("concrete practice"); }
  // Geographic variety against the rolling window
  const usage = personaUsage(db);
  if (outsideNaEu(pitch.country)) {
    if (usage.filledCount === 0 || usage.outsideFraction < 0.5) { score += 2; reasons.push("supports outside-NA/EU balance"); }
    else { score += 1; reasons.push("outside NA/EU"); }
  } else { score += 0.5; reasons.push("NA/EU location (balance weight)"); }
  // Smaller towns / regions / diaspora vs large metropolises
  const smallish = /town|village|valley|highland|coast|delta|island|region|prefecture|district|diaspora|rural|river|lake|mountain/i;
  if (smallish.test(pitch.place || "")) { score += 1; reasons.push("smaller-place weighting"); }
  // Persona fit: does an active persona beat match the practice?
  const personas = db.prepare("SELECT * FROM personas WHERE active = 1").all();
  const briefs = db.prepare("SELECT pb.* FROM persona_briefs pb JOIN personas p ON p.id = pb.persona_id WHERE p.active = 1 ORDER BY pb.persona_id, pb.version DESC").all();
  const latestBrief = {};
  for (const b of briefs) if (!latestBrief[b.persona_id]) latestBrief[b.persona_id] = b;
  let bestFit = -1;
  for (const p of personas) {
    const bj = JSON.parse(latestBrief[p.id]?.brief_json || "{}");
    const beatTokens = tokens(bj.beat || p.subject_tags || "");
    const o = inter(tokens(pitch.practice), beatTokens) + inter(tokens(pitch.title), beatTokens) * 0.5;
    if (o > bestFit) bestFit = o;
  }
  if (bestFit > 0) { score += 1; reasons.push("persona beat match"); }
  // Originality / explanatory depth: length and specificity of the pitch reason
  if ((pitch.reason || "").length > 80) { score += 0.5; reasons.push("substantive pitch rationale"); }
  return { score, reasons, dedupe };
}

// Select the best eligible pitch for assignment; stores the assignment reason.
function selectPitch(db, personas, fromDate) {
  const pitches = db.prepare("SELECT * FROM pitches WHERE status = 'new' ORDER BY created_at").all();
  const scored = pitches.map((p) => ({ p, s: scorePitch(db, p) })).filter((x) => x.s.score >= 0);
  if (!scored.length) return { ok: false, reason: "no eligible pitch (all rejected by dedupe)" };
  scored.sort((a, b) => b.s.score - a.s.score);
  const best = scored[0];
  const slot = nextOpenSlot(db, fromDate);
  const persona = pickPersona(db, personas, best.p.practice || best.p.title);
  const reason = [
    "score " + best.s.score.toFixed(1),
    ...best.s.reasons,
    persona.reason,
    slot ? "slot " + slot.slot_date : "no open slot",
  ].join("; ");
  return { ok: true, pitch: best.p, slot, persona, reason, allScored: scored.map((x) => ({ id: x.p.id, title: x.p.title, score: +x.s.score.toFixed(2) })) };
}

// Reserve accounting: count ready (unscheduled) articles vs target.
function reserveStatus(db) {
  const target = parseInt(settingsGetAll(db)["reserve.target"] || "7", 10);
  const ready = db.prepare("SELECT COUNT(*) c FROM articles WHERE pipeline_state = 'ready'").get().c;
  return { ready, target, shortfall: Math.max(0, target - ready) };
}

module.exports = { ensureCalendar, nextOpenSlot, personaUsage, pickPersona, dedupeCheck, scorePitch, selectPitch, reserveStatus, outsideNaEu, norm, tokens };

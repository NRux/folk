"use strict";
// Recovery (post resume-crash fix): re-extract the research dossier (named local
// voices, uncertainties, disagreements) from the PERSISTED sources for an article,
// then write a durable persist-dossier audit event in the current JSON format so
// loadResearch can reconstruct the full research object on resume.
// The original run persisted the dossier in the legacy string format, which dropped
// namedLocalVoices (the field the source-rules gate reads). Re-extracting from the
// same stored excerpts keeps the evidence base identical to what the draft used.
const { openDb, audit } = require("../lib/db");
const { providerConfig, chat } = require("../lib/provider");
const { extractJson, transition } = require("../lib/pipeline");

async function main() {
  const db = openDb(process.argv[2] || "folkly.db");
  const slug = process.argv[3] || "tokushima-aizome";
  const reenter = process.argv.includes("--reenter-verification");

  const art = db.prepare("SELECT * FROM articles WHERE slug = ?").get(slug);
  if (!art) {
    console.error("no article " + slug);
    process.exit(1);
  }
  const verId = art.id + "-v1";
  const sources = db.prepare("SELECT * FROM sources WHERE article_version_id = ? ORDER BY ord").all(verId);
  if (!sources.length) {
    console.error("no persisted sources for " + verId);
    process.exit(1);
  }
  const pitch =
    db.prepare("SELECT * FROM pitches WHERE id = ? OR slug = ?").get("p-tokushima-aizome", slug) || {};
  const topic = pitch.practice || "craft practice";
  const place = pitch.place || "the place";

  const cfg = providerConfig(db);
  const evidence = sources
    .map(
      (s, i) =>
        `[SOURCE ${i + 1}] ${s.title} (${s.org_author}, class: ${s.publisher}, date: ${s.pub_date || "n/a"}):\n${s.excerpt}`
    )
    .join("\n\n---\n\n");
  // Identical prompt to runResearch (lib/pipeline.js) so the extraction criteria match.
  const prompt = {
    system:
      "You are a research analyst. Extract ONLY claims supported by the provided source texts. Never invent facts, quotes, or scenes. For each material fact (names, dates, origins, numbers, causal claims, present-day descriptions) record it with the source indices that support it. Also list named local or practitioner voices mentioned in the sources, and any uncertainty or disagreement between sources. Respond in strict JSON matching the schema.",
    user:
      `Topic: ${topic} in ${place}.\n\nSchema: {"claims":[{"claim":"...","kind":"fact|date|origin|number|causal|present-day|quote","source_indices":[1,2],"uncertain":false}],"named_local_voices":["name (role, source index)"],"uncertainties":["..."],"disagreements":["..."]}\n\nSOURCES:\n${evidence}`,
  };

  const t0 = Date.now();
  const llm = await chat(cfg, [
    { role: "system", content: prompt.system },
    { role: "user", content: prompt.user },
  ], { temperature: 0.2, maxTokens: 3000 });
  const parsed = extractJson(llm.text);
  if (!parsed) {
    console.error("re-extraction returned no JSON:", llm.text.slice(0, 300));
    process.exit(1);
  }
  const dossier = {
    namedLocalVoices: parsed.named_local_voices || [],
    uncertainties: parsed.uncertainties || [],
    disagreements: parsed.disagreements || [],
  };
  audit(db, "pipeline-runner", "persist-dossier", "article", art.id, JSON.stringify(dossier));
  console.log(`re-extracted dossier in ${Math.round((Date.now() - t0) / 1000)}s`);
  console.log("namedLocalVoices:", JSON.stringify(dossier.namedLocalVoices, null, 1));
  console.log("uncertainties:", dossier.uncertainties.length, "disagreements:", dossier.disagreements.length);

  if (reenter && art.pipeline_state === "retryable-failure") {
    transition(db, art.id, "verification", "recovery", "re-enter verification after resume-crash fix; dossier re-extracted from persisted sources");
    console.log("state re-entered at verification (runner will re-verify, run gates, then revise/clear as needed)");
  } else if (reenter) {
    console.log(`note: state is '${art.pipeline_state}', not retryable-failure; no transition made`);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(2);
});

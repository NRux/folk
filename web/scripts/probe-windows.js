"use strict";
// Probe: per-source, where do the flagged numbers fall in the excerpt window?
const { openDb } = require("../lib/db");
const db = openDb(process.argv[2] || require("path").join(__dirname, "..", "folkly.db"));
const a = db.prepare("SELECT id FROM articles WHERE slug = ?").get("tokushima-aizome");
const srcs = db.prepare("SELECT ord, title, org_author, excerpt FROM sources WHERE article_version_id = ? ORDER BY ord").all(a.id + "-v1");
const toks = ["1903", "15,000", "1445", "Muromachi", "hectares", "five"];
for (const s of srcs) {
  const ex = s.excerpt || "";
  const hits = toks.filter((t) => ex.includes(t));
  if (!hits.length) continue;
  const inReviewWindow = hits.filter((t) => ex.slice(0, 2500).includes(t));
  const beyond = hits.filter((t) => !ex.slice(0, 2500).includes(t));
  const idx = ex.indexOf(hits[0]);
  console.log(`[${s.ord}] ${s.org_author} len=${ex.length} hits=${hits.join(",")}`);
  console.log(`    first hit at char ${idx} | visible to reviewer (<=2500): ${inReviewWindow.join(",") || "none"} | only after 2500: ${beyond.join(",") || "none"}`);
}

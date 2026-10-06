"use strict";
// Re-enter the tokushima seed at verification after the reviewer-evidence fix.
// The 3 prior re-drafts chased FALSE findings (numbers that were in the evidence
// but beyond the reviewer's old 2500-char window), so the revision budget resets
// with the fixed reviewer. needs-review -> verification is a legal transition.
const { openDb } = require("../lib/db");
const { transition } = require("../lib/pipeline");
const db = openDb(process.argv[2] || require("path").join(__dirname, "..", "folkly.db"));
const a = db.prepare("SELECT * FROM articles WHERE slug = ?").get("tokushima-aizome");
if (!a) throw new Error("seed article missing");
db.prepare("UPDATE articles SET revision_attempts = 0 WHERE id = ?").run(a.id);
transition(db, a.id, "verification", "pipeline-runner", "re-verification after reviewer-evidence fix (full 4000-char window + deterministic numeric screen); stale false-positive revision budget reset");
const a2 = db.prepare("SELECT pipeline_state, revision_attempts FROM articles WHERE id = ?").get(a.id);
console.log("re-entered: state=" + a2.pipeline_state + " revAttempts=" + a2.revision_attempts);

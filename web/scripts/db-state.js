"use strict";
const { openDb } = require("../lib/db");
const db = openDb(process.argv[2] || "folkly.db");
const arts = db.prepare("SELECT id, slug, pipeline_state, revision_attempts, status FROM articles ORDER BY created_at").all();
for (const a of arts) console.log(`${a.id} ${a.slug} state=${a.pipeline_state} rev=${a.revision_attempts} status=${a.status}`);
console.log("jobs:");
for (const j of db.prepare("SELECT id, job_type, status, error FROM jobs ORDER BY id DESC LIMIT 6").all()) console.log(`  ${j.id} ${j.job_type} ${j.status} ${j.error || ""}`);
console.log("spend:", JSON.stringify(db.prepare("SELECT COUNT(*) c, COALESCE(SUM(cost_usd),0) cost, COALESCE(SUM(reserved_usd),0) res FROM spend_ledger").get()));
console.log("steps:", db.prepare("SELECT COUNT(*) c FROM job_steps").get().c);

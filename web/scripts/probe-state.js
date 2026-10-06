"use strict";
// State probe: fixture articles + oollama concurrency readiness.
const { openDb } = require("../lib/db");
const path = require("path");
const http = require("http");
const db = openDb(process.argv[2] || path.join(__dirname, "..", "folkly.db"));
for (const slug of ["kumasi-kente-fixture", "dakar-griot-fixture", "tokushima-aizome"]) {
  const a = db.prepare("SELECT id, pipeline_state, revision_attempts FROM articles WHERE slug = ?").get(slug);
  console.log(slug, "=>", a ? a.id + " state=" + a.pipeline_state + " revAttempts=" + a.revision_attempts : "none");
}
function get(p) {
  return new Promise((res, rej) => {
    const r = http.get("http://127.0.0.1:11434" + p, (s) => { let b = ""; s.on("data", (c) => (b += c)); s.on("end", () => res(b)); });
    r.on("error", rej);
    r.setTimeout(5000, () => r.destroy(new Error("timeout")));
  });
}
get("/api/ps").then((t) => console.log("ollama /api/ps:", t.slice(0, 300))).catch((e) => console.log("ollama ps err:", e.message));
get("/api/version").then((t) => console.log("ollama version:", t)).catch(() => {});

"use strict";
// Verify the native streaming transport completes a long generation with real content.
const { providerConfig, chat } = require("../lib/provider");
const { openDb } = require("../lib/db");
const db = openDb(process.argv[2] || "folkly.db");
const cfg = providerConfig(db);
const t0 = Date.now();
chat(cfg, [
  { role: "system", content: "You are a careful research analyst. Respond in strict JSON." },
  { role: "user", content: "Write a 500-word historical overview of Japanese indigo dyeing (aizome) in Tokushima, covering origins, the role of the Yoshino River, and the Edo-period craft economy. Then list 5 material facts as JSON." },
], { temperature: 0.3, maxTokens: 800, timeoutMs: 600000 })
  .then((r) => {
    const secs = (Date.now() - t0) / 1000;
    console.log(`OK: ${secs.toFixed(1)}s, ${r.usage.completion_tokens} completion tokens, ${(r.usage.completion_tokens / secs).toFixed(1)} tok/s`);
    console.log("finish:", r.finish);
    console.log("content first 200:", JSON.stringify(r.text.slice(0, 200)));
    console.log("content last 120:", JSON.stringify(r.text.slice(-120)));
  })
  .catch((e) => console.error("FAIL:", e.message));

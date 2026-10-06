"use strict";
// Measure local model generation speed for a 300-token completion (one shot).
const { providerConfig, chat } = require("../lib/provider");
const { openDb } = require("../lib/db");
const db = openDb(process.argv[2] || "folkly.db");
const cfg = providerConfig(db);
const t0 = Date.now();
chat(cfg, [{ role: "user", content: "Write exactly 300 words about the color of indigo dye." }], { maxTokens: 300, timeoutMs: 600000 })
  .then((r) => {
    const secs = (Date.now() - t0) / 1000;
    const toks = r.usage.completion_tokens;
    console.log(`300-token completion: ${secs.toFixed(1)}s -> ${(toks / secs).toFixed(1)} tok/s; extrapolate 3000 tokens ~ ${((3000 / toks) * secs / 60).toFixed(1)} min`);
    console.log("finish:", r.finish, "text_len:", r.text.length);
  })
  .catch((e) => console.error("FAIL:", e.message));

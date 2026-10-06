"use strict";
// Smoke test: search provider + LLM provider (real endpoints, no mocks).
const { ddgSearch, fetchPage } = require("../lib/search");
const { providerConfig, chat, budgetStatus, ensureBudgetTables } = require("../lib/provider");
const { openDb } = require("../lib/db");

(async () => {
  const db = openDb(process.argv[2] || "folkly.db");
  ensureBudgetTables(db);
  console.log("budget:", JSON.stringify(budgetStatus(db)));

  // Search
  const items = await ddgSearch("Tokushima aizome indigo dyeing", { max: 5 });
  console.log("ddg results:", items.length);
  for (const it of items.slice(0, 5)) console.log("  -", it.title?.slice(0, 70), "|", it.url);

  // Fetch one
  if (items[0]) {
    const r = await fetchPage(items[0].url);
    console.log("fetch:", r.ok ? `ok status=${r.status} bytes=${r.bytes}` : "FAIL " + r.error);
    if (r.ok) console.log("  title:", r.title?.slice(0, 80), "| words:", (r.text || "").split(/\s+/).length);
  }

  // LLM
  const cfg = providerConfig(db);
  console.log("provider:", cfg.baseUrl, "model:", cfg.model);
  const llm = await chat(cfg, [
    { role: "system", content: "Respond in strict JSON only." },
    { role: "user", content: '{"ok":true}' },
  ], { temperature: 0, maxTokens: 50 });
  console.log("llm reply:", JSON.stringify(llm.text.slice(0, 80)), "usage:", JSON.stringify(llm.usage), "cost:", llm.costUsd);
  console.log("SMOKE OK");
})().catch((e) => { console.error("SMOKE FAIL:", e.message); process.exit(1); });

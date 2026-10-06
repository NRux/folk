"use strict";
// Stage 04 provider adapter: model access + budget accounting.
// Providers are configured (env or FOLKLY config), never hardcoded. Cost tracking is
// per-run and per-article. Budget caps ($5/day, $100/month by default) are enforced
// with reservations so concurrent runs cannot exceed them. Budget exhaustion stops
// NEW production (ready articles still publish, stage 06).
const https = require("https");
const { URL } = require("url");
const http = require("http");
const { openDb, settingsGetAll, audit } = require("./db");

// Resolve provider config. Order: env vars, then settings table, then defaults.
function providerConfig(db) {
  const s = settingsGetAll(db);
  const baseUrl = process.env.FOLKLY_LLM_BASE_URL || s["provider.llm.base_url"] || "http://127.0.0.1:11434";
  const cfg = {
    baseUrl,
    // Native Ollama is detected from the host:port (no /v1). We call its /api/chat
    // directly with think:false — the OpenAI-compat layer on Ollama drops the model's
    // visible output into thinking tokens and returns empty content.
    isOllama: !/\/v\d+$/.test(baseUrl.replace(/\/$/, "")),
    apiKey: process.env.FOLKLY_LLM_API_KEY || s["provider.llm.api_key"] || "ollama",
    model: process.env.FOLKLY_LLM_MODEL || s["provider.llm.model"] || "qwen3.8:latest",
    // cost model: USD per 1k tokens (completion weighted). Local models: 0.
    costPer1kPrompt: parseFloat(process.env.FOLKLY_LLM_COST_1K_PROMPT || s["provider.llm.cost_1k_prompt"] || "0"),
    costPer1kCompletion: parseFloat(process.env.FOLKLY_LLM_COST_1K_COMPLETION || s["provider.llm.cost_1k_completion"] || "0"),
    maxTokens: parseInt(process.env.FOLKLY_LLM_MAX_TOKENS || s["provider.llm.max_tokens"] || "4000", 10),
    timeoutMs: parseInt(process.env.FOLKLY_LLM_TIMEOUT_MS || s["provider.llm.timeout_ms"] || "900000", 10),
  };
  return cfg;
}

function postJson(cfg, path_, body, timeoutMs) {
  const u = new URL(cfg.baseUrl.replace(/\/$/, "") + path_);
  const lib = u.protocol === "http:" ? http : https;
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = lib.request(
      {
        method: "POST",
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: u.pathname + u.search,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}`, "Content-Length": Buffer.byteLength(data) },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf-8");
          if (res.statusCode >= 400) return reject(new Error(`LLM HTTP ${res.statusCode}: ${text.slice(0, 300)}`));
          try {
            resolve(JSON.parse(text));
          } catch (e) {
            reject(new Error("LLM response was not JSON: " + text.slice(0, 200)));
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error("LLM timeout")));
    req.write(data);
    req.end();
  });
}

// Native Ollama transport (/api/chat). think:false is mandatory: the model spends
// its token budget on hidden reasoning otherwise, and the OpenAI-compat layer on
// Ollama returns empty content for thinking models.
async function postOllamaNative(cfg, body, timeoutMs) {
  const u = new URL(cfg.baseUrl.replace(/\/$/, ""));
  const lib = u.protocol === "http:" ? http : https;
  return new Promise((resolve, reject) => {
    let done = false;
    let settled = false;
    const finish = (fn) => (val) => { if (!settled) { settled = true; fn(val); } };
    const resolveOnce = finish(resolve);
    const rejectOnce = finish(reject);
    const data = JSON.stringify({ ...body, stream: true });
    const req = lib.request(
      {
        method: "POST",
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: u.pathname.replace(/\/$/, "") + "/api/chat",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
      },
      (res) => {
        if (res.statusCode >= 400) {
          let b = "";
          res.on("data", (c) => (b += c));
          res.on("end", () => rejectOnce(new Error("Ollama HTTP " + res.statusCode + ": " + b.slice(0, 300))));
          return;
        }
        // SSE stream: each line is one JSON chunk. Accumulate content + usage.
        let buf = "";
        let content = "";
        let reasoning = "";
        let promptTokens = 0, completionTokens = 0;
        const onLine = (line) => {
          line = line.trim();
          if (!line) return;
          let j;
          try { j = JSON.parse(line); } catch { return; }
          const m = j.message || {};
          if (m.content) content += m.content;
          if (m.thinking || m.reasoning_content) reasoning += m.thinking || m.reasoning_content;
          if (typeof j.prompt_eval_count === "number") promptTokens = j.prompt_eval_count;
          if (typeof j.eval_count === "number") completionTokens = j.eval_count;
          if (j.done) {
            done = true;
            resolveOnce({
              model: j.model || body.model,
              done: true,
              message: { content, thinking: reasoning },
              prompt_eval_count: promptTokens,
              eval_count: completionTokens,
            });
          }
        };
        res.on("data", (c) => {
          buf += c.toString("utf-8");
          let nl;
          while ((nl = buf.indexOf("\n")) >= 0) {
            onLine(buf.slice(0, nl));
            buf = buf.slice(nl + 1);
          }
        });
        res.on("end", () => {
          if (buf.trim()) onLine(buf);
          if (!done) {
            // Stream ended without a done flag — still return what we got.
            resolveOnce({
              model: body.model,
              done: false,
              message: { content, thinking: reasoning },
              prompt_eval_count: promptTokens,
              eval_count: completionTokens,
            });
          }
        });
        // Idle timeout only: resets on each streamed token, so long generations are fine.
        res.setTimeout(timeoutMs, () => req.destroy(new Error("Ollama stream idle timeout")));
      }
    );
    req.on("error", (e) => { if (!settled) rejectOnce(e); });
    req.write(data);
    req.end();
  });
}

// Chat completion with usage accounting. model can override cfg.model per task.
async function chat(cfg, messages, { model, temperature = 0.4, maxTokens, timeoutMs } = {}) {
  const tok = maxTokens || cfg.maxTokens;
  let d;
  if (cfg.isOllama) {
    d = await postOllamaNative(cfg, {
      model: model || cfg.model,
      messages,
      stream: false,
      think: false,
      options: { temperature, num_predict: tok },
    }, timeoutMs || cfg.timeoutMs);
  } else {
    d = await postJson(cfg, "/chat/completions", {
      model: model || cfg.model,
      messages,
      temperature,
      max_tokens: tok,
    }, timeoutMs || cfg.timeoutMs);
  }
  let usage, text, finish;
  if (cfg.isOllama) {
    usage = { prompt_tokens: d.prompt_eval_count || 0, completion_tokens: d.eval_count || 0, total_tokens: (d.prompt_eval_count || 0) + (d.eval_count || 0) };
    text = (d.message && d.message.content) || "";
    finish = d.done ? "stop" : "length";
  } else {
    usage = d.usage || {};
    text = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || "";
    finish = d.choices && d.choices[0] ? d.choices[0].finish_reason : null;
  }
  const cost =
    ((usage.prompt_tokens || 0) / 1000) * cfg.costPer1kPrompt +
    ((usage.completion_tokens || 0) / 1000) * cfg.costPer1kCompletion;
  return {
    text,
    usage,
    costUsd: cost,
    model: d.model || model || cfg.model,
    finish,
  };
}

// ---- Budget enforcement -------------------------------------------------
// spend_ledger rows are the source of truth; reservations make the cap atomic.
function ensureBudgetTables(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS spend_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  run_id TEXT,
  article_slug TEXT,
  step TEXT,
  model TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  cost_usd REAL,
  reserved_usd REAL
)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_spend_at ON spend_ledger(at)`);
}

function dayUtc(atIso) {
  return atIso.slice(0, 10);
}
function monthUtc(atIso) {
  return atIso.slice(0, 7);
}

function spendSince(db, sinceIso) {
  const r = db.prepare("SELECT COALESCE(SUM(cost_usd),0) s, COALESCE(SUM(reserved_usd),0) r FROM spend_ledger WHERE at >= ?").get(sinceIso);
  return { spent: r.s, reserved: r.r };
}

// Atomically reserve up to `estUsd` against both caps. Returns { ok, reason }.
function reserveBudget(db, estUsd, { runId, articleSlug, step }) {
  ensureBudgetTables(db);
  const now = new Date().toISOString();
  const dayStart = dayUtc(now) + "T00:00:00.000Z";
  const monthStart = monthUtc(now) + "-01T00:00:00.000Z";
  const d = spendSince(db, dayStart);
  const m = spendSince(db, monthStart);
  const dayCap = 5; // from settings default; overridden in settings at call sites
  const monthCap = 100;
  const effDay = parseFloat(settingsGetAll(db)["budget.daily_usd"] || "5");
  const effMonth = parseFloat(settingsGetAll(db)["budget.monthly_usd"] || "100");
  if (d.spent + d.reserved + estUsd > effDay) return { ok: false, reason: `daily budget exhausted (${(d.spent + d.reserved).toFixed(3)}/${effDay} USD)` };
  if (m.spent + m.reserved + estUsd > effMonth) return { ok: false, reason: `monthly budget exhausted (${(m.spent + m.reserved).toFixed(3)}/${effMonth} USD)` };
  db.prepare("INSERT INTO spend_ledger (at, run_id, article_slug, step, reserved_usd) VALUES (?,?,?,?,?)").run(now, runId ?? null, articleSlug ?? null, step ?? null, estUsd);
  return { ok: true };
}

// Settle a reservation: record actual usage; the reserved row is updated in place.
function settleBudget(db, reservationEstUsd, { runId, articleSlug, step, model, usage, costUsd }) {
  ensureBudgetTables(db);
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE spend_ledger SET reserved_usd = 0 WHERE reserved_usd > 0 AND article_slug = ? AND step = ? AND at = (SELECT MAX(at) FROM spend_ledger WHERE article_slug = ? AND step = ? AND reserved_usd > 0)"
  ).run(articleSlug, step, articleSlug, step);
  db.prepare(
    "INSERT INTO spend_ledger (at, run_id, article_slug, step, model, prompt_tokens, completion_tokens, cost_usd) VALUES (?,?,?,?,?,?,?,?)"
  ).run(now, runId ?? null, articleSlug ?? null, step ?? null, model ?? null, usage?.prompt_tokens ?? null, usage?.completion_tokens ?? null, costUsd ?? 0);
  audit(db, "budget", "settle", "spend", articleSlug, `${step} ${costUsd.toFixed(4)} USD`);
}

function budgetStatus(db) {
  ensureBudgetTables(db);
  const now = new Date().toISOString();
  const d = spendSince(db, dayUtc(now) + "T00:00:00.000Z");
  const m = spendSince(db, monthUtc(now) + "-01T00:00:00.000Z");
  const s = settingsGetAll(db);
  return {
    day: { spent: +d.spent.toFixed(4), reserved: +d.reserved.toFixed(4), cap: parseFloat(s["budget.daily_usd"] || "5") },
    month: { spent: +m.spent.toFixed(4), reserved: +m.reserved.toFixed(4), cap: parseFloat(s["budget.monthly_usd"] || "100") },
    exhausted: d.spent + d.reserved >= parseFloat(s["budget.daily_usd"] || "5") || m.spent + m.reserved >= parseFloat(s["budget.monthly_usd"] || "100"),
  };
}

module.exports = { providerConfig, chat, ensureBudgetTables, reserveBudget, settleBudget, budgetStatus };

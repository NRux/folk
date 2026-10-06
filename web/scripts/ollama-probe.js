"use strict";
// Probe: Ollama native /api/chat with think:false vs think:true vs openai-compat,
// to confirm why content is empty (reasoning-token burn).
const http = require("http");

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      { method: "POST", hostname: "127.0.0.1", port: 11434, path, headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString("utf-8") }));
      }
    );
    req.on("error", reject);
    req.setTimeout(180000, () => req.destroy(new Error("timeout")));
    req.write(data);
    req.end();
  });
}

(async () => {
  const variants = [
    ["native think:false", "/api/chat", { model: "qwen3.8:latest", messages: [{ role: "user", content: "Say OK in exactly one word." }], stream: false, think: false }],
    ["native default", "/api/chat", { model: "qwen3.8:latest", messages: [{ role: "user", content: "Say OK in exactly one word." }], stream: false }],
  ];
  for (const [name, path, body] of variants) {
    const t0 = Date.now();
    try {
      const r = await post(path, body);
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      let j = {};
      try { j = JSON.parse(r.text); } catch {}
      const msg = j.message || {};
      console.log(`${name}: ${secs}s status=${r.status} content_len=${(msg.content || "").length} reasoning_len=${(msg.thinking || msg.reasoning_content || "").length} eval_count=${j.eval_count} prompt_count=${j.prompt_eval_count} first80=${JSON.stringify((msg.content || "").slice(0, 80))}`);
    } catch (e) {
      console.log(`${name}: ERR ${e.message}`);
    }
  }
})();

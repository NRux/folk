"use strict";
// Measure native /api/chat speed with think:false at 300 tokens.
const http = require("http");
const data = JSON.stringify({ model: "qwen3.8:latest", stream: false, think: false, messages: [{ role: "user", content: "Write exactly 300 words about the color of indigo dye." }], options: { num_predict: 300 } });
const t0 = Date.now();
const req = http.request({ method: "POST", hostname: "127.0.0.1", port: 11434, path: "/api/chat", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } }, (res) => {
  const chunks = [];
  res.on("data", (c) => chunks.push(c));
  res.on("end", () => {
    const secs = (Date.now() - t0) / 1000;
    const j = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
    console.log(`native think:false: ${secs.toFixed(1)}s, eval_count=${j.eval_count} tok -> ${((j.eval_count || 0) / secs).toFixed(1)} tok/s; 3000 tokens ~ ${((3000 / (j.eval_count || 1)) * secs / 60).toFixed(1)} min`);
    console.log("content first 120:", JSON.stringify((j.message && j.message.content || "").slice(0, 120)));
  });
});
req.on("error", (e) => console.error("ERR", e.message));
req.setTimeout(600000, () => req.destroy(new Error("timeout")));
req.write(data);
req.end();

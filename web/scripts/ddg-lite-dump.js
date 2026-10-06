"use strict";
// Dump a slice of ddg-lite result HTML to design the parser.
const https = require("https");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const data = new URLSearchParams({ q: "Tokushima aizome indigo dyeing" }).toString();
const req = https.request({ method: "POST", hostname: "lite.duckduckgo.com", path: "/lite/", headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(data), "User-Agent": UA } }, (res) => {
  const chunks = [];
  res.on("data", (c) => chunks.push(c));
  res.on("end", () => {
    const html = Buffer.concat(chunks).toString("utf-8");
    const fs = require("fs");
    fs.writeFileSync("C:/Users/noaha/AppData/Local/hermes/cache/scratch/ddg-lite-sample.html", html);
    // find the result anchor pattern
    const idx = html.indexOf("result-link");
    console.log("result-link idx:", idx);
    console.log(html.slice(Math.max(0, idx - 300), idx + 900));
  });
});
req.on("error", (e) => console.error("ERR", e.message));
req.write(data);
req.end();

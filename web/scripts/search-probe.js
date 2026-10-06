"use strict";
// Probe alternative HTML search endpoints from this host.
const https = require("https");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const Q = "Tokushima aizome indigo dyeing";

function probe(name, url, method, data) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const headers = { "User-Agent": UA, Accept: "text/html" };
    if (data) { headers["Content-Type"] = "application/x-www-form-urlencoded"; headers["Content-Length"] = Buffer.byteLength(data); }
    const req = https.request({ method: method || "GET", hostname: u.hostname, path: u.pathname + u.search, headers }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const html = Buffer.concat(chunks).toString("utf-8");
        resolve(`${name}: status=${res.statusCode} len=${html.length}`);
      });
    });
    req.on("error", (e) => resolve(`${name}: ERR ${e.message}`));
    req.setTimeout(20000, () => req.destroy(new Error("timeout")));
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  const results = [];
  results.push(await probe("ddg-lite POST", "https://lite.duckduckgo.com/lite/", "POST", new URLSearchParams({ q: Q }).toString()));
  results.push(await probe("bing GET", "https://www.bing.com/search?q=" + encodeURIComponent(Q) + "&count=10"));
  results.push(await probe("mojeek GET", "https://www.mojeek.com/search?q=" + encodeURIComponent(Q)));
  results.push(await probe("startpage GET", "https://www.startpage.com/sp/search?query=" + encodeURIComponent(Q)));
  console.log(results.join("\n"));
})();

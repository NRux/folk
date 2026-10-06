"use strict";
const https = require("https");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const q = "Tokushima aizome indigo dyeing";
const payload = new URLSearchParams({ q }).toString();
const variants = [
  { name: "POST html", url: "https://html.duckduckgo.com/html/", data: payload },
  { name: "GET html q", url: "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q), data: null },
];
(async () => {
  for (const v of variants) {
    const out = await new Promise((resolve, reject) => {
      const u = new URL(v.url);
      const req = https.request(
        {
          method: v.data ? "POST" : "GET",
          hostname: u.hostname,
          path: u.pathname + u.search,
          headers: {
            "Content-Type": v.data ? "application/x-www-form-urlencoded" : undefined,
            ...(v.data ? { "Content-Length": Buffer.byteLength(v.data) } : {}),
            "User-Agent": UA,
          },
        },
        (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => resolve({ status: res.statusCode, loc: res.headers.location, html: Buffer.concat(chunks).toString("utf-8") }));
        }
      );
      req.on("error", reject);
      req.setTimeout(25000, () => req.destroy(new Error("timeout")));
      if (v.data) req.write(v.data);
      req.end();
    }).catch((e) => ({ err: e.message }));
    if (out.err) { console.log(v.name, "ERR", out.err); continue; }
    const blocks = out.html.split(/class="links_main links_deep"/).length - 1;
    const resultA = (out.html.match(/class="result__a"/g) || []).length;
    console.log(v.name, "status=" + out.status, "len=" + out.html.length, "blocks=" + blocks, "result__a=" + resultA, out.loc ? "loc=" + out.loc : "");
    if (blocks === 0 && resultA === 0) console.log("   first 400:", JSON.stringify(out.html.slice(0, 400)));
  }
})();

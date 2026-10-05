"use strict";
// Stage 02 verification: fetch every route from the NEW server and compare the
// visible text against the stage 01 captures. Also checks both URL forms.
const fs = require("fs");
const path = require("path");

const BASE = "http://localhost:8787";
const PRES = path.join(__dirname, "..", "..", "docs", "preservation");
const OUT = path.join(__dirname, "..", "..", "docs", "verification", "stage-02-url-check.md");

// --- minimal text extraction (same approach as the capture script) ---
function extractText(html) {
  const noScript = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  const noHead = noScript.replace(/<head[\s\S]*?<\/head>/gi, "");
  const noStyle = noHead.replace(/<style[\s\S]*?<\/style>/gi, "");
  const text = noStyle.replace(/<[^>]+>/g, "\n")
    .replace(/&amp;/g, "&").replace(/&middot;/g, "·").replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘").replace(/&ldquo;/g, "“").replace(/&rdquo;/g, "”")
    .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  return text.split("\n").map((s) => s.trim()).filter(Boolean);
}

function linesOf(mdPath) {
  const md = fs.readFileSync(mdPath, "utf-8");
  const idx = md.indexOf("## Full visible text");
  if (idx < 0) return null;
  return md.slice(idx + "## Full visible text".length).split("\n").map((s) => s.trim()).filter(Boolean);
}

async function get(url) {
  const r = await fetch(url);
  return { status: r.status, text: await r.text() };
}

const SLUGS = ["new-orleans-second-line", "lisbon-fado", "oaxaca-living-color", "detroit-future-frequency"];
const ROUTES = [
  { path: "/", capture: "index.md" },
  { path: "/index.html", capture: "index.md" },
  { path: "/perspective", capture: "perspective.md" },
  { path: "/perspective.html", capture: "perspective.md" },
  { path: "/about", capture: "about.md" },
  { path: "/about.html", capture: "about.md" },
  ...SLUGS.flatMap((s) => [{ path: `/${s}`, capture: `${s}.md` }, { path: `/${s}.html`, capture: `${s}.md` }]),
];

(async () => {
  const results = [];
  for (const r of ROUTES) {
    const res = await get(BASE + r.path);
    const rendered = extractText(res.text);
    const captured = linesOf(path.join(PRES, "pages", r.capture));
    let match = null;
    if (captured) {
      match = {
        captured_lines: captured.length,
        rendered_lines: rendered.length,
        missing_in_rendered: captured.filter((l) => !rendered.includes(l)),
        extra_in_rendered: rendered.filter((l) => !captured.includes(l)),
      };
      match.ok = match.missing_in_rendered.length === 0 && match.extra_in_rendered.length === 0;
    }
    results.push({ path: r.path, status: res.status, match });
    console.log(`${r.path.padEnd(32)} ${res.status} ${match ? (match.ok ? "TEXT MATCH" : `DIFF missing=${match.missing_in_rendered.length} extra=${match.extra_in_rendered.length}`) : "no capture"}`);
  }

  // static checks
  const css = await get(BASE + "/style.css");
  const cssOk = css.status === 200;
  const asset = await get(BASE + "/assets/new-orleans.jpg");
  const assetOk = asset.status === 200;

  // write report
  const lines = [
    "# Stage 02 — URL & content parity check",
    "",
    `- Server: ${BASE} (node web/server.js, db web/folkly.db)`,
    `- Date: ${new Date().toISOString()}`,
    "",
    "| Route | Status | Text parity vs stage-01 capture |",
    "|-------|--------|----------------------------------|",
  ];
  for (const r of results) {
    lines.push(`| ${r.path} | ${r.status} | ${r.match ? (r.match.ok ? "exact" : `missing ${r.match.missing_in_rendered.length} / extra ${r.match.extra_in_rendered.length}`) : "—"} |`);
  }
  lines.push("", `style.css: HTTP ${css.status} (${cssOk ? "ok" : "FAIL"}); /assets/new-orleans.jpg: HTTP ${asset.status} (${assetOk ? "ok" : "FAIL"})`, "");
  for (const r of results) {
    if (r.match && !r.match.ok) {
      lines.push(`## Diff ${r.path}`);
      lines.push("");
      lines.push("Missing from rendered:");
      for (const l of r.match.missing_in_rendered.slice(0, 20)) lines.push(`- ${l}`);
      lines.push("");
      lines.push("Extra in rendered:");
      for (const l of r.match.extra_in_rendered.slice(0, 20)) lines.push(`- ${l}`);
      lines.push("");
    }
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, lines.join("\n"));
  console.log(`\nReport: ${OUT}`);
  const bad = results.filter((r) => r.status !== 200 || (r.match && !r.match.ok));
  console.log(bad.length === 0 ? "ALL ROUTES PASS" : `${bad.length} ROUTES NEED ATTENTION`);
})().catch((e) => { console.error(e); process.exit(1); });

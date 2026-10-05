"use strict";
// Stage 03 verification: author pages, disclosure, archives, related stories,
// Article JSON-LD, homepage placement, and stage-02 route regression.
// Writes docs/verification/stage-03-personas.md.
const fs = require("fs");
const path = require("path");
const BASE = process.env.FOLKLY_BASE || "http://localhost:8787";

const DISCLOSURE = "Written with AI using the ";
const PERSONAS = [
  { id: "mira-sol", name: "Mira Sol" },
  { id: "ellis-reed", name: "Ellis Reed" },
  { id: "lena-march", name: "Lena March" },
  { id: "rowan-pike", name: "Rowan Pike" },
  { id: "sasha-wren", name: "Sasha Wren" },
];
const SLUGS = ["new-orleans-second-line", "lisbon-fado", "oaxaca-living-color", "detroit-future-frequency"];

async function get(u) {
  const r = await fetch(BASE + u);
  return { status: r.status, html: await r.text() };
}

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  [" + detail + "]" : ""}`);
}

async function main() {
  // 1. Five distinct author pages with exact disclosure
  const specimens = [];
  for (const p of PERSONAS) {
    const { status, html } = await get(`/author/${p.id}`);
    const disc = html.includes(DISCLOSURE + p.name + " editorial persona; researched from the linked sources.");
    const h1 = html.includes(`<h1>${p.name}</h1>`);
    const bio = html.includes("AI editorial persona, not a person");
    const brief = html.includes("How this persona writes") && html.includes("Style specimen");
    const tags = (html.match(/class="tag"/g) || []).length;
    specimens.push(html);
    check(`author page /author/${p.id}`, status === 200 && h1 && disc && bio && brief && tags >= 4,
      `status=${status} h1=${h1} disclosure=${disc} bio=${bio} brief=${brief} tags=${tags}`);
  }
  // materially different profiles: names, beats, specimens all distinct
  const distinct = new Set(PERSONAS.map((p) => p.name)).size === 5;
  const voiceSamples = PERSONAS.map((p) => (specimens.find((s) => s.includes(`>How this persona writes<`)) || "").match(/<dt>Voice<\/dt><dd>(.*?)<\/dd>/));
  const voices = (html) => { const m = voiceSamples.map((v) => v && v[1]); return m; };
  const allVoices = PERSONAS.map((p, i) => (specimens[i].match(/<dt>Voice<\/dt><dd>([\s\S]*?)<\/dd>/) || [])[1]);
  const distinctVoices = new Set(allVoices).size === PERSONAS.length && allVoices.every(Boolean);
  check("acceptance case 2: distinct profiles + materially different voice samples", distinct && distinctVoices,
    `distinct names=${distinct} distinct voices=${distinctVoices}`);

  // 2. Disclosure on articles
  for (const slug of SLUGS) {
    const { status, html } = await get(`/${slug}`);
    const disc = /Written with AI using the (Folkly|Mira Sol|Ellis Reed|Lena March|Rowan Pike|Sasha Wren) editorial persona; researched from the linked sources\./.test(html);
    const legacy = html.includes("Folkly editorial · October 2026 · 3 min read");
    const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    let ldOk = false;
    let ldType = "";
    let ldDate = "";
    if (ld) {
      const o = JSON.parse(ld[1]);
      ldType = o["@type"];
      ldDate = o.datePublished || "";
      ldOk = ldType === "Article" && !!o.datePublished && !!o.author && !!o.publisher &&
        !JSON.stringify(o).toLowerCase().includes("reviewedBy") &&
        !JSON.stringify(o).includes("fake");
    }
    check(`article /${slug}: disclosure + legacy byline + Article JSON-LD`, status === 200 && disc && legacy && ldOk,
      `status=${status} disclosure=${disc} legacyByline=${legacy} ld=${ldType}@${ldDate}`);
  }

  // 3. Archives
  const idx = await get("/archive");
  const idxOk = idx.status === 200 && idx.html.includes("The archives") && idx.html.includes("By place") && idx.html.includes("By topic") && idx.html.includes("By editorial persona");
  check("archive index /archive", idxOk, `status=${idx.status}`);
  const place = await get("/archive/place/new-orleans-united-states");
  const placeOk = place.status === 200 && place.html.includes("Stories from New Orleans, United States") && place.html.includes("new-orleans-second-line");
  check("archive by place (new-orleans-united-states)", placeOk, `status=${place.status}`);
  const topic = await get("/archive/topic/sound-memory");
  const topicOk = topic.status === 200 && topic.html.includes("Stories about Sound &amp; memory") && topic.html.includes("lisbon-fado");
  check("archive by topic (sound-memory)", topicOk, `status=${topic.status}`);

  // 4. Related stories (present on every article; same-issue fallback when the
  //    archive is too small for a topical match)
  for (const slug of SLUGS) {
    const { html } = await get(`/${slug}`);
    const m = html.match(/<section class="related">([\s\S]*?)<\/section>/);
    const count = m ? (m[1].match(/<li>/g) || []).length : 0;
    check(`related stories on /${slug}`, !!m && count >= 1, `links=${count}`);
  }

  // 5. Homepage: new-article placement + archive nav
  const home = await get("/");
  const homeOk = home.status === 200 && home.html.includes('href="/archive"') && home.html.includes("The cover story");
  check("homepage: cover style retained + Archives nav", homeOk, `status=${home.status}`);

  // 6. Stage-02 regression: all baseline routes still 200 with key markers
  const baseline = [
    ["/", "folkly"],
    ["/perspective", "Perspective"],
    ["/about", "About"],
    ["/style.css", "--paper"],
  ];
  for (const [u, marker] of baseline) {
    const r = await get(u);
    check(`regression ${u}`, r.status === 200 && r.html.toLowerCase().includes(marker.toLowerCase()), `status=${r.status}`);
  }
  for (const slug of SLUGS) {
    const a = await get(`/${slug}`);
    const b = await get(`/${slug}.html`);
    const same = a.html === b.html;
    check(`regression /${slug} == /${slug}.html`, same, a.status + "/" + b.status);
  }

  // summary + report
  const failed = results.filter((r) => !r.ok);
  const lines = [
    "# Stage 03 Verification — Personas, rendering, archives, metadata",
    "",
    `Date: ${new Date().toISOString()}`,
    `Base: ${BASE}`,
    "",
    `Total checks: ${results.length}, passed: ${results.length - failed.length}, failed: ${failed.length}`,
    "",
    "| Check | Result | Detail |",
    "|---|---|---|",
    ...results.map((r) => `| ${r.name} | ${r.ok ? "PASS" : "FAIL"} | ${r.detail} |`),
    "",
    `Overall: ${failed.length === 0 ? "ALL PASS" : "FAILURES PRESENT"}`,
    "",
  ];
  fs.mkdirSync(path.join(__dirname, "..", "..", "docs", "verification"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "..", "..", "docs", "verification", "stage-03-personas.md"), lines.join("\n"));
  console.log(`\n${failed.length === 0 ? "ALL PASS" : failed.length + " FAILURES"} — report written to docs/verification/stage-03-personas.md`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });

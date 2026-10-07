"use strict";
// Hosted read/security checks that do not mutate editorial records.
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const path = require("node:path");

const ORIGIN = "https://folkly-journal.nrapp.chatgpt.site";
const db = new DatabaseSync(path.join(__dirname, "..", "folkly.db"), { readOnly: true });
const published = db.prepare("SELECT slug,title FROM articles WHERE status='published' AND byline_legacy IS NOT NULL ORDER BY slug").all();
const reserve = db.prepare("SELECT slug,title FROM articles WHERE status='draft' AND pipeline_state='ready' ORDER BY slug").all();
const personas = db.prepare("SELECT slug FROM personas WHERE active=1 ORDER BY slug").all();
let checks = 0;
async function get(p, init) {
  const r = await fetch(ORIGIN + p, { redirect: "manual", ...init });
  return { status: r.status, text: await r.text(), headers: r.headers };
}
async function verify() {
  const root = await get("/");
  assert.equal(root.status, 200); checks++;
  assert.equal(root.headers.get("cache-control"), "no-store"); checks++;
  const home = root.text;
  for (const article of published) {
    const a = await get(`/${article.slug}`);
    const b = await get(`/${article.slug}.html`);
    const main = (text) => text.match(/<main\b[^>]*>[\s\S]*?<\/main>/i)?.[0];
    assert.equal(a.status, 200); assert.equal(b.status, 200);
    assert.ok(main(a.text)); assert.equal(main(a.text), main(b.text)); checks += 4;
    assert.ok(a.text.includes(article.title)); checks++;
    const content = JSON.parse(db.prepare("SELECT content_json FROM article_versions WHERE article_id=(SELECT id FROM articles WHERE slug=?) ORDER BY version DESC LIMIT 1").get(article.slug).content_json);
    if (content.figure?.figcaption_html) { assert.ok(a.text.includes(content.figure.figcaption_html)); checks++; }
  }
  for (const person of personas) { assert.equal((await get(`/author/${person.slug}`)).status, 200); checks++; }
  for (const p of ["/archive", "/about", "/perspective", "/style.css", "/assets/new-orleans.jpg"]) {
    assert.equal((await get(p)).status, 200); checks++;
  }
  for (const article of reserve) {
    const r = await get(`/${article.slug}`);
    assert.equal(r.status, 404); assert.equal(r.headers.get("cache-control"), "no-store"); checks += 2;
    assert.ok(!home.includes(article.title)); checks++;
  }
  for (const p of ["/admin", "/api/admin", "/api/bootstrap"]) {
    const r = await get(p);
    assert.equal(r.status, p === "/api/bootstrap" ? 404 : 401); checks++;
  }
  const mcp = await get("/mcp", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "folkly_status", arguments: {} } }) });
  assert.equal(mcp.status, 401); checks++;
  return { checks, published: published.length, readyPrivate: reserve.length, authors: personas.length };
}
verify().then((result) => { console.log(JSON.stringify(result)); db.close(); }, (error) => {
  console.error(error); db.close(); process.exitCode = 1;
});

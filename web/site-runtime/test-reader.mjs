import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readerFetch } from "./reader.mjs";

const source = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "folkly.db");
const db = new DatabaseSync(source, { readOnly: true });
const env = { DB: {
  prepare(sql) {
    let values = [];
    return {
      bind(...args) { values = args; return this; },
      first() { return db.prepare(sql).get(...values) ?? null; },
      all() { return { results: db.prepare(sql).all(...values) }; },
    };
  },
} };
const get = (pathname) => readerFetch(new Request(`https://folkly-journal.nrapp.chatgpt.site${pathname}`), env);

try {
  const published = db.prepare("SELECT slug, title FROM articles WHERE status='published'").all();
  for (const { slug, title } of published) {
    const extensionless = await get(`/${slug}`);
    const suffix = await get(`/${slug}.html`);
    assert.equal(extensionless.status, 200);
    assert.equal(await extensionless.text(), await suffix.text());
    assert.match(await (await get(`/${slug}`)).text(), new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const pathname of ["/", "/index.html", "/about", "/about.html", "/perspective", "/perspective.html", "/archive"]) {
    assert.equal((await get(pathname)).status, 200, pathname);
  }
  const people = db.prepare("SELECT slug FROM personas WHERE active=1").all();
  for (const { slug } of people) assert.equal((await get(`/author/${slug}`)).status, 200);
  const privateArticle = db.prepare("SELECT slug,title FROM articles WHERE pipeline_state='ready' AND status='draft' LIMIT 1").get();
  assert.ok(privateArticle);
  assert.equal((await get(`/${privateArticle.slug}`)).status, 404);
  for (const pathname of ["/", "/archive", "/api/articles", "/admin", "/mcp"]) {
    const response = await get(pathname);
    assert.doesNotMatch(await response.text(), new RegExp(privateArticle.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  assert.equal((await get("/style.css")).status, 404); // no asset binding in this isolated fixture
  console.log(`D1 reader fixture passed: ${published.length} legacy articles, ${people.length} authors, both URL forms, private reserve isolation`);
} finally { db.close(); }

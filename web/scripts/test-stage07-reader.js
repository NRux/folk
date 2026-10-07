"use strict";
// Clean-checkout reader acceptance fixture. Never touches the operational database.
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "folkly-reader-"));
  const dbFile = path.join(dir, "reader.db");
  const env = { ...process.env, FOLKLY_DB: dbFile };
  let server;
  try {
    for (const script of ["migrate.js", "seed-personas.js"]) {
      const result = spawnSync(process.execPath, [path.join(__dirname, script)], { env, encoding: "utf8" });
      assert.equal(result.status, 0, `${script}: ${result.stderr || result.stdout}`);
    }
    process.env.FOLKLY_DB = dbFile;
    ({ server } = require("../server"));
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const get = async (route) => {
      const response = await fetch(base + route);
      return { response, body: await response.text() };
    };
    const slugs = ["new-orleans-second-line", "lisbon-fado", "oaxaca-living-color", "detroit-future-frequency"];
    for (const slug of slugs) {
      const plain = await get(`/${slug}`);
      const html = await get(`/${slug}.html`);
      assert.equal(plain.response.status, 200, slug);
      assert.equal(html.response.status, 200, slug + ".html");
      assert.equal(plain.body, html.body, slug + " URL parity");
      assert.match(plain.body, /Written with AI using the Folkly editorial persona/);
      assert.match(plain.body, /<script type="application\/ld\+json">/);
    }
    const { db } = require("../server");
    const id = "stage07-private-draft";
    const now = new Date().toISOString();
    db.prepare("INSERT INTO articles(id,slug,title,deck,status,pipeline_state,content_hash,created_at,updated_at) VALUES(?,?,?,?,'draft','ready',?,?,?)")
      .run(id, id, "PRIVATE DRAFT CANARY", "PRIVATE DRAFT CANARY", "canary", now, now);
    db.prepare("INSERT INTO article_versions(id,article_id,version,content_json,created_by,created_at) VALUES(?,?,1,?,'fixture',?)")
      .run(id + "-v1", id, JSON.stringify({ deck: "PRIVATE DRAFT CANARY", body_html: "<p>PRIVATE DRAFT CANARY</p>" }), now);
    const readerRoutes = ["/", "/index.html", "/archive", "/archive.html", "/archive/place/new-orleans-united-states", "/archive/topic/sound-memory", "/author/mira-sol", "/perspective", "/about", ...slugs.flatMap(s => [`/${s}`, `/${s}.html`])];
    for (const route of readerRoutes) {
      const { response, body } = await get(route);
      assert.equal(response.status, 200, route);
      assert.doesNotMatch(body, /PRIVATE DRAFT CANARY|stage07-private-draft/, `draft leaked at ${route}`);
      assert.equal(response.headers.get("cache-control"), "no-store", route);
    }
    for (const route of [`/${id}`, `/${id}.html`, "/feed", "/feed.xml", "/rss.xml", "/sitemap.xml", "/robots.txt", "/api/articles", "/api/admin/dashboard"]) {
      const { response, body } = await get(route);
      assert.ok([401, 403, 404, 503].includes(response.status), `${route}: ${response.status}`);
      assert.doesNotMatch(body, /PRIVATE DRAFT CANARY|stage07-private-draft/, route);
      assert.equal(response.headers.get("cache-control"), "no-store", route);
    }
    for (const route of ["/archive", "/archive/place/new-orleans-united-states", "/archive/topic/sound-memory"]) {
      const { body } = await get(route);
      assert.match(body, /new-orleans-second-line|lisbon-fado/, route);
    }
    console.log("PASS Stage 07 reader fixture: legacy URLs, archives, draft isolation, private API, metadata/feed/cache surfaces");
  } finally {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    if (server) require("../server").db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

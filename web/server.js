"use strict";
// Folkly server: zero-dependency Node HTTP server serving the magazine from the content store.
// Routes:
//   /                     homepage (composed from articles in the store)
//   /<slug>               article (published only)
//   /<slug>.html          same content, both forms resolve (acceptance case 1)
//   /perspective|/about   stored page blocks
//   /style.css, /assets/* static
//   /admin                control room (built in stage 05; minimal stub until then)
const http = require("http");
const fs = require("fs");
const path = require("path");
const { openDb, settingsGetAll } = require("./lib/db");
const { Page, renderArticle, renderHome, renderSimplePage, esc } = require("./lib/render");

const DB_FILE = process.env.FOLKLY_DB || path.join(__dirname, "folkly.db");
const STATIC = path.join(__dirname, "static");
const PORT = parseInt(process.env.FOLKLY_PORT || "8787", 10);

const db = openDb(DB_FILE);

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
};

function publishedArticles() {
  return db
    .prepare("SELECT * FROM articles WHERE status = 'published' ORDER BY home_position IS NULL, home_position")
    .all();
}

function articleContentJson(slug) {
  const row = db
    .prepare(
      `SELECT v.content_json FROM article_versions v JOIN articles a ON a.id = v.article_id
       WHERE a.slug = ? AND v.version = (SELECT MAX(version) FROM article_versions WHERE article_id = a.id)`
    )
    .get(slug);
  return row ? JSON.parse(row.content_json) : null;
}

function articleBySlug(slug) {
  return db.prepare("SELECT * FROM articles WHERE slug = ?").get(slug);
}

function pageBlock(slug) {
  return db.prepare("SELECT * FROM page_blocks WHERE slug = ?").get(slug);
}

function send(res, code, type, body) {
  res.writeHead(code, {
    "Content-Type": type,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const settings = settingsGetAll(db);
  const page = new Page({
    domain: settings["site.canonical_domain"],
    canonicalForm: settings["site.canonical_form"] || "html",
    settings,
  });
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  } catch {
    return send(res, 400, "text/plain", "bad request");
  }
  const p = url.pathname;

  // static
  if (p === "/style.css" || p.startsWith("/assets/")) {
    const file = path.normalize(path.join(STATIC, p));
    if (!file.startsWith(STATIC)) return send(res, 403, "text/plain", "forbidden");
    fs.readFile(file, (err, data) => {
      if (err) return send(res, 404, "text/plain", "not found");
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "public, max-age=3600" });
      res.end(data);
    });
    return;
  }

  // home
  if (p === "/" || p === "/index.html") {
    const arts = publishedArticles();
    const cover = arts.find((a) => a.is_cover) || arts[0];
    const rest = arts.filter((a) => a !== cover).slice(0, 4);
    const html =
      page.head("Culture takes place | Folkly", settings["site.home_description"] || "Folkly is a cultural journal exploring the practices, places, and histories that shape distinctive identities.") +
      page.homeHeader(settings["site.issue_label"] || "Issue 01 / The things we carry") +
      (cover ? renderHome(page, cover, rest, arts.slice(0, 8)) : `<main id="main" class="shell"><section class="intro"><h1>Culture takes place.</h1><p>The journal is being prepared.</p></section></main>`) +
      page.footer();
    return send(res, 200, "text/html; charset=utf-8", html);
  }

  // stored pages
  const pageSlug = p === "/perspective" || p === "/perspective.html"
    ? "perspective"
    : p === "/about" || p === "/about.html"
      ? "about"
      : null;
  if (pageSlug) {
    const block = pageBlock(pageSlug);
    if (!block) return send(res, 404, "text/plain", "not found");
    const html = page.head(block.title, block.meta_description || "", { type: "website", canonicalSlug: pageSlug }) +
      page.compactHeader() + renderSimplePage(page, block) + page.footer();
    return send(res, 200, "text/html; charset=utf-8", html);
  }

  // articles (both URL forms)
  let slug = p.replace(/^\/+|\/+$/g, "").replace(/\.html$/, "");
  if (slug && !["perspective", "about", "index"].includes(slug) && !slug.includes("/")) {
    const art = articleBySlug(slug);
    if (art && art.status === "published") {
      const content = articleContentJson(slug);
      if (content) {
        let next = null;
        if (art.next_story_slug) next = articleBySlug(art.next_story_slug);
        const html = page.head(art.title + " | Folkly", content.deck || art.deck || "", { type: "article", canonicalSlug: slug }) +
          page.compactHeader() + renderArticle(page, art, content, next) + page.footer();
        return send(res, 200, "text/html; charset=utf-8", html);
      }
    }
  }

  // admin (stub until stage 05)
  if (p === "/admin" || p.startsWith("/admin/")) {
    return send(res, 200, "text/html; charset=utf-8",
      `<!doctype html><html><head><meta charset="utf-8"><title>Admin | Folkly</title></head><body><h1>Folkly control room</h1><p>Under construction (stage 05).</p></body></html>`);
  }

  return send(res, 404, "text/plain", "not found");
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`Folkly server listening on http://localhost:${PORT} (db: ${DB_FILE})`));
}

module.exports = { server, db };

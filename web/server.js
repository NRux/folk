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
const {
  Page,
  renderArticle,
  renderHome,
  renderSimplePage,
  renderAuthorPage,
  renderArchivePage,
  renderArchivesIndex,
  relatedStories,
  bodyStats,
  slugify,
  esc,
} = require("./lib/render");

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

function personasMap() {
  return new Map(db.prepare("SELECT * FROM personas WHERE active = 1").all().map((r) => [r.id, r]));
}

function briefsMap() {
  const rows = db
    .prepare(
      `SELECT pb.persona_id, pb.brief_json FROM persona_briefs pb
       JOIN (SELECT persona_id, MAX(version) v FROM persona_briefs GROUP BY persona_id) m
       ON m.persona_id = pb.persona_id AND m.v = pb.version`
    )
    .all();
  return new Map(rows.map((r) => [r.persona_id, r]));
}

function buildPage(settings) {
  return new Page({
    domain: settings["site.canonical_domain"],
    canonicalForm: settings["site.canonical_form"] || "html",
    settings,
    personas: personasMap(),
    briefs: briefsMap(),
    allPublished: publishedArticles(),
  });
}

// Article JSON-LD (spec section 5: Article structured data without fake credentials
// or review claims). Author is the persona (or the Folkly editorial organization for
// legacy pre-persona articles).
function articleJsonLd(page, art, content) {
  const persona = art.persona_id ? page.personas.get(art.persona_id) : null;
  const datePublished = new Date(art.created_at).toISOString();
  const dateModified = new Date(art.updated_at).toISOString();
  const author = persona
    ? { "@type": "Person", name: persona.name, description: `${persona.name} is an AI editorial persona at Folkly. This article was written with AI using the ${persona.name} editorial persona; researched from the linked sources.` }
    : { "@type": "Organization", name: "Folkly editorial", description: "Folkly editorial persona; this article was written with AI using the Folkly editorial persona; researched from the linked sources." };
  const obj = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: art.title,
    description: content.deck || art.deck || "",
    datePublished,
    dateModified,
    author,
    publisher: { "@type": "Organization", name: "Folkly", url: `https://${page.domain}/` },
    mainEntityOfPage: page.absUrl(art.slug),
  };
  if (content.figure && content.figure.src) obj.image = `https://${page.domain}${content.figure.src}`;
  if (art.place_label) obj.keywords = [art.place_label, art.category || ""].filter(Boolean).join(", ");
  return obj;
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
  const page = buildPage(settings);
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

  // author pages (stage 03)
  const authorMatch = p.match(/^\/author\/([a-z0-9-]+)(?:\.html)?$/i);
  if (authorMatch) {
    const persona = db.prepare("SELECT * FROM personas WHERE slug = ? AND active = 1").get(authorMatch[1]);
    if (!persona) return send(res, 404, "text/plain", "not found");
    const brief = db.prepare("SELECT brief_json FROM persona_briefs WHERE persona_id = ? ORDER BY version DESC LIMIT 1").get(persona.id);
    page.briefs.set(persona.id, brief ? { brief_json: brief.brief_json } : null);
    const html =
      page.head(`${persona.name} | Folkly`, persona.bio_public, { type: "profile", canonicalSlug: `author/${persona.slug}` }) +
      page.compactHeader() + renderAuthorPage(page, persona) + page.footer();
    return send(res, 200, "text/html; charset=utf-8", html);
  }

  // archives: index, by place, by topic (stage 03)
  if (p === "/archive" || p === "/archive.html") {
    const html = page.head("Archives | Folkly", "Every story in the Folkly journal, organized by place, topic, and editorial persona.", { type: "website", canonicalSlug: "archive" }) +
      page.compactHeader() + renderArchivesIndex(page) + page.footer();
    return send(res, 200, "text/html; charset=utf-8", html);
  }
  const archiveMatch = p.match(/^\/archive\/(place|topic)\/([a-z0-9-]+)(?:\.html)?$/i);
  if (archiveMatch) {
    const [, kind, slug] = archiveMatch;
    const row =
      kind === "place"
        ? page.allPublished.find((a) => slugify(a.place_label || "") === slug || slugify(a.country || "") === slug)
        : page.allPublished.find((a) => slugify(a.category || "") === slug || slugify(a.home_eyebrow || "") === slug);
    const label = row ? (kind === "place" ? row.place_label : row.category) : slug.replace(/-/g, " ");
    const html =
      page.head(`${kind === "place" ? "Stories from" : "Stories about"} ${label} | Folkly`, `Folkly archive ${kind === "place" ? "by place" : "by topic"}: ${label}.`, { type: "website", canonicalSlug: `archive/${kind}/${slug}` }) +
      page.compactHeader() + renderArchivePage(page, { kind, value: label, title: kind === "place" ? `Stories from ${label}` : `Stories about ${label}` }) + page.footer();
    return send(res, 200, "text/html; charset=utf-8", html);
  }

  // articles (both URL forms)
  let slug = p.replace(/^\/+|\/+$/g, "").replace(/\.html$/, "");
  if (slug && !["perspective", "about", "index", "archive"].includes(slug) && !slug.includes("/")) {
    const art = articleBySlug(slug);
    if (art && art.status === "published") {
      const content = articleContentJson(slug);
      if (content) {
        let next = null;
        if (art.next_story_slug) next = articleBySlug(art.next_story_slug);
        const related = relatedStories(page, art);
        const html =
          page.head(art.title + " | Folkly", content.deck || art.deck || "", { type: "article", canonicalSlug: slug, ld: articleJsonLd(page, art, content) }) +
          page.compactHeader() + renderArticle(page, art, content, next, related) + page.footer();
        return send(res, 200, "text/html; charset=utf-8", html);
      }
    }
  }

  // Admin UI is not implemented or authenticated yet; do not expose a public stub.
  if (p === "/admin" || p.startsWith("/admin/")) {
    return send(res, 404, "text/plain; charset=utf-8", "not found");
  }

  return send(res, 404, "text/plain", "not found");
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`Folkly server listening on http://localhost:${PORT} (db: ${DB_FILE})`));
}

module.exports = { server, db };

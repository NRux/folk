"use strict";
// Stage 02 migration: parse docs/preservation/raw/*.html into the content store.
// Idempotent: re-running with unchanged source content changes nothing.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { openDb, settingsGetAll, audit } = require("../lib/db");

const RAW = path.join(__dirname, "..", "..", "docs", "preservation", "raw");
const DB_FILE = process.env.FOLKLY_DB || path.join(__dirname, "..", "folkly.db");

const db = openDb(DB_FILE);

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const strip = (s) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&middot;/g, "·").replace(/&rsquo;/g, "’").replace(/&lsquo;/g, "‘").replace(/&ldquo;/g, "“").replace(/&rdquo;/g, "”").replace(/&quot;/g, '"').trim();
const now = () => new Date().toISOString();

function readHtml(name) {
  return fs.readFileSync(path.join(RAW, `${name}.html`), "utf-8");
}

function metaOf(html, name) {
  const m = html.match(new RegExp(`<meta name="${name}" content="([^"]*)"`, "i")) || html.match(new RegExp(`<meta property="${name}" content="([^"]*)"`, "i"));
  return m ? m[1] : null;
}

// ---------- articles ----------
const ARTICLES = [
  { slug: "new-orleans-second-line", order: 1 },
  { slug: "lisbon-fado", order: 2 },
  { slug: "oaxaca-living-color", order: 3 },
  { slug: "detroit-future-frequency", order: 4 },
];

function parseArticle(slug) {
  const html = readHtml(slug);
  const get = (re) => { const m = html.match(re); return m ? m[1] : null; };

  const eyebrow = strip(get(/<p class="eyebrow">([\s\S]*?)<\/p>/) || "");
  const title = strip(get(/<article><header class="article-header">[\s\S]*?<h1>([\s\S]*?)<\/h1>/) || get(/<h1>([\s\S]*?)<\/h1>/) || "");
  const deck = strip(get(/<p class="article-deck">([\s\S]*?)<\/p>/) || "");
  const byline = strip(get(/<p class="byline">([\s\S]*?)<\/p>/) || "");

  // figure
  let figure = null;
  const fig = html.match(/<figure class="article-figure">([\s\S]*?)<\/figure>/);
  if (fig) {
    const inner = fig[1];
    const img = inner.match(/<img ([\s\S]*?)>/);
    const attr = (re) => { const m = img && img[1].match(re); return m ? m[1] : null; };
    figure = {
      src: attr(/src="([^"]*)"/),
      alt: attr(/alt="([^"]*)"/),
      width: attr(/width="(\d+)"/),
      height: attr(/height="(\d+)"/),
      img_style: attr(/style="([^"]*)"/),
      figcaption_html: (inner.match(/<figcaption>([\s\S]*?)<\/figcaption>/) || [])[1] || "",
    };
  }

  // toc
  const aside = html.match(/<aside class="article-aside">([\s\S]*?)<\/aside>/);
  const toc = [];
  if (aside) {
    for (const m of aside[1].matchAll(/<a href="#([a-z0-9-]+)">([\s\S]*?)<\/a>/g)) {
      toc.push({ id: m[1], title: strip(m[2]) });
    }
  }

  // body: everything in article-body up to the sources section (exclusive)
  const bodyStart = html.indexOf('<div class="article-body">');
  const bodyEnd = html.indexOf('<section id="sources"');
  let body_html = "";
  if (bodyStart >= 0) {
    const end = bodyEnd > bodyStart ? bodyEnd : html.indexOf("</div></div></article>", bodyStart);
    body_html = html.slice(bodyStart + '<div class="article-body">'.length, end).replace(/\s+$/, "");
  }

  // sources
  const sources = [];
  const srcSection = html.match(/<section id="sources"[\s\S]*?<ol>([\s\S]*?)<\/ol>/);
  if (srcSection) {
    for (const m of srcSection[1].matchAll(/<li id="source-(\d+)"><strong>([\s\S]*?)<\/strong>\s*<a href="([^"]*)"[\s\S]*?>([\s\S]*?)<\/a>/g)) {
      sources.push({ ord: parseInt(m[1], 10), org: strip(m[2]).replace(/\.$/, ""), href: m[3], title: strip(m[4]) });
    }
  }

  // note
  let note = null;
  const noteMatch = html.match(/<p class="editorial-note">([\s\S]*?)<a href="about.html">About our approach<\/a>/);
  if (noteMatch) note = { text: strip(noteMatch[1]).replace(/\s+$/, "") };

  // next story
  let next_story_slug = null;
  const next = html.match(/<section class="next-story">[\s\S]*?<a href="([a-z0-9-]+)\.html">/);
  if (next) next_story_slug = next[1];

  // place label: "New Orleans, United States · Ritual & belonging"
  const eyebrowParts = eyebrow.split("·").map((s) => s.trim());
  const placeParts = (eyebrowParts[0] || "").split(",").map((s) => s.trim());

  return {
    slug,
    eyebrow,
    title,
    deck,
    byline,
    place_label: eyebrowParts[0] || "",
    country: placeParts.length > 1 ? placeParts[placeParts.length - 1] : null,
    category: eyebrowParts[1] || null,
    reading_minutes: parseInt((byline.match(/(\d+)\s*min read/) || [])[1] || "0", 10),
    figure,
    toc,
    body_html,
    sources,
    note,
    next_story_slug,
  };
}

// ---------- home composition (from index.html) ----------
function parseHome() {
  const html = readHtml("index");
  const home = {};
  // cover hero
  const hero = html.match(/<section class="hero"[\s\S]*?<\/section>/);
  if (hero) {
    const h = hero[0];
    const href = (h.match(/class="hero-image"[\s\S]*?href="([a-z0-9-]+)\.html"/) || [])[1]
      || (h.match(/<a href="([a-z0-9-]+)\.html" class="hero-image"/) || [])[1];
    home.cover = {
      slug: href,
      eyebrow: strip((h.match(/<p class="eyebrow">([\s\S]*?)<\/p>/) || [])[1] || ""),
      dekl: strip((h.match(/<h2 id="cover-title">[\s\S]*?<\/h2>\s*<p>([\s\S]*?)<\/p>/) || [])[1] || ""),
      figure_src: (h.match(/<img src="([^"]*)"/) || [])[1],
      figure_alt: (h.match(/<img[^>]*alt="([^"]*)"/) || [])[1],
      figure_w: (h.match(/<img[^>]*width="(\d+)"/) || [])[1],
      figure_h: (h.match(/<img[^>]*height="(\d+)"/) || [])[1],
    };
  }
  // story cards (grid)
  home.cards = [];
  for (const m of html.matchAll(/<article class="story-card">([\s\S]*?)<\/article>/g)) {
    const c = m[1];
    home.cards.push({
      slug: (c.match(/<a class="picture" href="([a-z0-9-]+)\.html"/) || [])[1],
      figure_src: (c.match(/<img src="([^"]*)"/) || [])[1],
      figure_alt: (c.match(/<img[^>]*alt="([^"]*)"/) || [])[1],
      figure_style: (c.match(/<img[^>]*style="([^"]*)"/) || [])[1],
      figure_w: (c.match(/<img[^>]*width="(\d+)"/) || [])[1],
      figure_h: (c.match(/<img[^>]*height="(\d+)"/) || [])[1],
      eyebrow: strip((c.match(/<p class="eyebrow">([\s\S]*?)<\/p>/) || [])[1] || ""),
      dekl: strip((c.match(/<\/h3>\s*<p>([\s\S]*?)<\/p>/) || [])[1] || ""),
    });
  }
  // text cards (detroit-style)
  for (const m of html.matchAll(/<article class="detroit">([\s\S]*?)<\/article>/g)) {
    const c = m[1];
    home.cards.push({
      slug: (c.match(/<a href="([a-z0-9-]+)\.html">/) || [])[1],
      figure_src: null,
      figure_alt: null,
      figure_style: null,
      figure_w: null,
      figure_h: null,
      eyebrow: strip((c.match(/<p class="eyebrow">([\s\S]*?)<\/p>/) || [])[1] || ""),
      dekl: strip((c.match(/<div class="right">\s*<p>([\s\S]*?)<\/p>/) || [])[1] || ""),
    });
  }
  // places
  home.places = [];
  for (const m of html.matchAll(/<a class="place-item" href="([a-z0-9-]+)\.html"><small>\d+ \/ ([^<]*)<\/small><strong>([\s\S]*?)<\/strong>\s*<span>([\s\S]*?)<\/span>/g)) {
    home.places.push({ slug: m[1], country: m[2].trim(), place: strip(m[3]), short: strip(m[4]) });
  }
  return home;
}

// ---------- page blocks ----------
function parseBlock(slug) {
  const html = readHtml(slug);
  const main = html.match(/<main id="main" class="shell">([\s\S]*?)<\/main>/);
  let inner = main ? main[1] : "";
  // rewrite relative links to site routes
  inner = inner
    .replace(/href="index\.html#stories"/g, 'href="/#stories"')
    .replace(/href="index\.html"/g, 'href="/"')
    .replace(/href="perspective\.html"/g, 'href="/perspective"')
    .replace(/href="about\.html"/g, 'href="/about"');
  return {
    title: (metaOf(html, "og:title") || "").replace(/\s*\|\s*Folkly$/, ""),
    meta_description: metaOf(html, "description"),
    main_html: inner.trim(),
  };
}

// ---------- media ----------
function parseMedia(artParsed) {
  if (!artParsed.figure || !artParsed.figure.src) return null;
  const fc = artParsed.figure.figcaption_html || "";
  const links = [...fc.matchAll(/<a href="([^"]*)">([\s\S]*?)<\/a>/g)].map((m) => ({ href: m[1], text: strip(m[2]) }));
  const photoLink = links.find((l) => l.href.includes("commons.wikimedia.org") || l.href.includes("wikimedia"));
  const licLink = links.find((l) => /creativecommons\.org\/licenses/.test(l.href));
  const captionPlain = strip(fc).replace(/\s*Photo:.*$/, "").trim();
  return {
    slug: artParsed.slug,
    file_path: artParsed.figure.src.replace(/^\//, ""),
    original_url: photoLink ? photoLink.href : null,
    creator: photoLink ? photoLink.text : null,
    license: licLink ? licLink.text : null,
    license_url: licLink ? licLink.href : null,
    attribution: photoLink && licLink ? `${photoLink.text} / ${licLink.text}` : null,
    caption: captionPlain,
    alt_text: artParsed.figure.alt,
  };
}

// ---------- run migration ----------
function migrate() {
  settingsGetAll(db);
  let changed = 0;

  // settings from captured home page
  const homeHtml = readHtml("index");
  const setSetting = (key, value) => {
    const cur = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
    if (!cur || cur.value !== value) {
      db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").run(key, value, now());
      changed++;
    }
  };
  setSetting("site.home_description", metaOf(homeHtml, "description") || "");
  setSetting("site.issue_label", (homeHtml.match(/<span class="issue">([\s\S]*?)<\/span>/) || [])[1]?.trim() || "Issue 01 / The things we carry");
  setSetting("site.footer_date", (homeHtml.match(/A project by Noah Rappaport &middot; ([^<]*)</) || [])[1]?.trim() || "October 2026");

  const home = parseHome();
  const bySlug = {};

  for (const meta of ARTICLES) {
    const a = parseArticle(meta.slug);
    bySlug[meta.slug] = a;
    const content = {
      eyebrow: a.eyebrow,
      deck: a.deck,
      byline: a.byline,
      figure: a.figure,
      toc: a.toc,
      body_html: a.body_html,
      sources: a.sources,
      note: a.note,
    };
    const contentJson = JSON.stringify(content);
    const hash = sha(contentJson);

    const existing = db.prepare("SELECT * FROM articles WHERE slug = ?").get(meta.slug);
    const bodyText = strip(a.body_html);
    const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

    if (existing) {
      if (existing.content_hash !== hash) {
        db.prepare(
          `UPDATE articles SET title=?, deck=?, place_label=?, country=?, category=?, reading_minutes=?, word_count=?, next_story_slug=?, content_hash=?, updated_at=? WHERE slug=?`
        ).run(a.title, a.deck, a.place_label, a.country, a.category, a.reading_minutes, wordCount, a.next_story_slug, hash, now(), meta.slug);
        const nv = (db.prepare("SELECT MAX(version) v FROM article_versions WHERE article_id=?").get(existing.id).v || 0) + 1;
        db.prepare("INSERT INTO article_versions (id, article_id, version, content_json, created_by, note, created_at) VALUES (?,?,?,?,?,?,?)")
          .run(`${meta.slug}-v${nv}`, existing.id, nv, contentJson, "migration", "re-migration", now());
        // refresh sources for the new version
        for (const s of a.sources) {
          db.prepare("INSERT OR REPLACE INTO sources (id, article_version_id, ord, title, org_author, url, publisher, supports_claims) VALUES (?,?,?,?,?,?,?,?)")
            .run(`${meta.slug}-v${nv}-s${s.ord}`, `${meta.slug}-v${nv}`, s.ord, s.title, s.org, s.href, null, "[]");
        }
        changed++;
      }
    } else {
      const id = meta.slug;
      db.prepare(
        `INSERT INTO articles (id, slug, title, deck, persona_id, byline_legacy, place_label, country, category, status, word_count, reading_minutes, next_story_slug, content_hash, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(id, meta.slug, a.title, a.deck, null, a.byline, a.place_label, a.country, a.category, "published", wordCount, a.reading_minutes, a.next_story_slug, hash, now(), now());
      db.prepare("INSERT INTO article_versions (id, article_id, version, content_json, created_by, note, created_at) VALUES (?,?,?,?,?,?,?)")
        .run(`${meta.slug}-v1`, id, 1, contentJson, "migration", "initial migration from live site capture", now());
      for (const s of a.sources) {
        db.prepare("INSERT INTO sources (id, article_version_id, ord, title, org_author, url, publisher, supports_claims) VALUES (?,?,?,?,?,?,?,?)")
          .run(`${meta.slug}-v1-s${s.ord}`, `${meta.slug}-v1`, s.ord, s.title, s.org, s.href, null, "[]");
      }
      changed++;
    }

    // home composition fields
    const homeInfo = meta.slug === home.cover?.slug
      ? { ...home.cover, isCover: true }
      : home.cards.find((c) => c.slug === meta.slug) || {};
    db.prepare(
      `UPDATE articles SET is_cover=?, home_position=?, home_short=?, home_place=?, home_eyebrow=?, home_dek=?,
        home_figure_src=?, home_figure_alt=?, home_figure_style=?, home_figure_w=?, home_figure_h=? WHERE slug=?`
    ).run(
      homeInfo.isCover ? 1 : 0,
      meta.order,
      (home.places.find((pl) => pl.slug === meta.slug) || {}).short || null,
      (home.places.find((pl) => pl.slug === meta.slug) || {}).place || null,
      homeInfo.eyebrow || null,
      homeInfo.dekl || null,
      homeInfo.figure_src || null,
      homeInfo.figure_alt || null,
      homeInfo.figure_style || null,
      homeInfo.figure_w || null,
      homeInfo.figure_h || null,
      meta.slug
    );

    // media
    const m = parseMedia(a);
    if (m) {
      const cur = db.prepare("SELECT * FROM media_assets WHERE file_path = ?").get(m.file_path);
      if (!cur) {
        db.prepare(
          `INSERT INTO media_assets (id, file_path, original_url, creator, license, license_url, attribution, downloaded_at, sha256, caption, alt_text, asset_kind)
           VALUES (?,?,?,?,?,?,?,?,?,?,?, 'photo')`
        ).run(m.slug + "-lead", m.file_path, m.original_url, m.creator, m.license, m.license_url, m.attribution, now(), null, m.caption, m.alt_text);
        changed++;
      }
    }
  }

  // page blocks
  for (const slug of ["perspective", "about"]) {
    const b = parseBlock(slug);
    const hash = sha(b.main_html);
    const cur = db.prepare("SELECT * FROM page_blocks WHERE slug = ?").get(slug);
    if (!cur || cur.content_hash !== hash) {
      db.prepare(
        "INSERT INTO page_blocks (slug, title, meta_description, main_html, content_hash, updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(slug) DO UPDATE SET title=excluded.title, meta_description=excluded.meta_description, main_html=excluded.main_html, content_hash=excluded.content_hash, updated_at=excluded.updated_at"
      ).run(slug, b.title, b.meta_description, b.main_html, hash, now());
      changed++;
    }
  }

  audit(db, "migration", changed ? "content-migrated" : "migration-noop", "site", null,
    changed ? `${changed} records changed` : "idempotent re-run: no changes");
  return changed;
}

const changed = migrate();
console.log(`Migration complete. Records changed: ${changed}`);
console.log("Articles:", db.prepare("SELECT slug, title, status, reading_minutes, word_count FROM articles").all().map((r) => `${r.slug} [${r.status}] ${r.reading_minutes}min ${r.word_count}w`));
console.log("Settings:", Object.entries(require("../lib/db").DEFAULTS).length, "defaults + overrides");

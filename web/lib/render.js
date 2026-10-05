"use strict";
// Folkly page renderer. Produces HTML matching the live site's structure and classes
// (see docs/preservation/raw/*.html for the captured skeleton).
const ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='7' fill='%23482b40'/%3E%3Ctext x='12' y='31' font-family='Georgia' font-weight='bold' font-size='35' fill='%23e6f078'%3Ef%3C/text%3E%3C/svg%3E";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

class Page {
  constructor(opts) {
    this.domain = opts.domain;
    this.canonicalForm = opts.canonicalForm; // "html" | "none"
    this.settings = opts.settings;
  }

  urlFor(slug, opts = {}) {
    const suffix = opts.html ? ".html" : "";
    return `/${slug}${suffix}`;
  }
  absUrl(slug) {
    return `https://${this.domain}/${slug}${this.canonicalForm === "html" ? ".html" : ""}`;
  }

  head(title, desc, { type = "website", canonicalSlug, html = false } = {}) {
    const u = canonicalSlug ? this.absUrl(canonicalSlug) : `https://${this.domain}/`;
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><meta name="theme-color" content="#f8f7f3"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="${type}"><meta property="og:url" content="${esc(u)}"><link rel="canonical" href="${esc(u)}"><link rel="icon" type="image/svg+xml" href="${ICON}"><link rel="stylesheet" href="/style.css"></head>`;
  }

  homeHeader(issueLabel) {
    return `<body><a class="skip" href="#main">Skip to content</a><header class="shell"><div class="topline"><span>A journal of culture, place &amp; belonging</span><span>Independent perspectives. Interconnected worlds.</span></div><a class="masthead" href="/" aria-label="Folkly home">folkly</a><nav class="nav" aria-label="Main navigation"><div class="navlinks"><a href="/#stories">The journal</a><a href="/#places">Places</a><a href="/perspective">Our perspective</a><a href="/about">About</a></div><span class="issue">${esc(issueLabel)}</span></nav></header>`;
  }

  compactHeader() {
    return `<body><a class="skip" href="#main">Skip to content</a><header class="shell compact-head"><a class="compact-logo" href="/" aria-label="Folkly home">folkly</a><nav aria-label="Main navigation"><a href="/#stories">The journal</a><a href="/#places">Places</a><a href="/perspective">Our perspective</a><a href="/about">About</a></nav></header>`;
  }

  footer() {
    return `<footer class="footer"><div class="shell"><div class="footer-top"><div><a class="footer-logo" href="/">folkly</a><p>Culture takes place.<br>Stories about what makes a place itself.</p></div><nav class="footer-nav" aria-label="Footer navigation"><a href="/#stories">The journal</a><a href="/perspective">Our perspective</a><a href="/about">About Folkly</a></nav></div><div class="footer-bottom"><span>A project by Noah Rappaport &middot; ${esc(this.settings["site.footer_date"] || "October 2026")}</span><span>Words, places, and the people who give them meaning.</span></div></div></footer></body></html>`;
  }
}

function renderArticle(page, art, content, nextArt) {
  const c = content;
  const parts = [];
  const tocHtml = (c.toc || [])
    .map((t) => `<a href="#${esc(t.id)}">${esc(t.title)}</a>`)
    .join("");
  const issueNote = esc(page.settings["site.issue_label"] || "Issue 01 / The things we carry")
    .replace(" / ", "<br>");
  let figureHtml = "";
  if (c.figure && c.figure.src) {
    figureHtml = `<figure class="article-figure"><img src="${esc(c.figure.src)}" alt="${esc(c.figure.alt)}"${
      c.figure.img_style ? ` style="${esc(c.figure.img_style)}"` : ""
    }${c.figure.width ? ` width="${c.figure.width}"` : ""}${c.figure.height ? ` height="${c.figure.height}"` : ""} fetchpriority="high"><figcaption>${c.figure.figcaption_html || ""}</figcaption></figure>`;
  }
  const sourcesHtml = (c.sources || [])
    .map(
      (s) =>
        `<li id="source-${s.ord}"><strong>${esc(s.org)}.</strong> <a href="${esc(s.href)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>.</li>`
    )
    .join("");
  const noteHtml = c.note
    ? `<p class="editorial-note">${esc(c.note.text)} <a href="/about">About our approach</a>.</p>`
    : "";
  const nextHtml = nextArt
    ? `<section class="next-story"><div><span class="eyebrow">Continue exploring &middot; ${esc(nextArt.place_label)}</span><h2><a href="${page.urlFor(nextArt.slug)}">${esc(nextArt.title)}</a></h2></div><a class="read" href="/#stories">Back to the journal</a></section>`
    : "";

  parts.push(
    `<main id="main" class="shell"><article><header class="article-header"><p class="eyebrow">${esc(c.eyebrow)}</p><h1>${esc(art.title)}</h1><p class="article-deck">${esc(c.deck)}</p><p class="byline">${esc(c.byline)}</p></header>${figureHtml}<div class="article-layout"><aside class="article-aside"><span class="eyebrow">In this story</span>${tocHtml}<p>${issueNote}</p></aside><div class="article-body">${c.body_html}${
      c.sources && c.sources.length
        ? `<section id="sources" class="sources"><h2>Sources &amp; further reading</h2><ol>${sourcesHtml}</ol></section>`
        : ""
    }${noteHtml}</div></div></article>${nextHtml}</main>`
  );
  return parts.join("");
}

function renderHome(page, cover, cards, places) {
  const hero = `
<section class="hero" aria-labelledby="cover-title">
<a href="${page.urlFor(cover.slug)}" class="hero-image" aria-label="Read ${esc(cover.title)}">
<img src="${esc(cover.home_figure_src)}" alt="${esc(cover.home_figure_alt)}" width="${cover.home_figure_w || ""}" height="${cover.home_figure_h || ""}" fetchpriority="high">
<span class="image-tab">The cover story</span>
</a>
<div class="hero-copy">
<p class="eyebrow">${esc(cover.home_eyebrow)}</p>
<h2 id="cover-title"><a href="${page.urlFor(cover.slug)}">${esc(cover.title)}</a></h2>
<p>${esc(cover.home_dek)}</p>
<a class="read" href="${page.urlFor(cover.slug)}">Read the story</a>
<div class="meta">Cultural essay &middot; ${cover.reading_minutes} min read</div>
</div>
</section>`;

  const gridCards = cards
    .filter((a) => a.home_figure_src)
    .map(
      (a) => `<article class="story-card">
<a class="picture" href="${page.urlFor(a.slug)}" aria-label="Read ${esc(a.title)}">
<img src="${esc(a.home_figure_src)}" alt="${esc(a.home_figure_alt)}"${a.home_figure_style ? ` style="${esc(a.home_figure_style)}"` : ""} width="${a.home_figure_w || ""}" height="${a.home_figure_h || ""}" loading="lazy">
</a>
<p class="eyebrow">${esc(a.home_eyebrow)}</p>
<h3><a href="${page.urlFor(a.slug)}">${esc(a.title)}</a></h3>
<p>${esc(a.home_dek)}</p>
<div class="meta">Cultural essay &middot; ${a.reading_minutes} min read</div>
</article>`
    )
    .join("");

  const textCards = cards
    .filter((a) => !a.home_figure_src)
    .map(
      (a) => `<article class="detroit">
<div>
<p class="eyebrow">${esc(a.home_eyebrow)}</p>
<h2><a href="${page.urlFor(a.slug)}">${esc(a.title)}</a></h2>
</div>
<div class="right">
<p>${esc(a.home_dek)}</p>
<a class="read" href="${page.urlFor(a.slug)}">Explore the story</a>
<div class="meta">Cultural essay &middot; ${a.reading_minutes} min read</div>
</div>
</article>`
    )
    .join("");

  const placeItems = places
    .map(
      (a, i) =>
        `<a class="place-item" href="${page.urlFor(a.slug)}"><small>${String(i + 1).padStart(2, "0")} / ${esc(
          (a.country || "").toUpperCase()
        )}</small><strong>${esc(a.home_place || a.place_label)}</strong>\n<span>${esc(a.home_short)}</span></a>`
    )
    .join("");

  return `<main id="main" class="shell"><section class="intro"><h1>Culture takes place.</h1><p>Explore the practices, people, and histories that make a place unmistakably itself. And the conditions that made them possible.</p></section>${hero}<section id="stories"><div class="section-head"><h2>Elsewhere in the journal</h2><span>Different places. Deeper connections.</span></div><div class="story-grid">${gridCards}</div>${textCards}</section><section id="places"><div class="section-head"><h2>Start with a place</h2><span>In this issue</span></div><div class="place-list">${placeItems}</div></section><section class="lens"><div><p class="eyebrow">The perspective behind Folkly</p><h2>What makes<br>a place itself?</h2></div><div><p>Culture is made, tested, inherited, and remade. We&rsquo;re interested in how communities respond to change, what they hold onto, and the new forms of belonging they create.</p><p>Our stories begin with a place and a practice, then look closely at the conditions underneath.</p><a class="read" href="/perspective">Explore our perspective</a></div></section></main>`;
}

function renderSimplePage(page, block) {
  return `<main id="main" class="shell">${block.main_html}</main>`;
}

module.exports = { Page, renderArticle, renderHome, renderSimplePage, esc };

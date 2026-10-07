"use strict";
// Folkly page renderer. Produces HTML matching the live site's structure and classes
// (see docs/preservation/raw/*.html for the captured skeleton) plus stage-03 features:
// author pages, archives (place/topic), related stories, Article JSON-LD, AI disclosure.
const ICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='7' fill='%23482b40'/%3E%3Ctext x='12' y='31' font-family='Georgia' font-weight='bold' font-size='35' fill='%23e6f078'%3Ef%3C/text%3E%3C/svg%3E";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Typographic initials for persona avatars (spec: no fabricated headshots).
function initialsOf(name) {
  return String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .join("")
    .slice(0, 2);
}

function slugify(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "item";
}

// Word count + reading time computed from the real body HTML (spec: accurate reading time).
function bodyStats(html) {
  const text = String(html || "").replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");
  const words = text.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
  return { words: words.length, minutes: Math.max(1, Math.round(words.length / 200)) };
}

function jsonLd(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;
}

class Page {
  constructor(opts) {
    this.domain = opts.domain;
    this.canonicalForm = opts.canonicalForm; // "html" | "none"
    this.settings = opts.settings;
    this.personas = opts.personas || new Map(); // id -> persona row
    this.briefs = opts.briefs || new Map(); // persona_id -> latest brief row
    this.allPublished = opts.allPublished || [];
  }

  urlFor(slug, opts = {}) {
    const suffix = opts.html ? ".html" : "";
    return `/${slug}${suffix}`;
  }
  absUrl(slug) {
    return `https://${this.domain}/${slug}${this.canonicalForm === "html" ? ".html" : ""}`;
  }

  head(title, desc, { type = "website", canonicalSlug, ld } = {}) {
    const u = canonicalSlug ? this.absUrl(canonicalSlug) : `https://${this.domain}/`;
    const ldHtml = ld ? jsonLd(ld) : "";
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><meta name="theme-color" content="#f8f7f3"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="${type}"><meta property="og:url" content="${esc(u)}"><link rel="canonical" href="${esc(u)}"><link rel="icon" type="image/svg+xml" href="${ICON}"><link rel="stylesheet" href="/style.css">${ldHtml}</head>`;
  }

  homeHeader(issueLabel) {
    return `<body><a class="skip" href="#main">Skip to content</a><header class="shell"><div class="topline"><span>A journal of culture, place &amp; belonging</span><span>Independent perspectives. Interconnected worlds.</span></div><a class="masthead" href="/" aria-label="Folkly home">folkly</a><nav class="nav" aria-label="Main navigation"><div class="navlinks"><a href="/#stories">The journal</a><a href="/#places">Places</a><a href="/archive">Archives</a><a href="/perspective">Our perspective</a><a href="/about">About</a></div><span class="issue">${esc(issueLabel)}</span></nav></header>`;
  }

  compactHeader() {
    return `<body><a class="skip" href="#main">Skip to content</a><header class="shell compact-head"><a class="compact-logo" href="/" aria-label="Folkly home">folkly</a><nav aria-label="Main navigation"><a href="/#stories">The journal</a><a href="/archive">Archives</a><a href="/perspective">Our perspective</a><a href="/about">About</a></nav></header>`;
  }

  footer() {
    return `<footer class="footer"><div class="shell"><div class="footer-top"><div><a class="footer-logo" href="/">folkly</a><p>Culture takes place.<br>Stories about what makes a place itself.</p></div><nav class="footer-nav" aria-label="Footer navigation"><a href="/#stories">The journal</a><a href="/archive">Archives</a><a href="/perspective">Our perspective</a><a href="/about">About Folkly</a></nav></div><div class="footer-bottom"><span>A project by Noah Rappaport &middot; ${esc(this.settings["site.footer_date"] || "October 2026")}</span><span>Words, places, and the people who give them meaning.</span></div></div></footer></body></html>`;
  }
}

// Exact spec disclosure string. Persona articles: [name] = persona name. Pre-persona
// migrated articles: [name] = "Folkly" (the "Folkly editorial" byline), giving
// "Written with AI using the Folkly editorial persona; researched from the linked sources."
function disclosure(nameToken) {
  return `Written with AI using the ${nameToken} editorial persona; researched from the linked sources.`;
}

function renderDisclosureBar(authorName) {
  return `<p class="ai-disclosure">${disclosure(authorName)}</p>`;
}

function renderArticle(page, art, content, nextArt, related) {
  const c = content;
  const stats = bodyStats(c.body_html);
  const persona = art.persona_id ? page.personas.get(art.persona_id) : null;
  const authorToken = persona ? persona.name : "Folkly";
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
  const pubDate = new Date(art.updated_at || art.created_at).toLocaleDateString("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const bylineHtml = persona
    ? `<div class="byline-row"><a class="author-chip" href="/author/${persona.id}" aria-label="About ${esc(persona.name)}"><span class="avatar" aria-hidden="true">${initialsOf(persona.name)}</span><span class="author-name">${esc(persona.name)}</span></a><span class="byline-meta">${pubDate} &middot; ${stats.minutes} min read &middot; ${esc(art.place_label || "")}</span></div>`
    : `<p class="byline">${esc(art.byline_legacy || "")}</p>`;
  const nextHtml = nextArt
    ? `<section class="next-story"><div><span class="eyebrow">Continue exploring &middot; ${esc(nextArt.place_label)}</span><h2><a href="${page.urlFor(nextArt.slug)}">${esc(nextArt.title)}</a></h2></div><a class="read" href="/#stories">Back to the journal</a></section>`
    : "";
  const relatedHtml =
    related && related.length
      ? `<section class="related"><h2>More from the journal</h2><ul>${related
          .map(
            (r) =>
              `<li><a href="${page.urlFor(r.slug)}"><span class="eyebrow">${esc(r.home_eyebrow || r.category || "")}</span>${esc(r.title)}</a><span class="meta">${esc(r.place_label || "")} &middot; ${r.reading_minutes} min read</span></li>`
          )
          .join("")}</ul></section>`
      : "";
  const tocHtml = (c.toc || [])
    .map((t) => `<a href="#${esc(t.id)}">${esc(t.title)}</a>`)
    .join("");

  return `<main id="main" class="shell"><article><header class="article-header"><p class="eyebrow">${esc(c.eyebrow)}</p><h1>${esc(art.title)}</h1><p class="article-deck">${esc(c.deck)}</p>${bylineHtml}${renderDisclosureBar(authorToken)}</header>${figureHtml}<div class="article-layout"><aside class="article-aside"><span class="eyebrow">In this story</span>${tocHtml}<p>${issueNote}</p></aside><div class="article-body">${c.body_html}${
    c.sources && c.sources.length
      ? `<section id="sources" class="sources"><h2>Sources &amp; further reading</h2><ol>${sourcesHtml}</ol></section>`
      : ""
  }${noteHtml}</div></div></article>${nextHtml}${relatedHtml}</main>`;
}

function relatedStories(page, art) {
  const others = page.allPublished.filter((a) => a.id !== art.id);
  if (!others.length) return [];
  const score = (b) => {
    let s = 0;
    if (b.place_label && art.place_label && b.place_label === art.place_label) s += 3;
    if (b.category && art.category && b.category === art.category) s += 2;
    if (b.country && art.country && b.country === art.country) s += 1;
    return s;
  };
  const ranked = others.map((b) => [b, score(b)]).sort((x, y) => y[1] - x[1]);
  // Prefer genuinely related stories; if none exist yet, fall back to same-issue
  // recency order so the section is never empty as the archive grows.
  if (ranked.some(([, s]) => s > 0)) {
    return ranked.filter(([, s]) => s > 0).slice(0, 3).map(([b]) => b);
  }
  return ranked
    .map(([b]) => b)
    .sort((x, y) => (x.updated_at < y.updated_at ? 1 : -1))
    .slice(0, 3);
}

function renderAuthorPage(page, persona) {
  const arts = page.allPublished
    .filter((a) => a.persona_id === persona.id)
    .sort((x, y) => (x.updated_at < y.updated_at ? 1 : -1));
  const brief = page.briefs.get(persona.id); // latest version
  const b = brief ? JSON.parse(brief.brief_json) : null;
  const beatLine = b ? b.beat : "";
  const articleCards = arts
    .map(
      (a) => `<article class="story-card"><a class="picture" href="${page.urlFor(a.slug)}" aria-label="Read ${esc(a.title)}"><span class="avatar-large" aria-hidden="true">${initialsOf(persona.name)}</span></a><p class="eyebrow">${esc(a.home_eyebrow || a.category || "")}</p><h3><a href="${page.urlFor(a.slug)}">${esc(a.title)}</a></h3><p>${esc(a.deck || a.home_dek || "")}</p><div class="meta">Cultural essay &middot; ${a.reading_minutes} min read</div></article>`
    )
    .join("");
  const assignments = arts
    .map(
      (a) =>
        `<li><a href="${page.urlFor(a.slug)}">${esc(a.title)}</a><span class="meta">${esc(a.place_label || "")} &middot; ${new Date(a.updated_at).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric" })}</span></li>`
    )
    .join("");
  const tags = JSON.parse(persona.subject_tags || "[]")
    .map((t) => `<a class="tag" href="/archive/topic/${slugify(t)}">${esc(t)}</a>`)
    .join("");
  return `<main id="main" class="shell"><section class="author-page"><div class="author-card"><span class="avatar-xl" aria-hidden="true">${initialsOf(persona.name)}</span><div><p class="eyebrow">Editorial persona</p><h1>${esc(persona.name)}</h1><p class="beat-line">${esc(beatLine)}</p></div></div><p class="ai-disclosure">${disclosure(persona.name)}</p><p class="bio-public">${esc(persona.bio_public)}</p>${
    b
      ? `<section class="brief"><h2>How this persona writes</h2><dl><dt>Central question</dt><dd>${esc(b.central_question || "")}</dd><dt>Beat</dt><dd>${esc(b.beat || "")}</dd><dt>Voice</dt><dd>${esc(b.voice || "")}</dd><dt>Story structure</dt><dd>${esc(b.story_structure || "")}</dd><dt>Research emphasis</dt><dd>${esc(b.research_emphasis || "")}</dd><dt>Blind spot to counter</dt><dd>${esc(b.blind_spot || "")}</dd></dl><p class="specimen-note"><em>Style specimen (voice only, never a reported fact):</em> ${esc(b.style_specimen || "")}</p></section>`
      : ""
  }<section class="tags-block"><span class="eyebrow">Subject tags</span><p class="tags">${tags}</p></section>${
    arts.length
      ? `<section class="author-work"><div class="section-head"><h2>Stories by ${esc(persona.name)}</h2><span>${arts.length} ${arts.length === 1 ? "story" : "stories"}</span></div><div class="story-grid">${articleCards}</div></section>`
      : `<section class="author-work"><div class="section-head"><h2>Stories by ${esc(persona.name)}</h2><span>In the queue</span></div><p>No published stories yet. This persona joins the rotation once its first researched feature clears the editorial gates.</p></section>`
  }<section class="history"><h2>Recent assignment history</h2><ul>${
    assignments || `<li>Nothing published yet &middot; assignments appear here as stories clear the editorial gates.</li>`
  }</ul></section></main>`;
}

function renderArchivePage(page, { kind, value, title }) {
  // Match on slugified labels so slugs containing commas (e.g. "New Orleans,
  // United States") round-trip through the URL cleanly.
  const v = slugify(value);
  let arts = page.allPublished;
  if (kind === "place")
    arts = arts.filter(
      (a) => slugify(a.place_label || "") === v || slugify(a.country || "") === v
    );
  if (kind === "topic")
    arts = arts.filter(
      (a) => slugify(a.category || "") === v || slugify(a.home_eyebrow || "") === v
    );
  arts = arts.sort((x, y) => (x.updated_at < y.updated_at ? 1 : -1));
  const cards = arts
    .map(
      (a) => `<article class="story-card"><a class="picture" href="${page.urlFor(a.slug)}" aria-label="Read ${esc(a.title)}"><span class="avatar-large" aria-hidden="true">f</span></a><p class="eyebrow">${esc(a.home_eyebrow || a.category || "")}</p><h3><a href="${page.urlFor(a.slug)}">${esc(a.title)}</a></h3><p>${esc(a.deck || a.home_dek || "")}</p><div class="meta">${esc(a.place_label || "")} &middot; ${a.reading_minutes} min read</div></article>`
    )
    .join("");
  return `<main id="main" class="shell"><div class="intro"><h1>${esc(title)}</h1><p>${
    arts.length
      ? `${arts.length} ${arts.length === 1 ? "story" : "stories"} in this archive.`
      : "No stories in this archive yet. New stories land here as they clear the editorial gates."
  }</p></div>${arts.length ? `<div class="story-grid">${cards}</div>` : ""}<p class="back-link"><a href="/archive">&larr; All archives</a></p></main>`;
}

function renderArchivesIndex(page) {
  const byPlace = new Map();
  const byTopic = new Map();
  const byAuthor = new Map();
  for (const a of page.allPublished) {
    if (a.place_label) byPlace.set((a.place_label || "").toLowerCase(), { label: a.place_label, slug: slugify(a.place_label), count: (byPlace.get((a.place_label || "").toLowerCase())?.count || 0) + 1 });
    if (a.category) byTopic.set(a.category.toLowerCase(), { label: a.category, slug: slugify(a.category), count: (byTopic.get(a.category.toLowerCase())?.count || 0) + 1 });
    if (a.persona_id) {
      const p = page.personas.get(a.persona_id);
      if (p) byAuthor.set(a.persona_id, { label: p.name, id: p.id, count: (byAuthor.get(a.persona_id)?.count || 0) + 1 });
    }
  }
  const places = [...byPlace.values()].sort((x, y) => x.label.localeCompare(y.label));
  const topics = [...byTopic.values()].sort((x, y) => x.label.localeCompare(y.label));
  const authors = [...byAuthor.values()].sort((x, y) => x.label.localeCompare(y.label));
  const allArts = [...page.allPublished].sort((x, y) => (x.updated_at < y.updated_at ? 1 : -1));
  const cards = allArts
    .map(
      (a) => `<article class="story-card"><a class="picture" href="${page.urlFor(a.slug)}" aria-label="Read ${esc(a.title)}"><span class="avatar-large" aria-hidden="true">f</span></a><p class="eyebrow">${esc(a.home_eyebrow || a.category || "")}</p><h3><a href="${page.urlFor(a.slug)}">${esc(a.title)}</a></h3><p>${esc(a.deck || a.home_dek || "")}</p><div class="meta">${esc(a.place_label || "")} &middot; ${a.reading_minutes} min read</div></article>`
    )
    .join("");
  return `<main id="main" class="shell"><div class="intro"><h1>The archives</h1><p>Every story in the journal, organized by place, topic, and editorial persona.</p></div><section class="archive-columns"><section class="archive-col"><h2>By place</h2><ul>${
    places.map((p) => `<li><a href="/archive/place/${p.slug}">${esc(p.label)} <span class="count">${p.count}</span></a></li>`).join("")
  }</ul></section><section class="archive-col"><h2>By topic</h2><ul>${
    topics.map((t) => `<li><a href="/archive/topic/${t.slug}">${esc(t.label)} <span class="count">${t.count}</span></a></li>`).join("")
  }</ul></section><section class="archive-col"><h2>By editorial persona</h2><ul>${
    authors.map((a) => `<li><a href="/author/${a.id}">${esc(a.label)} <span class="count">${a.count}</span></a></li>`).join("")
  }</ul></section></section><section class="section-head"><h2>All stories</h2><span>${allArts.length} in the archive</span></section><div class="story-grid">${cards}</div></main>`;
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

export { Page, renderArticle, renderHome, renderSimplePage, renderAuthorPage, renderArchivePage, renderArchivesIndex, relatedStories, disclosure, bodyStats, slugify, initialsOf, esc };

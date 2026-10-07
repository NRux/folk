// Read-only Worker/D1 reader. No editorial data is exposed through an API.
// The Site adapter passes its DB and static asset binding to this fetch handler.
import * as renderer from "./render.mjs";
const {
  Page, renderArticle, renderHome, renderSimplePage, renderAuthorPage,
  renderArchivePage, renderArchivesIndex, relatedStories, slugify,
} = renderer;

const html = (body, code = 200) => new Response(body, {
  status: code,
  headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
});
const missing = () => new Response("not found", { status: 404, headers: { "cache-control": "no-store" } });

export async function readerFetch(request, env) {
  if (request.method !== "GET" && request.method !== "HEAD") return missing();
  const url = new URL(request.url);
  const p = url.pathname;
  if (p === "/style.css" || /^\/assets\/[a-z0-9/_-]+\.(?:jpg|jpeg|png|svg|webp)$/i.test(p)) {
    return env.ASSETS ? env.ASSETS.fetch(request) : missing();
  }
  // Never fall through from a draft, admin path, API, or unknown route into assets.
  if (!env.DB || p.startsWith("/admin") || p.startsWith("/api/") || p === "/mcp") return missing();

  const [published, settingRows, people, briefs] = await Promise.all([
    env.DB.prepare("SELECT * FROM articles WHERE status = 'published' ORDER BY home_position IS NULL, home_position").all(),
    env.DB.prepare("SELECT key, value FROM settings").all(),
    env.DB.prepare("SELECT * FROM personas WHERE active = 1").all(),
    env.DB.prepare(`SELECT b.persona_id, b.brief_json FROM persona_briefs b
      JOIN (SELECT persona_id, MAX(version) AS v FROM persona_briefs GROUP BY persona_id) latest
      ON latest.persona_id = b.persona_id AND latest.v = b.version`).all(),
  ]);
  const settings = Object.fromEntries(settingRows.results.map((r) => [r.key, r.value]));
  const arts = published.results;
  const page = new Page({
    domain: settings["site.canonical_domain"] || url.host,
    canonicalForm: settings["site.canonical_form"] || "html",
    settings,
    personas: new Map(people.results.map((r) => [r.id, r])),
    briefs: new Map(briefs.results.map((r) => [r.persona_id, r])),
    allPublished: arts,
  });

  if (p === "/" || p === "/index.html") {
    const cover = arts.find((a) => a.is_cover) || arts[0];
    const rest = arts.filter((a) => a !== cover).slice(0, 4);
    return html(page.head("Culture takes place | Folkly", settings["site.home_description"] ||
      "Folkly is a cultural journal exploring the practices, places, and histories that shape distinctive identities.") +
      page.homeHeader(settings["site.issue_label"] || "Issue 01 / The things we carry") +
      (cover ? renderHome(page, cover, rest, arts.slice(0, 8)) :
        `<main id="main" class="shell"><section class="intro"><h1>Culture takes place.</h1><p>The journal is being prepared.</p></section></main>`) + page.footer());
  }
  const blockSlug = /^\/(perspective|about)(?:\.html)?$/.exec(p)?.[1];
  if (blockSlug) {
    const block = await env.DB.prepare("SELECT * FROM page_blocks WHERE slug = ?").bind(blockSlug).first();
    if (!block) return missing();
    return html(page.head(block.title, block.meta_description || "", { type: "website", canonicalSlug: blockSlug }) +
      page.compactHeader() + renderSimplePage(page, block) + page.footer());
  }
  const author = /^\/author\/([a-z0-9-]+)(?:\.html)?$/i.exec(p);
  if (author) {
    const person = await env.DB.prepare("SELECT * FROM personas WHERE slug = ? AND active = 1").bind(author[1]).first();
    if (!person) return missing();
    return html(page.head(`${person.name} | Folkly`, person.bio_public, { type: "profile", canonicalSlug: `author/${person.slug}` }) +
      page.compactHeader() + renderAuthorPage(page, person) + page.footer());
  }
  if (p === "/archive" || p === "/archive.html") {
    return html(page.head("Archives | Folkly", "Every story in the Folkly journal, organized by place, topic, and editorial persona.",
      { type: "website", canonicalSlug: "archive" }) + page.compactHeader() + renderArchivesIndex(page) + page.footer());
  }
  const archive = /^\/archive\/(place|topic)\/([a-z0-9-]+)(?:\.html)?$/i.exec(p);
  if (archive) {
    const [, kind, slug] = archive;
    const match = kind === "place"
      ? arts.find((a) => slugify(a.place_label || "") === slug || slugify(a.country || "") === slug)
      : arts.find((a) => slugify(a.category || "") === slug || slugify(a.home_eyebrow || "") === slug);
    const label = match ? (kind === "place" ? match.place_label : match.category) : slug.replace(/-/g, " ");
    return html(page.head(`${kind === "place" ? "Stories from" : "Stories about"} ${label} | Folkly`,
      `Folkly archive ${kind === "place" ? "by place" : "by topic"}: ${label}.`,
      { type: "website", canonicalSlug: `archive/${kind}/${slug}` }) + page.compactHeader() +
      renderArchivePage(page, { kind, value: label, title: kind === "place" ? `Stories from ${label}` : `Stories about ${label}` }) + page.footer());
  }
  const article = /^\/([a-z0-9-]+)(?:\.html)?$/i.exec(p);
  if (!article) return missing();
  const art = arts.find((a) => a.slug === article[1]);
  if (!art) return missing();
  const version = await env.DB.prepare(`SELECT content_json FROM article_versions
    WHERE article_id = ? ORDER BY version DESC LIMIT 1`).bind(art.id).first();
  if (!version) return missing();
  const content = JSON.parse(version.content_json);
  const person = art.persona_id ? page.personas.get(art.persona_id) : null;
  const ld = {
    "@context": "https://schema.org", "@type": "Article", headline: art.title,
    description: content.deck || art.deck || "",
    datePublished: new Date(art.created_at).toISOString(),
    dateModified: new Date(art.updated_at).toISOString(),
    author: person ? { "@type": "Person", name: person.name,
      description: `${person.name} is an AI editorial persona at Folkly. This article was written with AI using the ${person.name} editorial persona; researched from the linked sources.` }
      : { "@type": "Organization", name: "Folkly editorial",
        description: "Folkly editorial persona; this article was written with AI using the Folkly editorial persona; researched from the linked sources." },
    publisher: { "@type": "Organization", name: "Folkly", url: `https://${page.domain}/` },
    mainEntityOfPage: page.absUrl(art.slug),
  };
  if (content.figure?.src) ld.image = `https://${page.domain}${content.figure.src}`;
  if (art.place_label) ld.keywords = [art.place_label, art.category || ""].filter(Boolean).join(", ");
  const next = art.next_story_slug ? arts.find((a) => a.slug === art.next_story_slug) : null;
  return html(page.head(art.title + " | Folkly", content.deck || art.deck || "",
    { type: "article", canonicalSlug: art.slug, ld }) + page.compactHeader() +
    renderArticle(page, art, content, next, relatedStories(page, art)) + page.footer());
}

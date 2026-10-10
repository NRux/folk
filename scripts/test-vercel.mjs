import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
const routes = JSON.parse(await readFile('web/vercel/routes.json', 'utf8'));
const { discoveryRouteFiles } = await import('./article-discovery.mjs');
const { publishedArticles } = await import('./public-articles.mjs');
const catalog = JSON.parse(await readFile('web/vercel/articles.json', 'utf8'));
Object.assign(routes, discoveryRouteFiles(publishedArticles(catalog, routes)));
const released = JSON.parse(await readFile('web/vercel/manual-releases.json', 'utf8')).articles;
const reserve = JSON.parse(await readFile('web/site-runtime/hosted/lib/reviewed-reserve.json', 'utf8')).filter(r=>!released.some(a=>a.slug===r.slug));
for (const slug of ['new-orleans-second-line', 'lisbon-fado', 'oaxaca-living-color', 'detroit-future-frequency']) {
  assert(routes[`/${slug}`]);
  const html = await readFile(`dist/${slug}.html`, 'utf8');
  assert(!html.includes('class="editorial-note"'));
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /Sources|sources/);
  assert(!html.includes('chatgpt.site'));
  assert(!html.includes('<p class="ai-disclosure">'));
  assert(!html.includes('Through the Folkly lens'));
  assert(!html.includes('class="reading-lens"'));
  assert(html.includes('href="/subscribe"'));
}
for (const item of released) {
  const html=await readFile('dist/'+item.slug+'.html','utf8');
  assert(routes['/'+item.slug]);
  assert(html.includes('application/ld+json')&&html.includes('id="sources"'));
  assert(html.includes('href="/author/'));
  assert((await readFile('dist/archive.html','utf8')).includes('href="/'+item.slug+'"'));
}
for (const item of reserve) assert(!routes[`/${item.slug}`], `Reserve leaked: ${item.slug}`);
for (const route of Object.keys(routes)) {
  assert(!/^\/(admin|api|mcp)(\/|$)/.test(route));
  const html = await readFile(route === '/' ? 'dist/index.html' : `dist${route}.html`, 'utf8');
  for (const [, href] of html.matchAll(/href="(\/[^"]*)"/g)) {
    const path = href.split(/[?#]/)[0].replace(/\.html$/, '');
    // Approved locale pages (zh-Hans/es/hi/ar/fr/ja) are served straight from dist by the
    // translation build and are deliberately outside routes.json's English route table:
    // a locale link is checked against the built file instead.
    const locale = path.match(/^\/(zh-Hans|es|hi|ar|fr|ja)(\/.*)?$/);
    const localeTarget = locale ? `dist/${locale[1]}${locale[2] ?? ''}.html` : null;
    if (path && !path.startsWith('/assets/') && !['/style.css', '/subscribe.css', '/contact.css', '/article-grid.css', '/image-credits', '/subscribe', '/privacy', '/privacy.css', '/locales.css', '/language.js'].includes(path)) {
      if (localeTarget) assert(await access(localeTarget).then(() => true, () => false), `Broken locale link: ${href} on ${route}`);
      else assert(routes[path], `Broken link: ${href} on ${route}`);
    }
  }
}
const files = (await readdir('dist', { recursive: true })).map(p => p.replaceAll('\\', '/'));
const LOCALE_FILE = /^(zh-Hans|es|hi|ar|fr|ja)(\.html|\/)/;
for (const file of files.filter(p => p.endsWith('.html'))) {
  const html = await readFile(`dist/${file}`, 'utf8');
  const head = html.match(/<head>[\s\S]*?<\/head>/)?.[0] || '';
  assert(!html.includes('adsbygoogle.js'), file);
  assert(!html.includes('googletagmanager.com'), file);
  assert(head.includes('name="google-adsense-account"'), file);
  // Translated pages link to their own locale's approved privacy page
  // (e.g. /es/privacy) rather than the English /privacy.
  const privacyHref = file.match(LOCALE_FILE) ? `href="/${file.match(LOCALE_FILE)[1]}/privacy"` : 'href="/privacy"';
  assert(html.includes(privacyHref), file);
  assert.equal(html.includes('src="/privacy.js"'),file!=='owner.html',file);
  assert(!html.includes('Neighborhood context, not a pictured'));
  assert(!html.includes('. Displayed with a responsive crop; original image retained.'));
}
for (const slug of ['new-orleans-second-line', 'lisbon-fado', 'detroit-future-frequency']) {
  const html = await readFile(`dist/${slug}.html`, 'utf8');
  assert(!html.includes('class="editorial-note"'));
  assert(html.includes('class="music-examples"'), slug);
  assert.match(html, /https:\/\/(?:smithsonianfolkways\.bandcamp\.com|arquivosonoro\.museudofado\.pt|planetecommunications\.bandcamp\.com)/);
}
assert(!files.some(p => p!=='article-release-registry.json' && /\.db$|\.json$|\.sql$|\.mjs$|\.ts$|reserve|admin|mcp/.test(p)));
const registry=JSON.parse(await readFile('dist/article-release-registry.json','utf8'));
assert.equal(registry.format,'folkly-public-release-registry-v1');assert.equal(registry.articles.length,11);
for(const entry of registry.articles){assert.deepEqual(Object.keys(entry).sort(),['article_id','content_version','declared_modified_at','published_at']);assert.match(entry.content_version,/^[a-f0-9]{64}$/);assert(routes[`/${entry.article_id}`]);const html=await readFile(`dist/${entry.article_id}.html`,'utf8');assert(html.includes(`data-article-version="${entry.content_version}"`));assert(html.includes('src="/reader-events.js"'));assert.equal((html.match(/data-story-id=/g)||[]).length,4);}
const config = JSON.parse(await readFile('vercel.json', 'utf8'));
assert.equal(config.outputDirectory, 'dist');
assert.deepEqual(config.crons,[{path:'/api/newsletter',schedule:'0 16 * * 5'}]);
assert(!config.rewrites);
console.log(`Vercel checks passed: ${Object.keys(routes).length} public routes, 11 stories, links, private reserve exclusion, no editorial code or article cron in output; weekly newsletter cron only.`);

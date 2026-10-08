import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
const routes = JSON.parse(await readFile('web/vercel/routes.json', 'utf8'));
const released = JSON.parse(await readFile('web/vercel/manual-releases.json', 'utf8')).articles;
const reserve = JSON.parse(await readFile('web/site-runtime/hosted/lib/reviewed-reserve.json', 'utf8')).filter(r=>!released.some(a=>a.slug===r.slug));
for (const slug of ['new-orleans-second-line', 'lisbon-fado', 'oaxaca-living-color', 'detroit-future-frequency']) {
  assert(routes[`/${slug}`]);
  const html = await readFile(`dist/${slug}.html`, 'utf8');
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
    if (path && !path.startsWith('/assets/') && !['/style.css', '/subscribe.css', '/contact.css', '/subscribe'].includes(path)) assert(routes[path], `Broken link: ${href} on ${route}`);
  }
}
const files = await readdir('dist', { recursive: true });
for (const file of files.filter(p => p.endsWith('.html'))) {
  const html = await readFile(`dist/${file}`, 'utf8');
  const head = html.match(/<head>[\s\S]*?<\/head>/)?.[0] || '';
  assert.equal((html.match(/adsbygoogle\.js/g) || []).length, 1, file);
  assert(head.includes('client=ca-pub-6358670448023938'), file);
  assert(head.includes('crossorigin="anonymous"'), file);
  assert.equal((html.match(/googletagmanager\.com\/gtag\/js\?id=G-RQJD3XG35C/g) || []).length, 1, file);
  assert.equal((head.match(/gtag\('config', 'G-RQJD3XG35C'\)/g) || []).length, 1, file);
  assert(!html.includes('Neighborhood context, not a pictured'));
  assert(!html.includes('. Displayed with a responsive crop; original image retained.'));
}
for (const slug of ['new-orleans-second-line', 'lisbon-fado', 'detroit-future-frequency']) {
  const html = await readFile(`dist/${slug}.html`, 'utf8');
  assert(html.includes('class="music-examples"'), slug);
  assert.match(html, /https:\/\/(?:smithsonianfolkways\.bandcamp\.com|arquivosonoro\.museudofado\.pt|planetecommunications\.bandcamp\.com)/);
}
assert(!files.some(p => /\.db$|\.json$|\.sql$|\.mjs$|\.ts$|reserve|admin|mcp/.test(p)));
const config = JSON.parse(await readFile('vercel.json', 'utf8'));
assert.equal(config.outputDirectory, 'dist');
assert(!config.crons && !config.rewrites);
console.log(`Vercel checks passed: ${Object.keys(routes).length} public routes, 11 stories, links, private reserve exclusion, no editorial code or cron in output.`);

import { addArticleFilters } from './article-filters.mjs';
import { decorateArticleLayout, inlineImageCredits } from './article-layout.mjs';
import { applyResponsiveImages } from './responsive-images.mjs';
import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { publishedArticles, verifyImageFiles, populateHomepage, decorateArticle, imageCreditsPage, escapeHtml } from './public-articles.mjs';

import { discoveryGroups, discoveryRouteFiles, decorateArchive, decorateAuthor, discoveryPage, relatedStories } from './article-discovery.mjs';

// Public-only, offline build. Never copy the repository, DB, or reserve into dist.
const routes = JSON.parse(await readFile('web/vercel/routes.json', 'utf8'));
const extraPages = JSON.parse(gunzipSync(await readFile('web/vercel/extra-pages.json.gz')).toString('utf8'));
const catalog = JSON.parse(await readFile('web/vercel/articles.json', 'utf8'));
const articleMedia = JSON.parse(await readFile('web/vercel/article-media.json', 'utf8'));
const articles = publishedArticles(catalog, routes);
await verifyImageFiles(articles);
Object.assign(routes, discoveryRouteFiles(articles));
const origin = process.env.FOLKLY_PUBLIC_ORIGIN || 'https://www.folkly.com';
const adsense = '<meta name="google-adsense-account" content="ca-pub-6358670448023938"><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6358670448023938" crossorigin="anonymous"></script>';
const analytics = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-RQJD3XG35C"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-RQJD3XG35C');
</script>`;
function addAdsense(html) {
  if (!html.includes('</head>')) throw new Error('Public page is missing its head');
  return html.replace('</head>', `${adsense}${analytics}</head>`);
}
const canonical = new URL(origin);
if (canonical.protocol !== 'https:' || canonical.pathname !== '/' || canonical.search || canonical.hash || canonical.username || canonical.password) {
  throw new Error('FOLKLY_PUBLIC_ORIGIN must be an HTTPS origin');
}
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
const archiveTemplate = extraPages[routes['/archive']] ?? await readFile(`web/vercel/pages/${routes['/archive']}`, 'utf8');
const groups = discoveryGroups(articles);
for (const [route, file] of Object.entries(routes)) {
  if (!/^\/(?:[a-z0-9-]+\/)*[a-z0-9-]*$/.test(route) || /^(?:\/admin|\/api|\/mcp)/.test(route) || !/^[a-z0-9_-]+\.html$/.test(file)) {
    throw new Error(`Unsafe public route: ${route}`);
  }
  let html = groups.has(route) ? discoveryPage(archiveTemplate, route, groups.get(route), canonical.origin) : extraPages[file] ?? await readFile(`web/vercel/pages/${file}`, 'utf8');
  html = html.replace(/https:\/\/folkly-journal\.[a-z0-9.-]+\.site/g, canonical.origin);
  html = html.replace(/<p class="ai-disclosure">Written with AI using the Folkly editorial persona; researched from the linked sources\.<\/p>/g, '');
  html = html.replace(/<section class="reading-lens">[\s\S]*?<\/section>/g, '');
  if (route === '/archive') html = decorateArchive(html, articles);
  if (route.startsWith('/author/')) html = decorateAuthor(html, articles, route.split('/')[2]);
  if (route === '/') html = populateHomepage(html, articles);
  const article = articles.find(item => route === `/${item.slug}`);
  if (article) {
    html = decorateArticle(html, article, canonical.origin);
    if (!html.includes('</article>')) throw new Error(`Missing article boundary: ${article.slug}`);
    html = html.replace('</article>', `</article>${relatedStories(articles,article)}`);
  }
  html = html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${canonical.origin}${route}">`);
  html = html.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${canonical.origin}${route}">`);
  if (route.startsWith('/archive/topic/') && !groups.has(route)) html = html.replace('</head>', '<meta name="robots" content="noindex,follow"></head>');
  html = html.replace('</head>', '<link rel="stylesheet" href="/subscribe.css"><link rel="stylesheet" href="/article-grid.css"></head>');
  html = applyResponsiveImages(html, articles, route);
  if (article) html = decorateArticleLayout(html, article, articleMedia);
  html = addArticleFilters(html, articles);
  html = addAdsense(html);
  html = html.replace('</nav>', '<a class="subscribe-button" href="/subscribe">Subscribe</a></nav>');
  const target = route === '/' ? 'dist/index.html' : `dist${route}.html`;
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
}
await cp('web/static/assets', 'dist/assets', { recursive: true });
await cp('web/static/style.css', 'dist/style.css');
await cp('web/vercel/ads.txt', 'dist/ads.txt');
await cp('web/vercel/article-grid.css', 'dist/article-grid.css');
await writeFile('dist/image-credits.html', addAdsense(imageCreditsPage(articles, canonical.origin).replace('</main>', `${inlineImageCredits(articles, articleMedia)}</main>`)));
// Sitemap includes curated discovery pages and explicitly published articles only.
const indexed = ['/', '/about', '/perspective', '/archive', ...articles.map(item => `/${item.slug}`), ...groups.keys()];
await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${indexed.map(route => `<url><loc>${escapeHtml(canonical.origin + route)}</loc></url>`).join('')}</urlset>`);
await writeFile('dist/robots.txt', `User-agent: *\nAllow: /\nDisallow: /owner\nDisallow: /api/\nDisallow: /admin\nDisallow: /mcp\nSitemap: ${canonical.origin}/sitemap.xml\n`);
for (const file of ['subscribe.css', 'subscribe.js', 'owner.js', 'contact.js', 'contact.css']) await cp(`web/vercel/${file}`, `dist/${file}`);
await writeFile('dist/owner.html', addAdsense(await readFile('web/vercel/owner.html', 'utf8')));
await writeFile('dist/subscribe.html', addAdsense(await readFile('web/vercel/subscribe.html', 'utf8')));
await writeFile('dist/404.html', addAdsense('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Page not found | Folkly</title></head><body><h1>Page not found</h1><a href="/">Return to Folkly</a></body></html>'));
console.log(`Built ${Object.keys(routes).length} public pages and journal assets for Vercel; publisher disabled.`);

await cp('web/vercel/article-filters.mjs', 'dist/article-filters.js');

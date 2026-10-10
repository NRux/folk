import {privacyControls,privacyPage} from './privacy-pages.mjs';
import { mapPage } from './build-map.mjs';
import { LANGUAGE_MENU_SHELL } from './translations.mjs';
import {buildTranslations} from './build-translations.mjs';
import {hash} from './translations.mjs';
import { addArticleFilters } from './article-filters.mjs';
import { decorateArticleLayout, inlineImageCredits } from './article-layout.mjs';
import { validateArticleImageRelevance } from './image-relevance.mjs';
import { applyResponsiveImages } from './responsive-images.mjs';
import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { publishedArticles, verifyImageFiles, populateHomepage, decorateArticle, imageCreditsPage, escapeHtml, addSiteIdentity } from './public-articles.mjs';

import { discoveryGroups, discoveryRouteFiles, decorateArchive, decorateAuthor, discoveryPage, relatedStories } from './article-discovery.mjs';

// Public-only, offline build. Never copy the repository, DB, or reserve into dist.
const routes = JSON.parse(await readFile('web/vercel/routes.json', 'utf8'));
const extraPages = JSON.parse(gunzipSync(await readFile('web/vercel/extra-pages.json.gz')).toString('utf8'));
const catalog = JSON.parse(await readFile('web/vercel/articles.json', 'utf8'));
const articleMedia = JSON.parse(await readFile('web/vercel/article-media.json', 'utf8'));
const imageRelevance = JSON.parse(await readFile('web/vercel/image-relevance.json', 'utf8'));
const articles = publishedArticles(catalog, routes);
const releaseRegistry=[];
await verifyImageFiles(articles);
for(const article of articles)validateArticleImageRelevance(article,articleMedia[article.slug],imageRelevance);
Object.assign(routes, discoveryRouteFiles(articles));
const origin = process.env.FOLKLY_PUBLIC_ORIGIN || 'https://www.folkly.com';
function addAdsense(html, privatePage=false) {
  if (!html.includes('</head>')) throw new Error('Public page is missing its head');
  html=html.replace(/<a href="\/perspective(?:\.html)?">Our perspective<\/a>/g,'').replace(/href="\/perspective(?:\.html)?"/g,'href="/about#perspective"');
  html = html.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/g, footer => footer
    .replace(/Culture takes place\.<br\s*\/?>Stories about what makes a place itself\./g, 'Stories about the intersection of Culture and Place.')
    .replace(/A project by Noah Rappaport(?:\s*(?:&middot;|·)\s*October 2026)?/g, 'A Then Media inc. project.'));
  return privacyControls(html,{privatePage});
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
  if(route==='/perspective')continue; // Legacy URLs redirect to the merged About page.
  if (!/^\/(?:[a-z0-9-]+\/)*[a-z0-9-]*$/.test(route) || /^(?:\/admin|\/api|\/mcp)/.test(route) || !/^[a-z0-9_-]+\.html$/.test(file)) {
    throw new Error(`Unsafe public route: ${route}`);
  }
  let html = route === '/map' ? mapPage(archiveTemplate, articles, canonical.origin) : groups.has(route) ? discoveryPage(archiveTemplate, route, groups.get(route), canonical.origin) : extraPages[file] ?? await readFile(`web/vercel/pages/${file}`, 'utf8');
  html = html.replace(/https:\/\/folkly-journal\.[a-z0-9.-]+\.site/g, canonical.origin);
  html = html.replace(/<p class="ai-disclosure">Written with AI using the Folkly editorial persona; researched from the linked sources\.<\/p>/g, '');
  html = html.replace(/<p class="editorial-note">[\s\S]*?<\/p>/g, '');
  html = html.replace(/<section class="reading-lens">[\s\S]*?<\/section>/g, '');
  if (route === '/archive') html = decorateArchive(html, articles);
  if (route.startsWith('/author/')) html = decorateAuthor(html, articles, route.split('/')[2]);
  if (route === '/') html = populateHomepage(html, articles);
  if (route === '/') {
    html=html.replace(/<title>[\s\S]*?<\/title>/,'<title>Folkly | Stories at the Intersection of Culture and Place</title>');
    html=html.replace(/<meta property="og:title" content="[^"]*">/,'<meta property="og:title" content="Folkly | Stories at the Intersection of Culture and Place">');
    html=addSiteIdentity(html,canonical.origin);
  }
  const article = articles.find(item => route === `/${item.slug}`);
  if (article) {
    html = decorateArticle(html, article, canonical.origin);
    if (!html.includes('</article>')) throw new Error(`Missing article boundary: ${article.slug}`);
    html = html.replace('</article>', `</article>${relatedStories(articles,article,articleMedia)}`);
  }
  html = html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${canonical.origin}${route}">`);
  html = html.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${canonical.origin}${route}">`);
  if (route.startsWith('/archive/topic/') && !groups.has(route)) html = html.replace('</head>', '<meta name="robots" content="noindex,follow"></head>');
  html = html.replace('</head>', '<link rel="stylesheet" href="/subscribe.css"><link rel="stylesheet" href="/article-grid.css"></head>');
  html = applyResponsiveImages(html, articles, route);
  if (article) html = decorateArticleLayout(html, article, articleMedia);
  html = addArticleFilters(html, articles);
  html = addAdsense(html);
  // Nav rework: the map takes the Places slot (renamed Places), journal -> Culture,
  // Archives -> Archive. Pages without a Places link get one pointing at the map.
  html = html.replace('<a href="/#places">Places</a>', '<a href="/map">Places</a>');
  html = html.replace(/>The journal<\/a>/g, '>Culture</a>');
  html = html.replace(/>Archives<\/a>/g, '>Archive</a>');
  if (!html.includes('href="/map"')) html = html.replace('</nav>', '<a href="/map">Places</a></nav>');
  html = html.replace('</nav>', '<a class="subscribe-button" href="/subscribe">Subscribe</a></nav>');
  // Language dropdown shell + assets: always visible for non-English readers; the
  // translation build upgrades rows in place when approved translations exist.
  if (html.includes('<main ') && !html.includes('id="folkly-language-menu"')) html = html.replace('<main ', `${LANGUAGE_MENU_SHELL}<main `);
  html = html.replace('</head>', '<link rel="stylesheet" href="/locales.css"><script defer src="/language.js"></script></head>');
  if(article){
    const narrative=html.match(/<article>([\s\S]*?)<\/article>/)?.[1];if(!narrative)throw Error('Missing analytics story boundary');
    const version=hash(narrative);releaseRegistry.push({article_id:article.slug,content_version:version,published_at:article.publishedAt,declared_modified_at:JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]).dateModified});
    html=html.replace('<article>',`<article data-article-id="${article.slug}" data-article-version="${version}">`);
    html=html.replace(/(<a class="related-card"[^>]*href=")\/([a-z0-9-]+)("[^>]*>)/g,(all,before,slug,after)=>articles.some(a=>a.slug===slug)?`${before}/${slug}${after.slice(0,-1)} data-story-id="${slug}">`:all);
    html=html.replace('</head>','<script type="module" src="/reader-events.js"></script></head>');
  }
  const target = route === '/' ? 'dist/index.html' : `dist${route}.html`;
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
}
await cp('web/static/assets', 'dist/assets', { recursive: true });
await cp('web/static/style.css', 'dist/style.css');
// Standalone public UI pages get the same language dropdown shell + assets.
const withLanguageMenu=(html)=>html.includes('<main ')?html.replace('<main ',`${LANGUAGE_MENU_SHELL}<main `).replace('</head>','<link rel="stylesheet" href="/locales.css"><script defer src="/language.js"></script></head>'):html;
await cp('web/vercel/ads.txt', 'dist/ads.txt');
await cp('web/vercel/article-grid.css', 'dist/article-grid.css');
await writeFile('dist/image-credits.html', withLanguageMenu(addAdsense(imageCreditsPage(articles, canonical.origin).replace('</main>', `${inlineImageCredits(articles, articleMedia)}</main>`))));
// Sitemap includes curated discovery pages and explicitly published articles only.
const indexed = ['/', '/privacy', '/about', '/archive', '/map', ...articles.map(item => `/${item.slug}`), ...groups.keys()];
await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${indexed.map(route => `<url><loc>${escapeHtml(canonical.origin + route)}</loc></url>`).join('')}</urlset>`);
await writeFile('dist/robots.txt', `User-agent: *\nAllow: /\nDisallow: /owner\nDisallow: /api/\nDisallow: /admin\nDisallow: /mcp\nSitemap: ${canonical.origin}/sitemap.xml\n`);
for (const file of ['subscribe.css', 'subscribe.js', 'owner.js', 'owner-newsletter.js', 'contact.js', 'contact.css']) await cp(`web/vercel/${file}`, `dist/${file}`);
const ownerSource=await readFile('web/vercel/owner.html', 'utf8');
await writeFile('dist/owner.html', addAdsense(ownerSource,true));
await writeFile('dist/subscribe.html', withLanguageMenu(addAdsense(await readFile('web/vercel/subscribe.html', 'utf8'))));
await writeFile('dist/404.html', addAdsense('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Page not found | Folkly</title></head><body><h1>Page not found</h1><a href="/">Return to Folkly</a></body></html>'));
console.log(`Built ${Object.keys(routes).length} public pages and journal assets for Vercel; publisher disabled.`);

await cp('web/vercel/article-filters.mjs', 'dist/article-filters.js');

await cp('web/vercel/owner-workspace.js', 'dist/owner-workspace.js');
await cp('web/vercel/owner-translations.js', 'dist/owner-translations.js');

await writeFile('dist/privacy.html', withLanguageMenu(addAdsense(privacyPage())));
for (const file of ['privacy.js','privacy.css']) await cp(`web/vercel/${file}`,`dist/${file}`);
await cp('web/vercel/reader-events.mjs','dist/reader-events.js');
await writeFile('dist/article-release-registry.json',JSON.stringify({format:'folkly-public-release-registry-v1',articles:releaseRegistry},null,2)+'\n');
await buildTranslations({articles,routes,origin:canonical.origin});

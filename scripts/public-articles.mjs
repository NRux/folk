import { validateImageVariants } from './responsive-images.mjs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function publishedArticles(catalog, routes) {
  const published = catalog.filter(item => item.status === 'published');
  const seen = new Set();
  for (const item of published) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug) || seen.has(item.slug) || !routes[`/${item.slug}`]) throw new Error('Invalid or duplicate published article route');
    seen.add(item.slug);
    for (const field of ['title','summary','place']) if (typeof item[field] !== 'string' || !item[field].trim()) throw new Error(`Missing article ${field}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.publishedAt) || Number.isNaN(Date.parse(item.publishedAt)) || new Date(item.publishedAt).toISOString().slice(0,10) !== item.publishedAt) throw new Error('Invalid article publication date');
    const validSlug = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
    if (!validSlug(item.placeSlug) || typeof item.placeName !== 'string' || !item.placeName.trim() || !Array.isArray(item.topics) || !item.topics.every(validSlug) || new Set(item.topics).size !== item.topics.length) throw new Error('Invalid article discovery metadata');
    if (item.authorSlug && (!validSlug(item.authorSlug) || !routes[`/author/${item.authorSlug}`])) throw new Error('Unknown editorial persona');
    if (item.searchTitle && typeof item.searchTitle !== 'string') throw new Error('Invalid search title');
    if (item.related && (!Array.isArray(item.related) || !item.related.every(link=>validSlug(link.slug) && typeof link.reason === 'string' && link.reason.trim()))) throw new Error('Invalid related article metadata');
    if (item.image) {
      const image = item.image;
      const imageUrl = new URL(image.src, 'https://www.folkly.com');
      const localImage = /^\/assets\/[a-z0-9-]+\.jpg$/.test(image.src);
      const creditedImage = imageUrl.protocol === 'https:' && !imageUrl.username && !imageUrl.password && ['thumb.wikimedia.org','upload.wikimedia.org'].includes(imageUrl.hostname) && image.sha256;
      if ((!localImage && !creditedImage) || !Number.isSafeInteger(image.width) || image.width < 1 || !Number.isSafeInteger(image.height) || image.height < 1 || !image.alt) throw new Error('Invalid public image');
      validateImageVariants(image);
      if (image.sha256) {
        if (!/^[a-f0-9]{64}$/.test(image.sha256)) throw new Error('Invalid image digest');
        for (const field of ['caption','creator','license','changes']) if (!image[field]) throw new Error('Missing image rights record');
        for (const field of ['source','licenseUrl','originalUrl','downloadUrl']) if (new URL(image[field]).protocol !== 'https:') throw new Error('Unsafe image rights URL');
      }
    }
  }
  return published.sort((a,b) => b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug));
}
export async function verifyImageFiles(items) {
  for (const {image} of items) if (image?.src.startsWith('/assets/')) {
    const bytes = await readFile(`web/static${image.src}`);
    if (image.sha256 && createHash('sha256').update(bytes).digest('hex') !== image.sha256) throw new Error(`Image digest mismatch: ${image.src}`);
  }
}
const credit = image => `${escapeHtml(image.caption)} Photo: <a href="${escapeHtml(image.source)}">${escapeHtml(image.creator)}</a> / <a href="${escapeHtml(image.licenseUrl)}">${escapeHtml(image.license)}</a>.`;
export function renderGrid(items) {
  return items.map(item => `<article class="story-card" data-article="${item.slug}"><a class="picture${item.image ? '' : ' text-picture'}" href="/${item.slug}" aria-label="Read ${escapeHtml(item.title)}">${item.image ? `<img src="${escapeHtml(item.image.src)}" alt="${escapeHtml(item.image.alt)}" width="${item.image.width}" height="${item.image.height}" loading="lazy" decoding="async">` : `<span>${escapeHtml(item.place.split(' · ')[0])}<br>Cultural essay</span>`}</a>${item.image?.sha256 ? `<small class="grid-credit"><a href="/image-credits#${item.slug}">Photo: ${escapeHtml(item.image.creator)}</a></small>` : ''}<p class="eyebrow">${escapeHtml(item.place)}</p><h3><a href="/${item.slug}">${escapeHtml(item.title)}</a></h3><p>${escapeHtml(item.summary)}</p><div class="meta">Cultural essay</div></article>`).join('\n');
}
export function populateHomepage(html, items) {
  const start = html.indexOf('<div class="story-grid">');
  const end = html.indexOf('</div><article class="detroit">', start);
  if (start < 0 || end < 0) throw new Error('Homepage grid boundary missing');
  html = html.slice(0,start) + `<div class="story-grid" data-published-grid>${renderGrid(items)}</div>` + html.slice(end + '</div>'.length);
  html = html.replace(/<article class="detroit">[\s\S]*?<\/article>/, '');
  return html.replace(/<section class="related"><h2>New stories<\/h2>[\s\S]*?<\/section>/, '');
}
export function decorateArticle(html, item, origin) {
  const url = `${origin}/${item.slug}`;
  if (item.searchTitle) html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(item.searchTitle)} | Folkly</title>`);
  html = html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`);
  html = html.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escapeHtml(item.summary)}">`);
  html = html.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`);
  html = html.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escapeHtml(item.summary)}">`);
  if (item.image?.sha256) {
    const image = item.image;
    const marker = '</header><div class="article-layout">';
    if (!html.includes(marker)) throw new Error(`Article image insertion point missing: ${item.slug}`);
    html = html.replace(marker, `</header><figure class="article-figure credited-figure"><img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" width="${image.width}" height="${image.height}" decoding="async" fetchpriority="high"><figcaption>${credit(image)} <a class="image-details" href="/image-credits#${item.slug}" aria-label="Image use details">Details</a></figcaption></figure><div class="article-layout">`);
    html = html.replace(/<p class="article-deck">[\s\S]*?<\/p>/, `<p class="article-deck">${escapeHtml(item.summary)}</p>`);
  }
  html = html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (match, raw) => {
    const data = JSON.parse(raw);
    if (data['@type'] !== 'Article') return match;
    data.mainEntityOfPage = url;
    data.url = url;
    // Editorial personas are not human people. Attribute responsibility to Folkly.
    data.author = {'@type':'Organization', name:'Folkly editorial', url:`${origin}/about`};
    data.publisher = {'@type':'Organization', name:'Folkly', url:origin};
    if (item.authorSlug) data.creditText = `${item.authorSlug.split('-').map(word=>word[0].toUpperCase()+word.slice(1)).join(' ')} (Folkly editorial persona)`;
    if (item.image) data.image = new URL(item.image.src, origin).href;
    return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g,'\\u003c')}</script>`;
  });
  if (!html.includes('property="og:url"')) html = html.replace('</head>', `<meta property="og:url" content="${url}"><meta property="og:type" content="article"><meta property="og:title" content="${escapeHtml(item.title)}"><meta property="og:description" content="${escapeHtml(item.summary)}"></head>`);
  if (item.image) html = html.replace('</head>', `<meta property="og:image" content="${new URL(item.image.src, origin).href}"><meta property="og:image:alt" content="${escapeHtml(item.image.alt)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${new URL(item.image.src, origin).href}"></head>`);
  return html;
}
export function imageCreditsPage(items, origin) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Image credits | Folkly</title><meta name="description" content="Photographers, sources, licenses, and image use details for Folkly’s cultural stories."><link rel="canonical" href="${origin}/image-credits"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/article-grid.css"></head><body><main class="shell"><p><a href="/">Folkly</a> / Image credits</p><h1>Image credits</h1>${items.filter(item=>item.image?.sha256).map(item=>`<section id="${item.slug}" class="image-credit-entry"><h2><a href="/${item.slug}">${escapeHtml(item.title)}</a></h2><p>${credit(item.image)}</p><p>${escapeHtml(item.image.changes)} Cropped adaptations of CC BY-SA images retain the same license; this does not license the article text.</p><p><a href="${escapeHtml(item.image.originalUrl)}">Original image</a></p></section>`).join('')}</main></body></html>`;
}

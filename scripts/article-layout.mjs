import { escapeHtml } from './public-articles.mjs';
export const ARTICLE_MIN_WORDS = 1187;
export const ARTICLE_REFERENCE = 'tokushima-aizome';
export const ARTICLE_PARAGRAPHS_PER_IMAGE = 2;
const marker = '<div class="article-body">';
export function articleBodyParts(html) {
  const start = html.indexOf(marker);
  const end = html.indexOf('<section id="sources"', start);
  if (start < 0 || end < 0) throw new Error('Article narrative/source boundary missing');
  return { prefix: html.slice(0, start + marker.length), body: html.slice(start + marker.length, end), suffix: html.slice(end) };
}
export function narrativeParagraphs(html) {
  return [...articleBodyParts(html).body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)];
}
export function articleWordCount(html) {
  const text = narrativeParagraphs(html).map(match => match[1].replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/g, '').replace(/<[^>]*>/g, ' ').replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, ' ')).join(' ');
  return (text.match(/\b[\p{L}\p{N}_’'-]+\b/gu) || []).length;
}
export function validateInlineImage(image) {
  for (const key of ['src','source','licenseUrl']) {
    if (typeof image[key] !== 'string') throw new Error('Missing inline image URL');
    const u = new URL(image[key]);
    const hosts = key === 'src' ? ['upload.wikimedia.org','thumb.wikimedia.org'] : key === 'source' ? ['commons.wikimedia.org'] : ['creativecommons.org'];
    if (u.protocol !== 'https:' || !hosts.includes(u.hostname) || u.username || u.password || u.port || /[\s<>"']/.test(image[key])) throw new Error('Unsafe inline image URL');
  }
  if (!/^(?:CC BY(?:-SA)? [1-4]\.0|CC BY(?:-SA)? 2\.5|CC0|Public domain)$/.test(image.license)) throw new Error('Unapproved inline image license');
  for (const key of ['width','height','commonsPageId']) if (!Number.isSafeInteger(image[key]) || image[key] < 1) throw new Error('Invalid inline image evidence');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(image.checkedAt || '') || !Number.isFinite(Date.parse(image.checkedAt))) throw new Error('Missing image review date');
  if (!['commons-metadata','download-decoded'].includes(image.verification)) throw new Error('Missing inline image verification');
  if (image.verification === 'download-decoded' && (!Number.isSafeInteger(image.bytes) || image.bytes < 1 || !/^[a-f0-9]{64}$/.test(image.sha256 || ''))) throw new Error('Invalid download evidence');
  if (!image.creator?.trim() || !image.caption?.trim() || !image.alt?.trim()) throw new Error('Missing inline image credit/evidence');
}
export function inlineFigure(image, afterParagraph) {
  validateInlineImage(image);
  const e = escapeHtml;
  return `<figure class="article-inline-image credited-figure" data-after-paragraph="${afterParagraph}" data-image-id="${image.commonsPageId}"><img src="${e(image.src)}" alt="${e(image.alt)}" width="${image.width}" height="${image.height}" loading="lazy" decoding="async"><figcaption>${e(image.caption)} ${image.kind === 'illustration' ? 'Image' : 'Photo'}: <a href="${e(image.source)}">${e(image.creator)}</a> / <a href="${e(image.licenseUrl)}">${e(image.license)}</a>.</figcaption></figure>`;
}
export function decorateArticleLayout(html, item, media) {
  const parts = articleBodyParts(html);
  if (parts.body.includes('class="article-inline-image')) throw new Error('Inline images already rendered');
  const words = articleWordCount(html);
  if (words < ARTICLE_MIN_WORDS) throw new Error(`Article below ${ARTICLE_MIN_WORDS}-word minimum: ${item.slug} (${words})`);
  const paragraphs = narrativeParagraphs(html);
  const required = Math.floor(paragraphs.length / ARTICLE_PARAGRAPHS_PER_IMAGE);
  const images = media[item.slug];
  if (!Array.isArray(images) || images.length !== required) throw new Error(`Inline image count mismatch: ${item.slug}, needs ${required}`);
  const ids = new Set();
  images.forEach(image => { validateInlineImage(image); if (ids.has(image.commonsPageId)) throw new Error('Repeated inline image'); ids.add(image.commonsPageId); });
  let n = 0;
  const body = parts.body.replace(/<p\b[^>]*>[\s\S]*?<\/p>/g, paragraph => {
    n++;
    return paragraph + (n % ARTICLE_PARAGRAPHS_PER_IMAGE === 0 ? inlineFigure(images[n / ARTICLE_PARAGRAPHS_PER_IMAGE - 1], n) : '');
  });
  const result = (parts.prefix + body + parts.suffix).replace(/<p class="byline">[\s\S]*?<\/p>/, byline => byline.replace(/\b\d+ min read\b/g, `${Math.ceil(words / 200)} min read`));
  const revisedAt = images.map(image => image.checkedAt).sort().at(-1);
  return result.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (match, raw) => {
    const data=JSON.parse(raw);
    if (data['@type'] !== 'Article') return match;
    data.dateModified=[revisedAt,data.datePublished,data.dateModified].filter(Boolean).sort().at(-1);
    data.wordCount=words;
    return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g,'\\u003c')}</script>`;
  });
}
export function inlineImageCredits(items, media) {
  const e=escapeHtml;
  return `<h2>Article-body images</h2>${items.map(item=>`<section id="${item.slug}-inline" class="image-credit-entry"><h3><a href="/${item.slug}">${e(item.title)}</a></h3><ol>${media[item.slug].map(image=>`<li>${e(image.caption)} ${image.kind==='illustration'?'Image':'Photo'}: <a href="${e(image.source)}">${e(image.creator)}</a> / <a href="${e(image.licenseUrl)}">${e(image.license)}</a>. ${e(image.changes)}</li>`).join('')}</ol></section>`).join('')}`;
}

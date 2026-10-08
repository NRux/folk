import { escapeHtml, renderGrid, topicLabel } from './public-articles.mjs';
export { topicLabel } from './public-articles.mjs';
export function discoveryGroups(items) {
  const groups = new Map();
  const add = (route,label,item) => { if (!groups.has(route)) groups.set(route,{label,items:[]}); groups.get(route).items.push(item); };
  for (const item of items) {
    add(`/archive/place/${item.placeSlug}`,item.placeName,item);
    for (const topic of item.topics) add(`/archive/topic/${topic}`,topicLabel(topic),item);
  }
  return groups;
}
export function discoveryRouteFiles(items) {
  return Object.fromEntries([...discoveryGroups(items).keys()].map(route=>[route,`generated-${route.slice(1).replaceAll('/','-')}.html`]));
}
function list(items, kind) {
  if (!items.length) return '<p>No published stories yet.</p>';
  return `<ul>${items.map(item=>`<li><a href="/${item.slug}">${escapeHtml(item.title)}</a>${kind==='history'?` <time datetime="${item.publishedAt}">${item.publishedAt}</time>`:''}</li>`).join('')}</ul>`;
}
export function decorateAuthor(html, items, slug) {
  const stories=items.filter(item=>item.authorSlug===slug);
  html=html.replace(/<section class="author-work">[\s\S]*?<\/section>/, `<section class="author-work"><div class="section-head"><h2>Published stories</h2><span>${stories.length} published</span></div>${list(stories)}</section>`);
  return html.replace(/<section class="history">[\s\S]*?<\/section>/,`<section class="history"><h2>Publication history</h2>${list(stories,'history')}</section>`);
}
export function decorateArchive(html, items) {
  const groups=discoveryGroups(items);
  const grouped=(prefix)=>[...groups].filter(([route])=>route.startsWith(prefix)).sort((a,b)=>a[1].label.localeCompare(b[1].label)).map(([route,group])=>`<li><a href="${route}">${escapeHtml(group.label)} <span class="count">${group.items.length}</span></a></li>`).join('');
  const authors=[...new Set(items.map(item=>item.authorSlug).filter(Boolean))].sort();
  const content=`<div class="intro"><h1>The archives</h1><p>Every published story, organized by place, topic, and editorial persona.</p></div><section class="archive-columns"><section class="archive-col"><h2>By place</h2><ul>${grouped('/archive/place/')}</ul></section><section class="archive-col"><h2>By topic</h2><ul>${grouped('/archive/topic/')}</ul></section><section class="archive-col"><h2>By editorial persona</h2><ul>${authors.map(slug=>`<li><a href="/author/${slug}">${escapeHtml(slug.split('-').map(word=>word[0].toUpperCase()+word.slice(1)).join(' '))} <span class="count">${items.filter(item=>item.authorSlug===slug).length}</span></a></li>`).join('')}</ul></section></section><section class="section-head"><h2>All stories</h2><span>${items.length} in the archive</span></section><div class="story-grid" data-published-grid>${renderGrid(items)}</div>`;
  return html.replace(/<main id="main" class="shell">[\s\S]*?<\/main>/,`<main id="main" class="shell">${content}</main>`);
}
export function discoveryPage(template, route, group, origin) {
  let html=template.replace(/<title>[\s\S]*?<\/title>/,`<title>${escapeHtml(group.label)} Stories | Folkly</title>`);
  html=html.replace(/<link rel="canonical" href="[^"]*">/,`<link rel="canonical" href="${origin}${route}">`);
  html=html.replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="Explore ${escapeHtml(group.label)} through researched cultural stories from Folkly.">`);
  html=html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g,'');
  html=html.replace(/<meta property="og:[^"]*" content="[^"]*">/g,'');
  return html.replace(/<main id="main" class="shell">[\s\S]*?<\/main>/,`<main id="main" class="shell"><div class="intro"><h1>${escapeHtml(group.label)}</h1><p>${group.items.length} published ${group.items.length===1?'story':'stories'}. <a href="/archive">Browse all archives</a>.</p></div><div class="story-grid" data-published-grid>${renderGrid(group.items)}</div></main>`);
}
export function relatedStories(items, item, media = {}) {
  const published = new Map(items.map(story => [story.slug, story]));
  const links = new Map();
  for (const link of item.related || []) {
    if (link.slug !== item.slug && published.has(link.slug)) links.set(link.slug, link.reason);
  }
  const candidates = items.filter(story => story.slug !== item.slug).sort((a,b) => {
    const score = story => story.topics.filter(topic => item.topics.includes(topic)).length + (story.placeSlug === item.placeSlug ? 2 : 0);
    return score(b) - score(a) || a.slug.localeCompare(b.slug);
  });
  for (const story of candidates) if (!links.has(story.slug)) links.set(story.slug, story.summary || story.description || `Explore ${story.placeName}.`);
  const related = [...links].slice(0,4);
  if (!related.length) return '';
  return `<section class="related-stories" aria-labelledby="related-${escapeHtml(item.slug)}"><h2 id="related-${escapeHtml(item.slug)}">Related stories</h2><ul>${related.map(([slug,reason]) => {
    const story = published.get(slug);
    const image = story.image || media[slug]?.[0];
    const preview = image ? `<img class="related-image" src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}"${image.width ? ` width="${image.width}" height="${image.height}"` : ''} loading="lazy" decoding="async">` : '';
    return `<li><a class="related-card" href="/${escapeHtml(slug)}">${preview}<span>${escapeHtml(story.title)}</span></a><p>${escapeHtml(reason)}</p>${image?.creator ? `<small>Photo: <a href="${escapeHtml(image.source)}">${escapeHtml(image.creator)}</a>${image.licenseUrl ? ` / <a href="${escapeHtml(image.licenseUrl)}">${escapeHtml(image.license)}</a>` : ''}</small>` : ''}</li>`;
  }).join('')}</ul></section>`;
}

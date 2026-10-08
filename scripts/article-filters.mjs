import { escapeHtml, topicLabel } from './public-articles.mjs';
export function addArticleFilters(html, articles) {
  const marker='<div class="story-grid" data-published-grid>';
  if(!html.includes(marker))return html;
  const slugs=new Set([...html.matchAll(/data-article="([a-z0-9-]+)"/g)].map(m=>m[1]));
  const items=articles.filter(item=>slugs.has(item.slug));
  const tags=[...new Set(items.flatMap(item=>item.topics))].sort((a,b)=>topicLabel(a).localeCompare(topicLabel(b)));
  const places=[...new Map(items.map(item=>[item.placeSlug,item.placeName]))].sort((a,b)=>a[1].localeCompare(b[1]));
  const e=escapeHtml;
  const controls=`<section class="article-filter-panel" data-article-filters hidden aria-label="Filter and sort articles"><div class="article-filter-row"><label>Place <select name="place"><option value="">All places</option>${places.map(([slug,label])=>`<option value="${e(slug)}">${e(label)}</option>`).join('')}</select></label><label>Sort <select name="sort"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="title">Title A–Z</option></select></label><button type="button" data-clear-filters>Clear filters</button></div><details><summary>Filter by tags</summary><p class="filter-hint">Stories match any selected tag. Combine tags with a place to narrow the results.</p><fieldset><legend class="filter-sr-only">Article tags</legend>${tags.map(tag=>`<label class="filter-tag"><input type="checkbox" name="tag" value="${e(tag)}">${e(topicLabel(tag))} <span>(${items.filter(item=>item.topics.includes(tag)).length})</span></label>`).join('')}</fieldset></details><p data-filter-count role="status" aria-live="polite" aria-atomic="true">${items.length} stories</p><p data-filter-empty hidden>No stories match these filters. Clear filters or choose another tag.</p></section>`;
  return html.replace(marker,controls+marker).replace('</body>','<script type="module" src="/article-filters.js"></script></body>');
}

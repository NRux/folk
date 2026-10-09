import { escapeHtml, topicLabel } from './public-articles.mjs';
import {COUNTRIES,REGIONS,validateGeography} from './geography.mjs';
export function addArticleFilters(html, articles) {
  const marker='<div class="story-grid" data-published-grid>';
  if(!html.includes(marker))return html;
  const slugs=new Set([...html.matchAll(/data-article="([a-z0-9-]+)"/g)].map(m=>m[1]));
  const items=articles.filter(item=>slugs.has(item.slug));
  const tags=[...new Set(items.flatMap(item=>item.topics))].sort((a,b)=>topicLabel(a).localeCompare(topicLabel(b)));
  items.forEach(validateGeography);
  const countries=[...new Set(items.map(item=>item.countrySlug))].sort((a,b)=>COUNTRIES[a].name.localeCompare(COUNTRIES[b].name));
  const e=escapeHtml;
  const controls=`<section class="article-filter-panel" data-article-filters hidden aria-label="Filter and sort articles"><div class="article-filter-row"><label>Place <select name="place"><option value="">Everywhere</option><optgroup label="Regions">${Object.entries(REGIONS).map(([slug,label])=>`<option value="region:${e(slug)}">${e(label)}</option>`).join('')}</optgroup><optgroup label="Countries">${countries.map(slug=>`<option value="country:${e(slug)}">${e(COUNTRIES[slug].name)}</option>`).join('')}</optgroup></select></label><label>Sort <select name="sort"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="title">Title A–Z</option></select></label><details class="filter-tags-menu"><summary>Tags</summary><div class="filter-tags-options"><p class="filter-hint">Match any selected tag.</p><fieldset><legend class="filter-sr-only">Article tags</legend>${tags.map(tag=>`<label class="filter-tag"><input type="checkbox" name="tag" value="${e(tag)}">${e(topicLabel(tag))} <span>(${items.filter(item=>item.topics.includes(tag)).length})</span></label>`).join('')}</fieldset></div></details><button type="button" data-clear-filters>Clear</button><span data-filter-count role="status" aria-live="polite" aria-atomic="true">${items.length} stories</span></div><p data-filter-empty hidden>No stories match. Clear filters or choose another tag.</p></section>`;
  return html.replace(marker,controls+marker).replace('</body>','<script type="module" src="/article-filters.js"></script></body>');
}

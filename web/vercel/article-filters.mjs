export const regionSlugs=['north-america','central-america','south-america','africa','asia','europe','oceania'];
export function normalizeFilters(input, items) {
  const knownTags=new Set(items.flatMap(item=>item.topics));
  const knownPlaces=new Set([...items.filter(item=>typeof item.country==='string'&&/^[a-z]+(?:-[a-z]+)*$/.test(item.country)).map(item=>'country:'+item.country),...regionSlugs.map(region=>'region:'+region)]);
  return {tags:[...new Set(input.tags||[])].filter(tag=>knownTags.has(tag)).sort(),place:knownPlaces.has(input.place)?input.place:'',sort:['newest','oldest','title'].includes(input.sort)?input.sort:'newest'};
}
export function selectArticles(items, filters) {
  return items.filter(item=>(!filters.place||`country:${item.country}`===filters.place||`region:${item.region}`===filters.place)&&(!filters.tags.length||filters.tags.some(tag=>item.topics.includes(tag)))).slice().sort((a,b)=>{
    const order=filters.sort==='title'?a.title.localeCompare(b.title):filters.sort==='oldest'?a.published.localeCompare(b.published):b.published.localeCompare(a.published);
    return order||a.slug.localeCompare(b.slug);
  });
}
export function readFilters(params, items) {
  return normalizeFilters({tags:params.getAll('tag'),place:params.get('place'),sort:params.get('sort')},items);
}
export function writeFilters(url, filters) {
  const next=new URL(url);
  for(const key of ['tag','place','sort'])next.searchParams.delete(key);
  for(const tag of filters.tags)next.searchParams.append('tag',tag);
  if(filters.place)next.searchParams.set('place',filters.place);
  if(filters.sort!=='newest')next.searchParams.set('sort',filters.sort);
  return next;
}
export function initializeArticleFilters(doc, win) {
  const panel=doc.querySelector('[data-article-filters]');
  const grid=doc.querySelector('[data-published-grid]');
  if(!panel||!grid)return;
  const items=[...grid.querySelectorAll('[data-article]')].map(card=>({slug:card.dataset.article,title:card.dataset.title,country:card.dataset.country,region:card.dataset.region,topics:card.dataset.topics.split(' ').filter(Boolean),published:card.dataset.published,card}));
  const place=panel.querySelector('[name="place"]'),sort=panel.querySelector('[name="sort"]');
  const tags=[...panel.querySelectorAll('[name="tag"]')];
  const count=panel.querySelector('[data-filter-count]'),empty=panel.querySelector('[data-filter-empty]');
  const apply=(filters,updateUrl)=>{
    place.value=filters.place;sort.value=filters.sort;
    tags.forEach(tag=>{tag.checked=filters.tags.includes(tag.value);});
    const selected=selectArticles(items,filters),visible=new Set(selected.map(item=>item.slug));
    items.forEach(item=>{item.card.hidden=!visible.has(item.slug);});
    selected.forEach(item=>grid.append(item.card));
    count.textContent=`Showing ${selected.length} of ${items.length} ${items.length===1?'story':'stories'}`;
    empty.hidden=selected.length>0;
    if(updateUrl)win.history.replaceState(null,'',writeFilters(win.location.href,filters));
  };
  panel.addEventListener('change',()=>apply(normalizeFilters({tags:tags.filter(t=>t.checked).map(t=>t.value),place:place.value,sort:sort.value},items),true));
  panel.querySelector('[data-clear-filters]').addEventListener('click',()=>apply(normalizeFilters({},items),true));
  win.addEventListener('popstate',()=>apply(readFilters(new URL(win.location.href).searchParams,items),false));
  apply(readFilters(new URL(win.location.href).searchParams,items),false);
  panel.hidden=false;
}
if(typeof document!=='undefined')initializeArticleFilters(document,window);

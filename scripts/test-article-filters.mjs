import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeFilters,selectArticles,readFilters,writeFilters,initializeArticleFilters} from '../web/vercel/article-filters.mjs';
import {addArticleFilters} from './article-filters.mjs';
import {publishedArticles,renderGrid} from './public-articles.mjs';
assert.equal(await readFile('dist/article-filters.js','utf8'),await readFile('web/vercel/article-filters.mjs','utf8'),'Deployed module must match tested controller');
const catalog=JSON.parse(await readFile('web/vercel/articles.json','utf8'));
const routes=JSON.parse(await readFile('web/vercel/routes.json','utf8'));
const articles=publishedArticles([...catalog,{slug:'private-canary',status:'draft',title:'PRIVATE_CANARY',topics:['secret']}],routes);
const items=articles.map(item=>({slug:item.slug,title:item.title,country:item.countrySlug,region:item.regionSlug,topics:item.topics,published:item.publishedAt}));
const defaults=normalizeFilters({},items);
assert.equal(selectArticles(items,defaults).length,11);
const music=normalizeFilters({tags:['music']},items);
assert(selectArticles(items,music).length>0);
assert(selectArticles(items,music).every(item=>item.topics.includes('music')));
const multi=normalizeFilters({tags:['music','ritual-belonging']},items);
assert(selectArticles(items,multi).every(item=>item.topics.some(tag=>multi.tags.includes(tag))));
assert.deepEqual(normalizeFilters({tags:['<script>','music','music'],place:'../owner',sort:'evil'},items),{tags:['music'],place:'',sort:'newest'});
const place='country:ghana';
assert.equal(selectArticles(items,normalizeFilters({tags:['music'],place},items)).length,0);
for(const [place,count] of [['country:united-states',2],['country:mexico',2],['region:north-america',4],['region:europe',2],['region:africa',1],['region:asia',3],['region:oceania',1],['region:central-america',0],['region:south-america',0]])assert.equal(selectArticles(items,normalizeFilters({place},items)).length,count,place);
for(const place of ['lisbon-portugal','new-orleans-united-states','country:unknown','region:unknown','toString'])assert.equal(normalizeFilters({place},items).place,'');
assert.equal(normalizeFilters({place:'country:undefined'},[{topics:[]}]).place,'');
assert.equal(normalizeFilters({place:'country:<script>'},[{topics:[],country:'<script>'}]).place,'');
for(const sort of ['oldest','newest','title']){
 const selected=selectArticles(items,normalizeFilters({sort},items));
 for(let i=1;i<selected.length;i++){const a=selected[i-1],b=selected[i];assert(sort==='title'?a.title.localeCompare(b.title)<=0:sort==='oldest'?a.published<=b.published:a.published>=b.published);}
}
const url=writeFilters('https://www.folkly.com/archive?utm_source=test&tag=old#stories',multi);
assert.equal(url.searchParams.get('utm_source'),'test');assert.equal(url.hash,'#stories');assert.deepEqual(readFilters(url.searchParams,items),multi);
assert.equal(writeFilters(url,defaults).searchParams.getAll('tag').length,0);
assert.deepEqual(items.map(i=>i.slug),articles.map(i=>i.slug),'Filtering must not mutate catalog order');
for(const route of ['index','archive','archive/topic/music']){
 const html=await readFile(`dist/${route}.html`,'utf8');
 assert(html.includes('data-article-filters hidden'));assert(html.includes('/article-filters.js'));
 assert(html.includes('aria-live="polite"'));assert(html.includes('name="sort"'));assert(html.includes('name="place"'));
 assert(html.includes('class="article-tags"'));assert(!html.includes('PRIVATE_CANARY'));
 assert(html.includes('<optgroup label="Countries">'));assert(html.includes('<optgroup label="Regions">'));assert(!html.includes('value="lisbon-portugal"'));assert(!html.includes('data-place='));assert(html.includes('data-country='));assert(html.includes('data-region='));
}
const scope=articles.filter(item=>item.topics.includes('music'));
const scoped=addArticleFilters(`<body><div class="story-grid" data-published-grid>${renderGrid(scope)}</div></body>`,articles);
assert(!scoped.includes('value="agriculture"'),'Only tags in this grid belong in controls');
assert(!scoped.includes('secret'));assert.equal(addArticleFilters('<body>No grid</body>',articles),'<body>No grid</body>');
const escaped=renderGrid([{...articles[0],title:'" onclick="bad <script>x</script>'}]);assert(!escaped.includes('<script>'));assert(escaped.includes('&lt;script&gt;'));
// Exercise actual UI controller through its DOM boundary, including query restore,
// change, clear, empty results and browser-history restore without an API request.
const handlers={},windowHandlers={};
const element=()=>({hidden:true,value:'',textContent:'',addEventListener(type,fn){handlers[type]=fn;}});
const placeControl=element(),sortControl=element(),count=element(),empty=element(),clear=element();
clear.addEventListener=(_,fn)=>{handlers.clear=fn;};
const tags=[...new Set(items.flatMap(item=>item.topics))].map(value=>({value,checked:false}));
const cards=items.map(item=>({dataset:{article:item.slug,title:item.title,country:item.country,region:item.region,topics:item.topics.join(' '),published:item.published},hidden:false}));
const grid={querySelectorAll:()=>cards,append(card){const i=cards.indexOf(card);cards.splice(i,1);cards.push(card);}};
const panel={hidden:true,querySelector:s=>({'[name="place"]':placeControl,'[name="sort"]':sortControl,'[data-filter-count]':count,'[data-filter-empty]':empty,'[data-clear-filters]':clear}[s]),querySelectorAll:()=>tags,addEventListener(type,fn){handlers[type]=fn;}};
const win={location:{href:'https://www.folkly.com/archive?tag=music'},history:{replaceState(_,__,url){win.location.href=url.href;}},addEventListener(type,fn){windowHandlers[type]=fn;}};
initializeArticleFilters({querySelector:s=>s==='[data-article-filters]'?panel:grid},win);
assert(!panel.hidden);assert(cards.filter(c=>!c.hidden).every(c=>c.dataset.topics.split(' ').includes('music')));
placeControl.value=place;handlers.change();assert(cards.every(c=>c.hidden));assert(!empty.hidden);assert(count.textContent.startsWith('Showing 0'));
handlers.clear();assert(cards.every(c=>!c.hidden));assert(empty.hidden);assert.equal(new URL(win.location.href).searchParams.get('tag'),null);
placeControl.value='region:europe';handlers.change();assert.equal(cards.filter(c=>!c.hidden).length,2);assert(cards.filter(c=>!c.hidden).every(c=>c.dataset.region==='europe'));assert.equal(new URL(win.location.href).searchParams.get('place'),'region:europe');
win.location.href='https://www.folkly.com/archive?tag=music&sort=title';windowHandlers.popstate();assert.equal(sortControl.value,'title');assert(cards.filter(c=>!c.hidden).every(c=>c.dataset.topics.split(' ').includes('music')));
console.log('Article filters passed: tags/place intersection, multi-tag union, deterministic sorting, URL restore/clear, empty state, keyboard-native markup, public-only scoped controls, escaping and UI events.');

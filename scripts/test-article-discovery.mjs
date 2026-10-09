import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { publishedArticles, decorateArticle } from './public-articles.mjs';
import { discoveryGroups, discoveryRouteFiles, decorateArchive, decorateAuthor, relatedStories } from './article-discovery.mjs';
const routes=JSON.parse(await readFile('web/vercel/routes.json','utf8'));
const catalog=JSON.parse(await readFile('web/vercel/articles.json','utf8'));
const items=publishedArticles(catalog,routes);
const archive=await readFile('dist/archive.html','utf8');
assert(archive.includes('11 in the archive'));
assert(!archive.includes('4 in the archive'));
const sitemap=await readFile('dist/sitemap.xml','utf8');
for(const item of items){
 const html=await readFile(`dist/${item.slug}.html`,'utf8');
 const source=await readFile(`web/vercel/pages/${routes['/'+item.slug]}`,'utf8');
 assert(html.includes(`<title>${item.searchTitle.replaceAll('&','&amp;')} | Folkly</title>`));
 assert.equal(html.match(/<h1[^>]*>[\s\S]*?<\/h1>/)[0],source.match(/<h1[^>]*>[\s\S]*?<\/h1>/)[0]);
 assert.equal(archive.split(`data-article="${item.slug}"`).length-1,1);
 const schema=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
 assert.equal(schema.author['@type'],'Organization');assert.equal(schema.author.url,'https://www.folkly.com/about');
 assert.equal(schema.publisher.name,'Folkly');
 assert.equal(schema.publisher.logo.contentUrl,'https://www.folkly.com/assets/folkly-logo-512.png');
 if(item.authorSlug)assert(schema.creditText.includes('editorial persona'));
 assert(html.includes('class="related-stories"'));
 const related = html.match(/<section class="related-stories"[\s\S]*?<\/section>/)[0];
 assert.equal((related.match(/class="related-card"/g)||[]).length,4);
 assert.equal((related.match(/<img /g)||[]).length,4);
 assert(!related.includes(`href="/${item.slug}"`));
 assert.equal(new Set([...related.matchAll(/class="related-card" href="([^"]+)"/g)].map(m=>m[1])).size,4);
 assert(html.includes('Stories about the intersection of Culture and Place.'));
 assert(html.includes('A Then Media inc. project.'));
 assert(!html.includes('A project by Noah Rappaport'));
 for(const link of item.related)assert(html.includes(`href="/${link.slug}"`));
 if(item.authorSlug){const author=await readFile(`dist/author/${item.authorSlug}.html`,'utf8');assert(author.includes(`href="/${item.slug}"`));assert(!author.includes('In the queue'));assert(!author.includes('Nothing published yet'));}
}
for(const [route,group] of discoveryGroups(items)){
 const html=await readFile(`dist${route}.html`,'utf8');
 assert(sitemap.includes(`https://www.folkly.com${route}`));
 for(const item of group.items)assert(html.includes(`data-article="${item.slug}"`));
 assert.equal((html.match(/data-article=/g)||[]).length,group.items.length);
}
assert(!sitemap.includes('/archive/topic/ceramics'));
assert((await readFile('dist/archive/topic/ceramics.html','utf8')).includes('noindex,follow'));
assert((await readFile('dist/author/lena-march.html','utf8')).includes('rel="canonical" href="https://www.folkly.com/author/lena-march"'));
const future={...items[0],slug:'future-approved-story',placeSlug:'new-public-place',placeName:'New public place',authorSlug:'ellis-reed',topics:['ceramics'],related:[]};
const futureItems=publishedArticles([...catalog,future],{...routes,'/future-approved-story':'future-approved-story.html'});
assert(discoveryRouteFiles(futureItems)['/archive/place/new-public-place']);
assert(discoveryRouteFiles(futureItems)['/archive/topic/ceramics']);
assert(decorateAuthor('<section class="author-work"></section><section class="history"></section>',futureItems,'ellis-reed').includes('/future-approved-story'));
assert(decorateArchive('<main id="main" class="shell"></main>',futureItems).includes('12 in the archive'));
const draft={...future,status:'draft',title:'PRIVATE_CANARY',slug:'private-canary'};
assert.deepEqual(discoveryRouteFiles(publishedArticles([...catalog,draft],routes)),discoveryRouteFiles(items));
assert(!relatedStories(items,{...items[0],related:[{slug:'private-canary',reason:'PRIVATE_CANARY'}]}).includes('PRIVATE_CANARY'));
assert.throws(()=>publishedArticles([{...future,publishedAt:'2026-02-31'}],{'/future-approved-story':'future-approved-story.html','/author/ellis-reed':'ellis.html'}));
const malicious={...items[0],searchTitle:'Test <script>alert(1)</script>',image:{...items[0].image,src:'https://thumb.wikimedia.org/test.jpg" onerror="alert(1)'}};
const decorated=decorateArticle(await readFile(`web/vercel/pages/${routes['/'+items[0].slug]}`,'utf8'),malicious,'https://www.folkly.com');
assert(!decorated.includes('<script>alert(1)</script>'));
assert(!decorated.includes(' onerror="alert(1)'));
assert(decorated.includes('&quot; onerror=&quot;'));
console.log('Article discovery passed: truthful counts, all author/place/topic links, future exports, draft exclusion, unchanged H1s, related links, escaped metadata, valid dates.');

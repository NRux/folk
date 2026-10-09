import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { publishedArticles, renderGrid, populateHomepage, verifyImageFiles } from './public-articles.mjs';
const routes = JSON.parse(await readFile('web/vercel/routes.json','utf8'));
const catalog = JSON.parse(await readFile('web/vercel/articles.json','utf8'));
const released = JSON.parse(await readFile('web/vercel/manual-releases.json','utf8')).articles;
const articles = publishedArticles(catalog,routes);
await verifyImageFiles(articles);
assert.equal(articles.filter(item=>item.image).length,11);
const home = await readFile('dist/index.html','utf8');
const sitemap=await readFile('dist/sitemap.xml','utf8');
for (const item of articles) {
  assert.equal(home.split(`data-article="${item.slug}"`).length-1,1);
  const page = await readFile(`dist/${item.slug}.html`,'utf8');
  assert(page.includes(`rel="canonical" href="https://www.folkly.com/${item.slug}"`));
  assert(sitemap.includes(`<loc>https://www.folkly.com/${item.slug}</loc>`));
  const schema=JSON.parse(page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(schema.mainEntityOfPage,`https://www.folkly.com/${item.slug}`);
  assert.equal(schema.publisher['@id'],'https://www.folkly.com/#organization');
  assert.equal(schema.publisher.logo.url,'https://www.folkly.com/assets/folkly-logo-512.png');
  assert.equal(schema.publisher.logo.width,512);assert.equal(schema.publisher.logo.height,512);
  if(item.image){assert.equal(schema.image,new URL(item.image.src,'https://www.folkly.com').href);assert(page.includes('property="og:image"'));}
}
for(const item of released){
 const html=await readFile(`dist/${item.slug}.html`,'utf8');
 assert(html.includes('class="article-figure credited-figure"'));
 assert(html.includes('fetchpriority="high"'));
 const image=articles.find(a=>a.slug===item.slug).image;
 assert(html.includes(image.source));assert(html.includes(image.licenseUrl));
 const source=await readFile(`web/vercel/pages/${routes['/'+item.slug]}`,'utf8');
 const withoutInline=html.replace(/<figure class="article-inline-image[\s\S]*?<\/figure>/g,'');
 assert.equal(withoutInline.split('<div class="article-layout">')[1].split('</article>')[0],source.replace(/<p class="editorial-note">[\s\S]*?<\/p>/g,'').split('<div class="article-layout">')[1].split('</article>')[0]);
}
const draft={slug:'secret-reserve-canary',status:'draft',title:'PRIVATE_CANARY'};
assert.deepEqual(publishedArticles([...catalog,draft],routes),articles);
assert(!renderGrid(publishedArticles([...catalog,draft],routes)).includes('PRIVATE_CANARY'));
const future={...articles[0],slug:'future-approved-story',title:'Future <story>',publishedAt:'2026-10-09'};
const updated=publishedArticles([...catalog,future],{...routes,'/future-approved-story':'future-approved-story.html'});
const source=await readFile(`web/vercel/pages/${routes['/']}`,'utf8');
assert(populateHomepage(source,updated).includes('data-article="future-approved-story"'));
assert(renderGrid(updated).includes('Future &lt;story&gt;'));
assert.throws(()=>publishedArticles([...catalog,articles[0]],routes));
assert.throws(()=>publishedArticles([...catalog,{...future,slug:'../owner'}],routes));
assert.throws(()=>publishedArticles([{...future,image:{...future.image,src:'https://untrusted.example/image.jpg'}}],{'/future-approved-story':'future-approved-story.html'}));
assert(!sitemap.includes('/owner'));
assert((await readFile('dist/owner.html','utf8')).includes('noindex'));
const identity=JSON.parse(home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
const organization=identity['@graph'].find(node=>node['@type']==='Organization');
const website=identity['@graph'].find(node=>node['@type']==='WebSite');
assert.equal(organization.name,'Folkly');assert.equal(organization.parentOrganization.name,'Then Media inc.');
assert.equal(organization.logo.contentUrl,'https://www.folkly.com/assets/folkly-logo-512.png');
assert.equal(website.name,'Folkly');assert.equal(website.publisher['@id'],organization['@id']);
assert(home.includes('<title>Folkly | Stories at the Intersection of Culture and Place</title>'));
assert(home.includes('<meta property="og:site_name" content="Folkly">'));
const logo=await readFile('dist/assets/folkly-logo-512.png');assert(logo.length>1000);
console.log('Public article checks passed: automatic additions, draft exclusion, image credits, all grid cards, canonical/schema/sitemap, preserved article bodies.');

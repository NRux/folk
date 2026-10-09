import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { publishedArticles } from './public-articles.mjs';
import { validateImageVariants, responsiveAttributes, applyResponsiveImages } from './responsive-images.mjs';
const routes=JSON.parse(await readFile('web/vercel/routes.json','utf8'));
const catalog=JSON.parse(await readFile('web/vercel/articles.json','utf8'));
const items=publishedArticles(catalog,routes);
const pictures=items.filter(item=>item.image);
assert.equal(pictures.length,11);
const home=await readFile('dist/index.html','utf8');
assert.equal((home.match(/srcset=/g)||[]).length,12); // Hero plus the eleven illustrated grid cards.
const hero=home.match(/<img[^>]*fetchpriority="high"[^>]*>/)[0];
assert(!hero.includes('loading="lazy"'));
assert(hero.includes('sizes=')&&hero.includes('srcset='));
const responsiveUrls=[];
for(const item of pictures){
 const image=item.image;
 validateImageVariants(image);
 assert(image.variants.some(v=>v.width===330));
 const html=await readFile(`dist/${item.slug}.html`,'utf8');
 const lead=html.match(/<img\b[^>]*>/)[0];
 assert(lead.includes('srcset=')&&lead.includes('sizes='),item.slug);
 assert(lead.includes(`width="${image.width}"`)&&lead.includes(`height="${image.height}"`));
 assert(lead.includes(`src="${image.src}"`)||lead.includes(`src="${image.src.slice(1)}"`));
 assert(!lead.includes('loading="lazy"'));
 for(const variant of image.variants){assert(lead.includes(`${variant.src} ${variant.width}w`));responsiveUrls.push(variant.src);}
 const archive=await readFile('dist/archive.html','utf8');
 assert(archive.includes(`${image.variants[0].src} ${image.variants[0].width}w`));
}
const oaxaca=pictures.find(item=>item.slug==='oaxaca-living-color').image;
assert.deepEqual([oaxaca.width,oaxaca.height],[2592,3872]);
assert(oaxaca.variants.every(v=>v.height>v.width),'Portrait orientation must agree with provider thumbnails');
const reference=pictures[0].image;
const bad=variant=>({ ...reference,variants:[{...reference.variants[0],...variant}] });
for(const src of ['https://evil.example/photo.jpg','https://thumb.wikimedia.org/photo.jpg" onerror="alert(1)','https://user:secret@thumb.wikimedia.org/photo.jpg','/admin/private.jpg','https://thumb.wikimedia.org/photo.jpg, /api/private 2x'])assert.throws(()=>validateImageVariants(bad({src})));
assert.throws(()=>validateImageVariants(bad({width:reference.width+1})));
assert.throws(()=>validateImageVariants(bad({height:10})));
assert.throws(()=>validateImageVariants({...reference,variants:[reference.variants[0],reference.variants[0]]}));
assert.throws(()=>validateImageVariants(bad({sha256:''})));
const input=`<img src="${reference.src}" width="1" height="1" srcset="stale 1w" sizes="1px" loading="lazy">`;
const updated=applyResponsiveImages(input,[pictures[0]],'/archive');
assert.equal(applyResponsiveImages(updated,[pictures[0]],'/archive'),updated,'Decorating twice must not duplicate attributes');
assert(!updated.includes('stale 1w'));
assert.equal(applyResponsiveImages('<img src="/other.jpg">',[pictures[0]],'/'),'<img src="/other.jpg">');
assert.equal(responsiveAttributes({...reference,variants:undefined},'article'),'');
const small=pictures.find(item=>item.slug==='tokushima-aizome').image;
assert(small.variants.every(v=>v.width<=854));
console.log(`Responsive images passed: ${pictures.length} photos, ${new Set(responsiveUrls).size} verified candidate URLs, fallback/lazy/hero behavior, orientation, private-host denial, and idempotent markup.`);

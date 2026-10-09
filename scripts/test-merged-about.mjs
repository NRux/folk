import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
const source=await readFile('web/vercel/pages/about.html','utf8'),built=await readFile('dist/about.html','utf8');
const editorial=source.slice(source.indexOf('<main'),source.indexOf('<section id="contact"')).replace(/<[^>]*>/g,' ');
assert.equal(editorial.trim().split(/\s+/).length,361);assert(editorial.trim().split(/\s+/).length<=759/2,'Combined editorial copy must be at least half shorter');
for(const text of ['Adaptive Identity Through Struggle','id="perspective"','id="contact"','name="reason"','name="contributor"','name="consent"','Folkly is seeking contributors'])assert(built.includes(text),text);
assert.equal((built.match(/id="contact-form"/g)||[]).length,1);assert(!built.includes('href="/perspective"'));assert(!built.includes('Read about our perspective'));
const config=JSON.parse(await readFile('vercel.json','utf8'));for(const source of ['/perspective','/perspective.html'])assert(config.redirects.some(r=>r.source===source&&r.destination==='/about#perspective'&&r.permanent));
await assert.rejects(stat('dist/perspective.html'));assert(!(await readFile('dist/sitemap.xml','utf8')).includes('/perspective</loc>'));
for(const path of ['index','archive','subscribe','owner','detroit-future-frequency','castells-tarragona']){const html=await readFile('dist/'+path+'.html','utf8');assert(!html.includes('>Our perspective</a>'));assert(!html.includes('href="/perspective"'));}
console.log('Merged About passed: 361 of 759 editorial words, five-part perspective, single contributor contact form, legacy permanent redirects, sitemap/nav consolidation.');

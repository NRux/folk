import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {articleBodyParts, articleWordCount} from './article-layout.mjs';
const expected = {
 'new-orleans-second-line':['followers dance behind a club'],
 'lisbon-fado':['Portuguese song tradition','museum devoted to this music','historic Lisbon neighborhood'],
 'oaxaca-living-color':['weaving town in Oaxaca','an Indigenous people','red dye obtained from scale insects'],
 'detroit-future-frequency':['electronic instrument that creates and shapes sound','community near Detroit'],
 'bonwire-kente':['cloth assembled from narrow handwoven strips'],
 'castells-tarragona':['supporting base of people','stacked trunk of climbers'],
 'kimjang-seoul':['making and sharing kimchi','South Korea’s capital'],
 'matariki-puanga':['Māori name for New Zealand','Maunga, or mountains','kinship communities','star cluster also called the Pleiades','Western astronomy names this star Rigel','Taranaki lies on the island’s western coast','a prayer or invocation','the whenua, the land'],
 'nowruz-tajikistan':['capital of Tajikistan in Central Asia','also known as Nowruz'],
 'tokushima-aizome':['Japanese island of Shikoku','prepared leaf material used to make the dye','protecting selected areas of cloth'],
 'xochimilco-chinampas':['a canal boat carrying passengers','National Autonomous University of Mexico','an aquatic salamander','growers who work these raised fields']
};
for (const [slug,phrases] of Object.entries(expected)) {
 const html = await readFile(`dist/${slug}.html`,'utf8');
 const body = articleBodyParts(html).body;
 for (const phrase of phrases) assert(body.includes(phrase),`${slug}: ${phrase}`);
 assert(!body.includes(',,') && !body.includes(',.'),`${slug}: punctuation`);
 assert(articleWordCount(html)>=1187);
}
const sky=await readFile('dist/matariki-puanga.html','utf8');
assert(!sky.includes('It rises approximately a week before Matariki'));
for(const n of [7,8,9])assert(sky.includes(`id="source-${n}"`));
console.log('Reader context passed: all 11 public stories, cultural/geographic/technical context, corrected regional astronomy, source links, minimum length and punctuation.');

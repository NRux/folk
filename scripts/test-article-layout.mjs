import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { articleBodyParts, articleWordCount, narrativeParagraphs, decorateArticleLayout, inlineFigure, validateInlineImage, ARTICLE_MIN_WORDS, ARTICLE_REFERENCE } from './article-layout.mjs';
import { publishedArticles } from './public-articles.mjs';
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const articles=publishedArticles(await json('web/vercel/articles.json'),await json('web/vercel/routes.json'));
const media=await json('web/vercel/article-media.json');
assert.equal(articleWordCount(await readFile(`web/vercel/pages/${ARTICLE_REFERENCE}.html`,'utf8')),ARTICLE_MIN_WORDS);
const credits=await readFile('dist/image-credits.html','utf8');
let total=0;
for(const item of articles){
 const source=await readFile(`web/vercel/pages/${item.slug}.html`,'utf8');
 const output=await readFile(`dist/${item.slug}.html`,'utf8');
 assert(articleWordCount(output)>=ARTICLE_MIN_WORDS,item.slug);
 const schema=JSON.parse(output.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
 assert.equal(schema.wordCount,articleWordCount(output));assert.equal(schema.dateModified,'2026-10-08');
 assert.equal(articleWordCount(output),articleWordCount(source),'Captions must not inflate length');
 const body=articleBodyParts(output).body;
 let paragraph=0,figures=0;
 for(const match of body.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>|<figure class="article-inline-image[\s\S]*?<\/figure>/g)){
  if(match[0].startsWith('<p'))paragraph++;
  else {figures++;assert.equal(paragraph,figures*2,item.slug);assert(match[0].includes(`data-after-paragraph="${paragraph}"`));assert(match[0].includes('loading="lazy"'));assert(match[0].includes('decoding="async"'));assert.match(match[0],/width="\d+" height="\d+"/);assert.match(match[0],/<figcaption>.+https:\/\/commons\.wikimedia\.org.+https:\/\/creativecommons\.org/);}
 }
 assert.equal(figures,Math.floor(narrativeParagraphs(source).length/2));
 assert.equal(figures,media[item.slug].length);
 assert(credits.includes(`id="${item.slug}-inline"`));
 for(const image of media[item.slug])assert(credits.includes(image.source));
 assert(!articleBodyParts(output).suffix.includes('class="article-inline-image'));
 assert(output.includes('<h1>')||output.includes('<h1 '));
 total+=figures;
}
const image=media[articles[0].slug][0];
const fixture=body=>`<div class="article-body">${body}<section id="sources"><p>Sources are excluded from the count.</p></section>`;
const enough=fixture(`<p>${'word '.repeat(600)}</p><h2>Section heading</h2><p>${'word '.repeat(587)}<sup>999 cited words</sup></p><p>Final unmatched paragraph.</p>`);
assert.equal((decorateArticleLayout(enough,{slug:'fixture'},{fixture:[image]}).match(/class="article-inline-image/g)||[]).length,1);
assert.throws(()=>decorateArticleLayout(fixture('<p>Short.</p>'),{slug:'fixture'},{}),/minimum/);
assert.throws(()=>decorateArticleLayout(enough,{slug:'fixture'},{fixture:[]}),/count mismatch/);
const four=fixture(Array.from({length:4},()=>`<p>${'word '.repeat(300)}</p>`).join(''));
assert.throws(()=>decorateArticleLayout(four,{slug:'fixture'},{fixture:[image,image]}),/Repeated/);
assert.throws(()=>articleBodyParts('<p>No explicit narrative boundary.</p>'),/boundary/);
for(const src of ['http://upload.wikimedia.org/photo.jpg','https://evil.example/photo.jpg','https://user:secret@upload.wikimedia.org/a.jpg','https://upload.wikimedia.org/a.jpg" onerror="alert(1)','https://upload.wikimedia.org:444/a.jpg'])assert.throws(()=>validateInlineImage({...image,src}));
for(const changes of [{license:'All rights reserved'},{width:0},{height:1.5},{creator:''},{checkedAt:''},{verification:'unchecked'},{sha256:''},{source:'https://evil.example/'},{licenseUrl:'javascript:alert(1)'}])assert.throws(()=>validateInlineImage({...image,...changes}));
const escaped=inlineFigure({...image,caption:'<script>alert(1)</script>',creator:'" onclick="bad',alt:'<img onerror="bad">'},2);
assert(!escaped.includes('<script>'));assert(escaped.includes('&lt;script&gt;'));assert(!escaped.includes(' onclick="bad'));
console.log(`Article layout passed: ${articles.length} stories >= ${ARTICLE_MIN_WORDS} words; ${total} credited lazy images; exact two-paragraph spacing; odd endings, caption/source exclusion, duplicate/media evidence and unsafe URL denial.`);

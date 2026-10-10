import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,cp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {buildTranslations} from './build-translations.mjs';
import {extractContract,validateTranslation,validateManifest,reviewedTranslations,decorateEnglish,renderTranslation,hash} from './translations.mjs';
const catalog=JSON.parse(await readFile('web/vercel/articles.json','utf8')),manifest=JSON.parse(await readFile('web/vercel/manual-releases.json','utf8')),glossary=JSON.parse(await readFile('web/vercel/translation-glossary.json','utf8'));
const stories=catalog.filter(a=>a.status==='published'),contracts=new Map(),templates=new Map(),origin='https://www.folkly.com';
for(const a of stories){const html=await readFile(`dist/${a.slug}.html`,'utf8'),c=extractContract(html,{slug:a.slug,catalog,manifest,glossary});contracts.set(a.slug,c);templates.set(a.slug,html);assert.equal(c.sourceHash,hash(html.replaceAll(String.fromCharCode(13),'')));assert.deepEqual(c,extractContract(html,{slug:a.slug,catalog,manifest,glossary}));assert.equal(decorateEnglish(html,a.slug,new Map(),origin),html);assert(c.segments.some(s=>s.kind==='alt'));assert(!c.segments.some(s=>s.text==='CC BY 2.0'||s.text==='Vernaccia'||s.text==='[1]'));}
const slug='lisbon-fado',source=contracts.get(slug),html=templates.get(slug);
assert.throws(()=>extractContract(html,{slug:'private-draft',catalog,manifest,glossary}));assert.throws(()=>extractContract(html,{slug,status:'draft',catalog,manifest,glossary}));
const fixture=locale=>({format:'folkly-translation-v1',slug,locale,sourceHash:source.sourceHash,glossaryHash:source.glossaryHash,promptVersion:source.promptVersion,fallbackLabel:'English fallback — test fixture',segments:source.segments.map(s=>({id:s.id,text:`${locale==='ar'?'اختبار':'Test'} ${s.text}`}))});
const entry=value=>({slug,locale:value.locale,status:'approved',sourceHash:value.sourceHash,glossaryHash:value.glossaryHash,promptVersion:value.promptVersion,translationHash:hash(value),review:{reviewer:'Synthetic test only — not an actual reviewer',reviewedAt:'2026-10-09T00:00:00Z',competentLanguageReview:true}});
const ar=fixture('ar'),fr=fixture('fr'),entries=[entry(ar),entry(fr)],approved=reviewedTranslations(entries,contracts,new Map([['ar/'+slug,ar],['fr/'+slug,fr]]));
const out=renderTranslation(html,ar,source,approved,origin),english=decorateEnglish(html,slug,approved,origin);
assert(out.includes('<html lang="ar" dir="rtl">'));assert(out.includes(`rel="canonical" href="${origin}/ar/${slug}"`));assert(out.includes('src="/assets/lisbon.jpg"'));assert(out.includes('hreflang="en" title="English fallback'));
for(const page of [out,english,renderTranslation(html,fr,source,approved,origin)])for(const lang of ['en','ar','fr','x-default'])assert(page.includes(`hreflang="${lang}"`));
assert.equal((out.match(/data-after-paragraph=/g)||[]).length,(html.match(/data-after-paragraph=/g)||[]).length);
assert.deepEqual([...out.matchAll(/data-image-id="([^"]*)"/g)].map(m=>m[1]),source.immutable.media);
for(const credit of [...html.matchAll(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/g)]){const rights=credit[1].slice(credit[1].indexOf('Photo:'));if(rights.startsWith('Photo:'))assert(out.includes(rights));}
assert(out.includes('<a href="#source-1" aria-label="Source 1">[1]</a>'));assert(out.includes('"inLanguage":"ar"'));assert(!out.includes('"wordCount":'));assert(!out.includes('hreflang="ja"'));
for(const mutate of [v=>v.locale='toString',v=>v.locale='../ar',v=>v.sourceHash='0'.repeat(64),v=>v.glossaryHash='0'.repeat(64),v=>v.promptVersion='other',v=>v.extra=true,v=>v.segments.pop(),v=>v.segments[0].text='<img onerror="x">',v=>v.segments[0].text=' ',v=>v.segments[0].text='x'.repeat(30001),v=>v.segments[1].id=v.segments[0].id,v=>v.segments.reverse()]){const v=structuredClone(ar);mutate(v);assert.throws(()=>validateTranslation(v,source));}
assert.throws(()=>renderTranslation(html+' ',ar,source,approved,origin));
const changed=structuredClone(ar);changed.segments[0].text+=' changed';assert.throws(()=>reviewedTranslations([entries[0]],contracts,new Map([['ar/'+slug,changed]])));
assert.equal(reviewedTranslations([{...entries[0],status:'draft'}],contracts,new Map()).size,0);assert.equal(reviewedTranslations([{...entries[0],sourceHash:'0'.repeat(64)}],contracts,new Map()).size,0);
assert.throws(()=>reviewedTranslations([{...entries[0],review:null}],contracts,new Map()));assert.throws(()=>reviewedTranslations([{...entries[0],review:{...entries[0].review,competentLanguageReview:false}}],contracts,new Map()));
assert.throws(()=>validateManifest([entries[0],entries[0]],contracts));assert.throws(()=>validateManifest([{...entries[0],slug:'../owner'}],contracts));assert.throws(()=>validateManifest([{...entries[0],slug:'private-reserve'}],contracts));assert.throws(()=>validateManifest([{...entries[0],locale:'toString'}],contracts));
// Exercise the build reader, review binding, filesystem boundary and sitemap in isolation.
const cwd=process.cwd(),temp=await mkdtemp(join(tmpdir(),'folkly-translations-test-'));
try{
 await mkdir(join(temp,'web/vercel/translations/ar'),{recursive:true});await mkdir(join(temp,'dist'),{recursive:true});
 for(const file of ['translation-glossary.json','manual-releases.json','locales.css','language.js'])await cp(resolve('web/vercel',file),join(temp,'web/vercel',file));
 await writeFile(join(temp,'web/vercel/translations/ar',slug+'.json'),JSON.stringify(ar));
 process.chdir(temp);
 const build=async list=>{await rm('dist',{recursive:true,force:true});await mkdir('dist');await writeFile(`dist/${slug}.html`,html);await writeFile('dist/sitemap.xml','<urlset></urlset>');await writeFile('web/vercel/translation-manifest.json',JSON.stringify({format:'folkly-translation-manifest-v1',entries:list}));return buildTranslations({articles:stories.filter(a=>a.slug===slug),origin});};
 const first=await build([entries[0]]);assert.equal(first.approved.size,1);const localized=await readFile(`dist/ar/${slug}.html`,'utf8');assert(localized.includes('dir="rtl"'));assert((await readFile('dist/sitemap.xml','utf8')).includes(origin+'/ar/'+slug));
 await build([entries[0]]);assert.equal(await readFile(`dist/ar/${slug}.html`,'utf8'),localized);
 await build([{...entries[0],sourceHash:'0'.repeat(64)}]);await assert.rejects(readFile(`dist/ar/${slug}.html`));assert.equal(await readFile(`dist/${slug}.html`,'utf8'),html);
 await assert.rejects(build([{...entries[0],slug:'../private'}]),/manifest/);
 await writeFile(`web/vercel/translations/ar/${slug}.json`,JSON.stringify(changed));await assert.rejects(build([entries[0]]),/after review/);
}finally{process.chdir(cwd);await rm(temp,{recursive:true,force:true});}
console.log(`Translations passed: ${stories.length} public contracts, complete synthetic AR/FR coverage, immutable credits/citations/images, reciprocal SEO, review/stale/private/path/HTML denial. No paid calls or language approval.`);

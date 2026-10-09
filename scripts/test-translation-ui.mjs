import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,cp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import vm from 'node:vm';
import {buildTranslations} from './build-translations.mjs';
import {publicUiPages,extractUiContract,messageContract,validateTranslation,hash,pagePath,renderTranslation} from './translations.mjs';
import {initializeArticleFilters} from '../web/vercel/article-filters.mjs';
const routes=JSON.parse(await readFile('web/vercel/routes.json','utf8')),UI_PAGES=publicUiPages([],routes);
const glossary=JSON.parse(await readFile('web/vercel/translation-glossary.json','utf8')),templates=new Map(),contracts=new Map();
for(const [slug,page] of Object.entries(UI_PAGES)){const html=await readFile('dist/'+page.file,'utf8');templates.set(slug,html);contracts.set(slug,extractUiContract(html,{slug,glossary,pages:UI_PAGES}));}
contracts.set('ui-messages',messageContract(glossary));assert.throws(()=>extractUiContract('',{slug:'ui-owner',glossary}));
const fixture=(contract,locale)=>({format:'folkly-translation-v1',slug:contract.slug,locale,sourceHash:contract.sourceHash,glossaryHash:contract.glossaryHash,promptVersion:contract.promptVersion,fallbackLabel:'Synthetic English fallback',segments:contract.segments.map(s=>({id:s.id,text:'Test '+s.text}))});
const entry=value=>({slug:value.slug,locale:value.locale,status:'approved',sourceHash:value.sourceHash,glossaryHash:value.glossaryHash,promptVersion:value.promptVersion,translationHash:hash(value),review:{reviewer:'Synthetic fixture only; no actual review',reviewedAt:'2026-10-09T00:00:00Z',competentLanguageReview:true}});
const locales=['zh-Hans','es','hi','ar','fr','ja'];
// Public topic/place contracts use generated groups, never the larger legacy/private catalog.
const catalog=JSON.parse(await readFile('web/vercel/articles.json','utf8'));
const {publishedArticles}=await import('./public-articles.mjs');
const publicItems=publishedArticles(catalog,routes),allPages=publicUiPages(publicItems,routes);
assert(!Object.hasOwn(allPages,'ui-owner'));assert(!Object.hasOwn(allPages,'ui-archive-topic-housing'));
assert.throws(()=>publicUiPages([],{'/author/../../owner':'owner.html'}),/Unsafe/);
const archiveSlugs=Object.keys(allPages).filter(slug=>slug.startsWith('ui-archive-'));
assert.equal(archiveSlugs.length,34);
for(const slug of archiveSlugs){
 const page=allPages[slug],html=await readFile('dist/'+page.file,'utf8'),contract=extractUiContract(html,{slug,glossary,pages:allPages});
 for(const locale of locales){const value=fixture(contract,locale),approved=new Map([[locale+'/'+slug,value]]),out=renderTranslation(html,value,contract,approved,'https://www.folkly.com',allPages),path=pagePath(slug,locale,allPages);
 assert(out.includes('href="https://www.folkly.com'+path+'"'));assert(out.includes('href="'+page.path+'"'));assert(out.includes('lang="'+locale+'"'));assert(!out.includes('/'+locale+'/ui-archive-'));
 for(const credit of contract.immutable.links.filter(link=>link.startsWith('https://creativecommons.org')))assert(out.includes('href="'+credit+'"'));
 }
}

const values=locales.flatMap(locale=>[...contracts.values()].map(c=>fixture(c,locale))),entries=values.map(entry);
const broken=fixture(contracts.get('ui-messages'),'ar');broken.segments[0].text=broken.segments[0].text.replace('{shown}','{name}');assert.throws(()=>validateTranslation(broken,contracts.get('ui-messages')),/placeholders/);
const cwd=process.cwd(),temp=await mkdtemp(join(tmpdir(),'folkly-translation-ui-'));
try{
 await mkdir(join(temp,'web/vercel'),{recursive:true});
 for(const file of ['translation-glossary.json','manual-releases.json','locales.css','language.js','reader-ui.js'])await cp(resolve('web/vercel',file),join(temp,'web/vercel',file));
 for(const value of values){await mkdir(join(temp,'web/vercel/translations',value.locale),{recursive:true});await writeFile(join(temp,'web/vercel/translations',value.locale,value.slug+'.json'),JSON.stringify(value));}
 process.chdir(temp);
 const build=async(list=entries)=>{await rm('dist',{recursive:true,force:true});await mkdir('dist');for(const [slug,page] of Object.entries(UI_PAGES)){await mkdir(join('dist',page.file,'..'),{recursive:true});await writeFile('dist/'+page.file,templates.get(slug));}await writeFile('dist/sitemap.xml','<urlset></urlset>');await writeFile('web/vercel/translation-manifest.json',JSON.stringify({format:'folkly-translation-manifest-v1',entries:list}));return buildTranslations({articles:[],routes,origin:'https://www.folkly.com'});};
 const result=await build();assert.equal(result.approved.size,72);assert.deepEqual(JSON.parse(await readFile('build/translation-contracts/index.json','utf8')),[...contracts.keys()].sort());
 const outputs=new Map();for(const locale of locales)for(const [slug,page] of Object.entries(UI_PAGES)){const path=pagePath(slug,locale,UI_PAGES),html=await readFile('dist'+path+'.html','utf8');outputs.set(path,html);assert(html.includes(`lang="${locale}" dir="${locale==='ar'?'rtl':'ltr'}"`));assert(html.includes(`rel="canonical" href="https://www.folkly.com${path}"`));assert(!html.includes('/'+locale+'/ui-'));assert(html.includes('hreflang="en"'));assert(html.includes(`hreflang="${locale}"`));for(const target of ['/privacy','/about'])if(templates.get(slug).includes('href="'+target+'"'))assert(html.includes('href="/'+locale+target+'"')); assert(html.includes('id="folkly-reader-ui"'));assert(html.indexOf('/reader-ui.js')<html.indexOf('/privacy.js'));if(html.includes('hreflang="en" title="Synthetic English fallback"'))assert(html.includes('aria-describedby="locale-fallback"'));const english=await readFile('dist/'+page.file,'utf8');assert(english.includes(`hreflang="${locale}" href="https://www.folkly.com${path}"`));}
 assert(outputs.get('/fr/author/mira-sol').includes('hreflang="en" title="Synthetic English fallback"'));assert((await readFile('dist/sitemap.xml','utf8')).includes('/fr/author/mira-sol'));
 const archive=outputs.get('/ar/archive');assert(archive.includes('href="/ar/author/mira-sol"'));assert(archive.includes('data-title="Test '));assert(archive.includes('href="/lisbon-fado"'));assert(archive.includes('hreflang="en" title="Synthetic English fallback"'));assert(archive.includes('Test Countries'));assert(!archive.includes('href="/ar/lisbon-fado"'));assert(archive.includes('data-published-grid'));
 const about=outputs.get('/fr/about');assert(about.includes('id="contact-form"'));assert(about.includes('name="consent"'));assert(about.includes('Test I’m interested in becoming a contributor.'));assert(about.includes('href="/fr/subscribe"'));
 const subscribe=outputs.get('/fr/subscribe');assert(subscribe.includes('name="email"'));assert(subscribe.includes('name="consent"'));assert(subscribe.includes('src="/subscribe.js"'));
 const credits=outputs.get('/ar/image-credits');for(const destination of contracts.get('ui-image-credits').immutable.links.filter(h=>/^https:\/\/(commons.wikimedia|creativecommons)/.test(h)))assert(credits.includes(`href="${destination}"`));
 const sitemap=await readFile('dist/sitemap.xml','utf8');assert(!sitemap.includes('ui-messages'));assert(!sitemap.includes('/owner'));await assert.rejects(readFile('dist/ar/ui-messages.html'));
 await build();for(const [path,html] of outputs)assert.equal(await readFile('dist'+path+'.html','utf8'),html);
 await build(entries.map(e=>e.slug==='ui-about'?{...e,sourceHash:'0'.repeat(64)}:e));await assert.rejects(readFile('dist/ar/about.html'));const stale=await readFile('dist/ar.html','utf8');assert(stale.includes('href="/about"'));assert(!stale.includes('hreflang="ar" href="https://www.folkly.com/ar/about"'));
 await build([]);for(const [slug,page] of Object.entries(UI_PAGES))assert.equal(await readFile('dist/'+page.file,'utf8'),templates.get(slug));await assert.rejects(readFile('dist/ar.html'));
}finally{process.chdir(cwd);await rm(temp,{recursive:true,force:true});}
// Browser dictionary uses textContent and owned keys, never executable provider markup.
const dictionary=fixture(contracts.get('ui-messages'),'fr'),strings=Object.fromEntries(contracts.get('ui-messages').segments.map((s,i)=>[s.kind,dictionary.segments[i].text])),window={};
vm.runInNewContext(await readFile('web/vercel/reader-ui.js','utf8'),{document:{getElementById:()=>({textContent:JSON.stringify({locale:'fr',strings})})},window});assert.equal(window.FolklyUI.t('count','fallback'),strings.count);assert.equal(window.FolklyUI.t('toString','fallback'),'fallback');
const cards=[{dataset:{article:'one',title:'Un',country:'france',region:'europe',topics:'music',published:'2026-10-09'}}],place={},sort={},count={},empty={},clear={addEventListener(){}},panel={querySelector:s=>s==='[name="place"]'?place:s==='[name="sort"]'?sort:s==='[data-filter-count]'?count:s==='[data-filter-empty]'?empty:clear,querySelectorAll:()=>[],addEventListener(){}},grid={querySelectorAll:()=>cards,append(){}};
initializeArticleFilters({documentElement:{lang:'fr'},querySelector:s=>s==='[data-article-filters]'?panel:grid},{FolklyUI:window.FolklyUI,location:{href:'https://www.folkly.com/fr/archive'},addEventListener(){},history:{replaceState(){}}});assert.equal(count.textContent,'Test Showing 1 of 1 Test story');
for(const ok of [false,true]){let submit,reset=0,emits=0;const status={},form={addEventListener:(n,f)=>submit=f,querySelector:()=>({}),reset:()=>reset++};vm.runInNewContext(await readFile('web/vercel/subscribe.js','utf8'),{document:{querySelector:s=>s==='#subscribe-form'?form:status},fetch:async()=>({ok,status:ok?200:503,json:async()=>({message:'English API'})}),FormData:class{*[Symbol.iterator](){yield ['email','fixture@example.invalid'];}},window:{...window,folklyAnalytics:{emit:()=>emits++}}});await submit({preventDefault(){}});assert.equal(status.textContent,strings[ok?'subscribeSaved':'subscribeUnavailable']);assert.equal(reset,ok?1:0);assert.equal(emits,ok?1:0);}
// Owner draft UI must clear all receipt/body state and reject late responses after logout.
const listeners={},elements=new Map(),pending=[];const element=()=>({value:'',textContent:'',children:[],addEventListener(n,f){this[n]=f;},replaceChildren(...children){this.children=children;this.textContent='';},append(...children){this.children.push(...children);},querySelector(){return {};}});const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},addEventListener(n,f){listeners[n]=f;},createElement:element};
let expiredSessions=0;
vm.runInNewContext(await readFile('web/vercel/owner-translations.js','utf8'),{document,fetch:()=>new Promise(resolve=>pending.push(resolve)),window:{expireOwnerSession(){expiredSessions++;listeners['owner-session']({detail:{signedIn:false}});}},crypto:{randomUUID:()=>''},encodeURIComponent});listeners['owner-session']({detail:{signedIn:true}});listeners['owner-session']({detail:{signedIn:false}});pending.shift()({status:200,ok:true,json:async()=>({jobs:[{slug:'private'}],sources:['private'],configuration:{available:false}})});await new Promise(resolve=>setImmediate(resolve));assert.equal(elements.get('translation-jobs').children.length,0);assert.equal(elements.get('translation-source').children.length,0);assert.equal(elements.get('translation-status').textContent,'');assert.equal(elements.get('translation-recovery-hash').value,'');
console.log('Translation UI passed: six shared pages, five public author pages and message catalog, synthetic six-language static routes, localized discovery/filter/form/consent text, placeholder and credit integrity, canonical/alternate/fallback links, stale/rollback/reproducibility and owner logout isolation. No real language approval or locale release.');

listeners['owner-session']({detail:{signedIn:true}});pending.shift()({status:401,ok:false,json:async()=>({message:'Owner sign-in required.'})});await new Promise(resolve=>setImmediate(resolve));assert.equal(expiredSessions,1);assert.equal(elements.get('translation-source').children.length,0);assert.equal(elements.get('translation-preview').textContent,'');
console.log('Translation expiry passed: private API 401 invokes the shared reauthentication notice and clears private source/draft state.');

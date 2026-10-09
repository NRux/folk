import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {readerIdentity,targetStory,readingTracker,bootReader} from '../web/vercel/reader-events.mjs';
const version='a'.repeat(64),identity={article_id:'lisbon-fado',content_version:version},article={dataset:{articleId:'lisbon-fado',articleVersion:version}};
for(const path of ['/lisbon-fado','/lisbon-fado.html','/ar/lisbon-fado'])assert.deepEqual(readerIdentity(article,{origin:'https://www.folkly.com',pathname:path}),identity);
for(const path of ['/owner','/preview/lisbon-fado','/other'])assert.equal(readerIdentity(article,{origin:'https://www.folkly.com',pathname:path}),null);
assert.equal(readerIdentity(article,{origin:'https://test.vercel.app',pathname:'/lisbon-fado'}),null);assert.equal(readerIdentity(null,{origin:'https://www.folkly.com'}),null);
const allowed=new Set(['lisbon-fado']);assert.equal(targetStory('/lisbon-fado.html?email=secret#otp','https://www.folkly.com',allowed),'lisbon-fado');assert.equal(targetStory('https://evil.example/lisbon-fado','https://www.folkly.com',allowed),null);assert.equal(targetStory('/private','https://www.folkly.com',allowed),null);
let granted=false;const events=[],tracker=readingTracker(identity,(name,data)=>{if(!granted)return false;events.push({name,data});return true;});tracker.depth(50);granted=true;tracker.depth(100);tracker.depth(100);tracker.depth(NaN);assert.deepEqual(events.map(e=>e.data.read_depth),[75,90]);assert(events.every(e=>Object.keys(e.data).length===3));
const code=await readFile('web/vercel/privacy.js','utf8');
function privacy(origin='https://www.folkly.com'){
 const nodes=new Map(),scripts=[],node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,focus(){},addEventListener(n,f){this[n]=f;}});return nodes.get(id);};
 const document={getElementById:node,querySelectorAll:()=>[],cookie:'',referrer:'https://example.com/page?email=secret#otp',head:{append:s=>scripts.push(s)},createElement:()=>({})};
 const context={window:{},document,location:{origin,pathname:'/lisbon-fado.html',hostname:'www.folkly.com',reload(){}},localStorage:{getItem:()=>null,setItem(){}},navigator:{},Date,URL};vm.runInNewContext(code,context);return {context,nodes,scripts,emit:context.window.folklyAnalytics.emit};
}
let p=privacy();assert.equal(p.emit('article_read_depth',{...identity,read_depth:25}),false);p.nodes.get('privacy-accept').click();assert.equal(p.emit('article_read_depth',{...identity,read_depth:25}),true);assert.equal(p.emit('subscribe_success'),true);assert.equal(p.emit('subscribe_success',{email:'secret'}),false);assert.equal(p.emit('related_story_click',{...identity,target_article_id:'noah@example.com'}),false);assert.equal(p.emit('article_read_depth',{...identity,read_depth:26}),false);assert.equal(p.emit('toString'),false);
const config=p.context.window.dataLayer.find(v=>v[0]==='config')[2];assert.equal(config.page_location,'https://www.folkly.com/lisbon-fado');assert.equal(config.page_referrer,'https://example.com/page');p.nodes.get('privacy-reject').click();assert.equal(p.emit('subscribe_success'),false);
p=privacy('https://preview.vercel.app');p.nodes.get('privacy-accept').click();assert.equal(p.scripts.length,0);assert.equal(p.emit('subscribe_success'),false);
// Exercise real event wiring: scroll coalescing and bounded click contexts.
const handlers={},sent=[],body={getBoundingClientRect:()=>({height:1000,top:0})};article.querySelector=()=>body;
const related={dataset:{storyId:'lisbon-fado'}},document={querySelector:()=>article,querySelectorAll:()=>[related],visibilityState:'visible',addEventListener:(n,f)=>handlers[n]=f};
const window={folklyAnalytics:{emit:(name,data)=>{sent.push({name,data});return true;}},innerHeight:950,addEventListener:(n,f)=>handlers[n]=f,requestAnimationFrame:f=>f()};bootReader(document,window,{origin:'https://www.folkly.com',pathname:'/lisbon-fado'});handlers.scroll();handlers.scroll();assert.equal(sent.length,4);document.visibilityState='hidden';handlers.scroll();assert.equal(sent.length,4);
const anchor={href:'/lisbon-fado?email=secret',closest:s=>s==='.related-stories'?{}:null};handlers.click({target:{closest:()=>anchor}});assert.equal(sent.at(-1).name,'related_story_click');assert.equal(sent.at(-1).data.target_article_id,'lisbon-fado');assert(!JSON.stringify(sent).includes('secret'));
// Subscription success must follow server persistence acknowledgement, never a failed form.
const subscribe=await readFile('web/vercel/subscribe.js','utf8');
for(const ok of [false,true]){let submit,reset=0,emits=0;const form={addEventListener:(n,f)=>submit=f,querySelector:()=>({}),reset:()=>reset++};const ctx={document:{querySelector:s=>s==='#subscribe-form'?form:{}},fetch:async()=>({ok,json:async()=>({message:'result'})}),FormData:class{*[Symbol.iterator](){yield ['email','never-in-analytics@example.com'];}},window:{folklyAnalytics:{emit:name=>{assert.equal(name,'subscribe_success');assert.equal(reset,1);emits++;}}}};vm.runInNewContext(subscribe,ctx);await submit({preventDefault(){}});assert.equal(emits,ok?1:0);}
console.log('Reader events passed: consent/withdrawal/preview denial, canonical identity, milestone deduplication/no replay, click payload privacy and durable signup success timing. No Google requests.');

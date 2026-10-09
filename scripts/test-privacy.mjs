import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {privacyControls} from './privacy-pages.mjs';
const code=await readFile('web/vercel/privacy.js','utf8');
function run(stored,gpc=false,broken=false){const nodes=new Map(),scripts=[],changes=[];let reloads=0;const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,checked:false,focus(){},addEventListener(event,fn){this[event]=fn;}});return nodes.get(id);};const document={getElementById:node,querySelectorAll:()=>[node('open')],head:{append:s=>scripts.push(s)},createElement:()=>({}),cookie:'_ga=old; session=essential'};const context={document,window:{},navigator:{globalPrivacyControl:gpc},localStorage:{getItem(){if(broken)throw Error();return stored;},setItem(k,v){changes.push(JSON.parse(v));if(broken)throw Error();}},location:{origin:'https://www.folkly.com',pathname:'/about',hostname:'www.folkly.com',reload(){reloads++;}},Date};vm.runInNewContext(code,context);return {nodes,scripts,changes,context,get reloads(){return reloads;}};}
let r=run(null);assert.equal(r.scripts.length,0);assert.equal(r.nodes.get('privacy-panel').hidden,false);r.nodes.get('privacy-reject').click();assert.equal(r.scripts.length,0);assert.equal(r.changes[0].analytics,false);
r=run(null);r.nodes.get('privacy-accept').click();assert.equal(r.scripts.length,1);const config=r.context.window.dataLayer.find(x=>x[0]==='config');assert.equal(config[2].page_location,'https://www.folkly.com/about');assert.equal(config[2].allow_google_signals,false);r.nodes.get('privacy-reject').click();assert.equal(r.reloads,1);
for(const value of ['{bad',JSON.stringify({version:1,analytics:true,at:Date.now()-181*86400000}),JSON.stringify({version:2,analytics:true,at:Date.now()}),JSON.stringify({version:1,analytics:'yes',at:Date.now()})])assert.equal(run(value).scripts.length,0);
assert.equal(run(null,false,true).scripts.length,0);r=run(null,true);assert(r.nodes.get('privacy-signal').textContent.includes('Global Privacy Control'));assert.equal(r.scripts.length,0);
assert.equal(run(JSON.stringify({version:1,analytics:true,at:Date.now()})).scripts.length,1);
const privateHtml=privacyControls('<html><head></head><body></body></html>',{privatePage:true});assert(!privateHtml.includes('/privacy.js'));assert(!privateHtml.includes('privacy-panel'));assert(privateHtml.includes('/privacy'));
console.log('Privacy passed: deny by default, explicit grant, withdrawal reload, malformed/expired/storage-failure denial, GPC disclosure, private-panel exclusion and clean page location. No external requests.');
